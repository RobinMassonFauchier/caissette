import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";
import type { Category } from "./types";
import { isCategory } from "./catalog";

export type AppSettings = {
  monthlyBudget: number | null;
  defaultCategory: Category;
  driveImportEnabled: boolean;
  gmailEnabled: boolean;
  updatedAt: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  monthlyBudget: null,
  defaultCategory: "Alimentation",
  driveImportEnabled: true,
  gmailEnabled: false,
  updatedAt: "",
};

const SETTINGS_FILE = "parametres-caissette.json";

function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function normalizeSettings(input: unknown): AppSettings {
  const data =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};

  const rawBudget =
    typeof data.monthlyBudget === "number"
      ? data.monthlyBudget
      : typeof data.monthlyBudget === "string"
        ? Number(data.monthlyBudget.replace(",", "."))
        : NaN;

  const monthlyBudget =
    Number.isFinite(rawBudget) && rawBudget > 0 && rawBudget < 10_000_000
      ? Math.round(rawBudget * 100) / 100
      : null;

  const defaultCategory = isCategory(data.defaultCategory)
    ? data.defaultCategory
    : DEFAULT_SETTINGS.defaultCategory;

  return {
    monthlyBudget,
    defaultCategory,
    driveImportEnabled:
      typeof data.driveImportEnabled === "boolean"
        ? data.driveImportEnabled
        : DEFAULT_SETTINGS.driveImportEnabled,
    // Gmail reste désactivé : le scope est restreint par Google.
    gmailEnabled: false,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

export async function readSettings(
  auth: OAuth2Client,
  folderId: string,
): Promise<AppSettings> {
  const drive = google.drive({ version: "v3", auth });

  const list = await drive.files.list({
    q: `name = '${escapeQuery(SETTINGS_FILE)}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    spaces: "drive",
  });

  const fileId = list.data.files?.[0]?.id;
  if (!fileId) return DEFAULT_SETTINGS;

  try {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    const parsed = JSON.parse(
      Buffer.from(response.data as ArrayBuffer).toString("utf8"),
    );
    return normalizeSettings(parsed);
  } catch (error) {
    console.error("Lecture des paramètres impossible :", error);
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(
  auth: OAuth2Client,
  folderId: string,
  input: unknown,
): Promise<AppSettings> {
  const drive = google.drive({ version: "v3", auth });
  const settings = normalizeSettings({
    ...(typeof input === "object" && input !== null ? input : {}),
    updatedAt: new Date().toISOString(),
  });

  const list = await drive.files.list({
    q: `name = '${escapeQuery(SETTINGS_FILE)}' and '${folderId}' in parents and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    spaces: "drive",
  });

  const fileId = list.data.files?.[0]?.id;
  const media = {
    mimeType: "application/json",
    body: Readable.from(Buffer.from(JSON.stringify(settings, null, 2), "utf8")),
  };

  if (fileId) {
    await drive.files.update({
      fileId,
      media,
      fields: "id",
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: SETTINGS_FILE,
        parents: [folderId],
      },
      media,
      fields: "id",
    });
  }

  return settings;
}
