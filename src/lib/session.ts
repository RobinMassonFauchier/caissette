import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { SessionUser } from "./types";

export interface SessionData {
  user?: SessionUser;
  refreshToken?: string;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export function getAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function isHttps(): boolean {
  return getAppUrl().startsWith("https://");
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET manquant ou trop court (32 caractères minimum). Renseignez-le dans .env.local.",
    );
  }

  return {
    cookieName: "caissette_session",
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: isHttps(),
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}

/** Liste d'e-mails autorisés (optionnel). Vide = tout compte Google. */
export function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
