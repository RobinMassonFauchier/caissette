import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard/Dashboard";
import { getSession, isGoogleConfigured } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace, readExpenses } from "@/lib/sheet";
import { describeGoogleError } from "@/lib/google-errors";
import type { Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  if (!isGoogleConfigured()) redirect("/?error=config");

  const session = await getSession();
  if (!session.refreshToken || !session.user) redirect("/");

  let expenses: Expense[] = [];
  let sheetUrl = "";
  let error: string | null = null;

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    sheetUrl = workspace.spreadsheetUrl;
    expenses = await readExpenses(auth, workspace.spreadsheetId);
  } catch (err) {
    console.error("Chargement du tableau de bord impossible :", err);
    error = describeGoogleError(err);
  }

  return (
    <Dashboard
      user={session.user}
      expenses={expenses}
      sheetUrl={sheetUrl}
      error={error}
    />
  );
}
