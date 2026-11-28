import { google, type drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import type { SessionUser, UserProfile } from "./types";

/**
 * Profil utilisateur V2.
 *
 * Il n'y a pas de base de données : le profil est un petit fichier JSON rangé
 * dans le dossier Drive privé de l'application. Son nom contient l'empreinte
 * du `sub` Google (jamais l'e-mail ni le jeton), ce qui garantit qu'un profil
 * ne peut être lu que par le compte Google qui l'a créé, même si plusieurs
 * personnes partagent le même Drive.
 */

const PROFILE_PREFIX = "profil-caissette-";

function profileHash(sub: string): string {
  return createHash("sha256").update(sub).digest("hex").slice(0, 32);
}

function profileFileName(sub: string): string {
  return `${PROFILE_PREFIX}${profileHash(sub || "anonyme")}.json`;
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function nowISO(): string {
  return new Date().toISOString();
}

export function defaultProfile(
  user: Pick<SessionUser, "sub" | "email" | "name" | "picture">,
): UserProfile {
  const now = nowISO();
  return {
    sub: user.sub,
    email: user.email,
    displayName: user.name || user.email.split("@")[0] || "Utilisateur",
    googleName: user.name,
    picture: user.picture,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  };
}

function normalizeProfile(
  input: unknown,
  fallback: UserProfile,
): UserProfile {
  const data =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};

  const displayName =
    typeof data.displayName === "string" && data.displayName.trim()
      ? data.displayName.trim().slice(0, 60)
      : fallback.displayName;

  return {
    sub: fallback.sub,
    email: fallback.email,
    displayName,
    googleName:
      fallback.googleName ||
      (typeof data.googleName === "string" && data.googleName.trim()
        ? data.googleName.trim().slice(0, 120)
        : fallback.googleName),
    picture:
      fallback.picture ||
      (typeof data.picture === "string" && data.picture
        ? data.picture
        : fallback.picture),
    createdAt:
      typeof data.createdAt === "string" && data.createdAt
        ? data.createdAt
        : fallback.createdAt,
    updatedAt:
      typeof data.updatedAt === "string" && data.updatedAt
        ? data.updatedAt
        : fallback.updatedAt,
    lastSeenAt:
      typeof data.lastSeenAt === "string" && data.lastSeenAt
        ? data.lastSeenAt
        : fallback.lastSeenAt,
  };
}

async function findProfileFile(
  drive: drive_v3.Drive,
  folderId: string,
  sub: string,
): Promise<string | null> {
  const name = profileFileName(sub);
  const list = await drive.files.list({
    q: `name = '${escapeQuery(name)}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    spaces: "drive",
  });
  return list.data.files?.[0]?.id ?? null;
}

export async function readProfile(
  auth: OAuth2Client,
  folderId: string,
  user: SessionUser,
): Promise<UserProfile> {
  const drive = google.drive({ version: "v3", auth });
  const fallback = defaultProfile(user);

  const fileId = await findProfileFile(drive, folderId, user.sub);
  if (!fileId) {
    await writeProfileFile(drive, folderId, fallback);
    return fallback;
  }

  try {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    const parsed = JSON.parse(
      Buffer.from(response.data as ArrayBuffer).toString("utf8"),
    );
    return normalizeProfile(parsed, fallback);
  } catch (error) {
    console.error("Lecture du profil impossible :", error);
    try {
      await writeProfileFile(drive, folderId, fallback);
    } catch (repairError) {
      console.error("Réparation du profil impossible :", repairError);
    }
    return fallback;
  }
}

async function writeProfileFile(
  drive: drive_v3.Drive,
  folderId: string,
  profile: UserProfile,
): Promise<void> {
  const name = profileFileName(profile.sub);
  const fileId = await findProfileFile(drive, folderId, profile.sub);
  const media = {
    mimeType: "application/json",
    body: Readable.from(
      Buffer.from(JSON.stringify(profile, null, 2), "utf8"),
    ),
  };

  if (fileId) {
    await drive.files.update({ fileId, media, fields: "id" });
    return;
  }

  await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media,
    fields: "id",
  });
}

export async function writeProfile(
  auth: OAuth2Client,
  folderId: string,
  user: SessionUser,
  patch: unknown,
): Promise<UserProfile> {
  const drive = google.drive({ version: "v3", auth });
  const fallback = defaultProfile(user);
  const current = await readProfile(auth, folderId, user);

  const data =
    typeof patch === "object" && patch !== null
      ? (patch as Record<string, unknown>)
      : {};

  const displayName =
    typeof data.displayName === "string" && data.displayName.trim().length >= 2
      ? data.displayName.trim().slice(0, 60)
      : current.displayName;

  const updated: UserProfile = {
    ...current,
    displayName,
    googleName: user.name || current.googleName,
    picture: user.picture || current.picture,
    updatedAt: nowISO(),
    lastSeenAt: nowISO(),
  };

  await writeProfileFile(drive, folderId, {
    ...normalizeProfile(updated, fallback),
    sub: user.sub,
    email: user.email,
  });

  return updated;
}
