import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";
import {
  getAllowedEmails,
  getAppUrl,
  getSession,
} from "@/lib/session";

export const dynamic = "force-dynamic";

function fail(reason: string) {
  return NextResponse.redirect(
    new URL(`/?error=${encodeURIComponent(reason)}`, getAppUrl()),
  );
}

export async function GET(request: Request) {
  const appUrl = getAppUrl();
  const url = new URL(request.url);

  if (url.searchParams.get("error")) {
    return fail("access_denied");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = (await cookies()).get("caissette_oauth_state")?.value;

  if (!code) return fail("missing_code");
  if (!state || !storedState || state !== storedState) {
    return fail("invalid_state");
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      return fail("no_refresh_token");
    }

    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();

    if (!data.id || !data.email) {
      return fail("profile");
    }

    const allowed = getAllowedEmails();
    if (allowed.length > 0 && !allowed.includes(data.email.toLowerCase())) {
      return fail("forbidden");
    }

    const session = await getSession();
    session.user = {
      sub: data.id,
      email: data.email,
      name: data.name || data.email,
      picture: data.picture || undefined,
    };
    session.refreshToken = tokens.refresh_token;
    await session.save();

    const response = NextResponse.redirect(new URL("/app", appUrl));
    response.cookies.delete("caissette_oauth_state");
    return response;
  } catch (error) {
    console.error("Échec de la connexion Google :", error);
    return fail("auth_failed");
  }
}
