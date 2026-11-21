import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();

  if (!session.refreshToken) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const { token } = await auth.getAccessToken();

    if (!token) {
      return NextResponse.json(
        { error: "Jeton Google indisponible." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { accessToken: token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Jeton Google impossible :", error);
    return NextResponse.json(
      { error: "Impossible d'obtenir un jeton Google." },
      { status: 502 },
    );
  }
}
