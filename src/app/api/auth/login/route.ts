import { NextResponse } from "next/server";
import { createOAuthClient, GOOGLE_SCOPES } from "@/lib/google";
import { getAppUrl, isGoogleConfigured, isHttps } from "@/lib/session";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const appUrl = getAppUrl();

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/?error=config", appUrl));
  }

  const state = randomUUID();
  const client = createOAuthClient();

  const authorizationUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES,
    state,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("caissette_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(),
    path: "/",
    maxAge: 600,
  });
  return response;
}
