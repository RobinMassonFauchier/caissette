import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import {
  deleteExpense,
  ensureWorkspace,
  SheetConflictError,
  SheetNotFoundError,
  updateExpense,
} from "@/lib/sheet";
import { parseExpensePatch } from "@/lib/validation";
import { describeGoogleError } from "@/lib/google-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ row: string }> };

async function resolveRow(context: RouteContext): Promise<number | null> {
  const { row } = await context.params;
  const value = Number(row);
  if (!Number.isInteger(value) || value < 2 || value > 100_000) return null;
  return value;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session.refreshToken) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const row = await resolveRow(context);
  if (row === null) {
    return NextResponse.json({ error: "Ligne invalide." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const parsed = parseExpensePatch(payload);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    const updated = await updateExpense(
      auth,
      workspace.spreadsheetId,
      row,
      parsed.value.patch,
      {
        expectedUpdatedAt: parsed.value.expectedUpdatedAt,
        expectedOriginal: parsed.value.expectedOriginal,
        force: parsed.value.force,
      },
    );
    return NextResponse.json({ ok: true, expense: updated });
  } catch (error) {
    if (error instanceof SheetConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "conflict",
          current: error.current,
        },
        { status: 409 },
      );
    }
    if (error instanceof SheetNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Modification de la dépense impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session.refreshToken) {
    return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
  }

  const row = await resolveRow(context);
  if (row === null) {
    return NextResponse.json({ error: "Ligne invalide." }, { status: 400 });
  }

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    await deleteExpense(auth, workspace.spreadsheetId, row);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Suppression de la dépense impossible :", error);
    return NextResponse.json(
      { error: describeGoogleError(error) },
      { status: 502 },
    );
  }
}
