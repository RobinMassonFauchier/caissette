import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace } from "@/lib/sheet";
import { readProfile, writeProfile } from "@/lib/profile";
import { describeGoogleError } from "@/lib/google-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();

  if (!session.refreshToken || !session.user) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    const profile = await readProfile(auth, workspace.folderId, session.user);
    return NextResponse.json(
      { profile },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Lecture du profil impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session.refreshToken || !session.user) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    const profile = await writeProfile(
      auth,
      workspace.folderId,
      session.user,
      payload,
    );
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.error("Enregistrement du profil impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}
