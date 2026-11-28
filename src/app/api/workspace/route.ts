import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace, readExpenses } from "@/lib/sheet";
import { readSettings } from "@/lib/settings";
import { defaultProfile, readProfile } from "@/lib/profile";
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
    const [expenses, settings, profile] = await Promise.all([
      readExpenses(auth, workspace.spreadsheetId),
      readSettings(auth, workspace.folderId),
      readProfile(auth, workspace.folderId, session.user).catch((error) => {
        console.error("Profil indisponible :", error);
        return defaultProfile(session.user!);
      }),
    ]);

    return NextResponse.json(
      {
        expenses,
        settings,
        profile,
        sheetUrl: workspace.spreadsheetUrl,
        folderId: workspace.folderId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Rafraîchissement des données impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}
