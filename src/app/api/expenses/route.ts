import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { appendExpense, ensureWorkspace } from "@/lib/sheet";
import { parseExpenseInput } from "@/lib/validation";
import { describeGoogleError } from "@/lib/google-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const parsed = parseExpenseInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    const { row } = await appendExpense(auth, workspace.spreadsheetId, parsed.value);
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    console.error("Ajout de la dépense impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}
