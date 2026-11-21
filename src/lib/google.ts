import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { getAppUrl } from "./session";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Non sensible : accès uniquement aux fichiers créés/ouverts par l'application.
  // Ce scope suffit pour l'API Sheets sur nos propres feuilles.
  "https://www.googleapis.com/auth/drive.file",
];

export function getRedirectUri(): string {
  return `${getAppUrl()}/api/auth/callback`;
}

export function createOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants. Consultez le README.",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

/**
 * Construit un client authentifié à partir du refresh token stocké en session.
 * Le jeton d'accès est rafraîchi automatiquement en mémoire par google-auth-library.
 */
export async function getAuthClient(refreshToken: string): Promise<OAuth2Client> {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();

  if (!token) {
    throw new Error("Autorisation Google expirée. Reconnectez-vous.");
  }

  return client;
}
