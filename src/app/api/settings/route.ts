import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace } from "@/lib/sheet";
import { writeSettings } from "@/lib/settings";
import { describeGoogleError } from "@/lib/google-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session.refreshToken) {
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
    const settings = await writeSettings(auth, workspace.folderId, payload);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("Enregistrement des paramètres impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}
