import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();

  if (!session.refreshToken) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  return NextResponse.json(
    {
      apiKey: process.env.GOOGLE_PICKER_API_KEY || "",
      appId: process.env.GOOGLE_PROJECT_NUMBER || "93860449537",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
