import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { appendExpenses, ensureWorkspace, type ExpenseInput } from "@/lib/sheet";
import { parseExpenseInput } from "@/lib/validation";
import { describeGoogleError } from "@/lib/google-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session.refreshToken) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  let payload: { expenses?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  if (!Array.isArray(payload.expenses) || payload.expenses.length === 0) {
    return NextResponse.json({ error: "Aucune dépense à importer." }, { status: 400 });
  }

  if (payload.expenses.length > 20) {
    return NextResponse.json(
      { error: "20 tickets maximum par import." },
      { status: 400 },
    );
  }

  const inputs: ExpenseInput[] = [];
  for (let index = 0; index < payload.expenses.length; index += 1) {
    const parsed = parseExpenseInput(payload.expenses[index]);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: `Ticket ${index + 1} : ${parsed.error}` },
        { status: 400 },
      );
    }
    inputs.push(parsed.value);
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    const { rows } = await appendExpenses(auth, workspace.spreadsheetId, inputs);
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    console.error("Import groupé impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}
