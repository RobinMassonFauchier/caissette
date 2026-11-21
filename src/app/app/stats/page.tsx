import { redirect } from "next/navigation";
import { StatsView } from "@/components/stats/StatsView";
import { getSession, isGoogleConfigured } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace, readExpenses } from "@/lib/sheet";
import { DEFAULT_SETTINGS, readSettings } from "@/lib/settings";
import { describeGoogleError } from "@/lib/google-errors";
import type { Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  if (!isGoogleConfigured()) redirect("/?error=config");

  const session = await getSession();
  if (!session.refreshToken || !session.user) redirect("/");

  let expenses: Expense[] = [];
  let sheetUrl = "";
  let settings = DEFAULT_SETTINGS;
  let error: string | null = null;

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    sheetUrl = workspace.spreadsheetUrl;
    const [rows, loadedSettings] = await Promise.all([
      readExpenses(auth, workspace.spreadsheetId),
      readSettings(auth, workspace.folderId),
    ]);
    expenses = rows;
    settings = loadedSettings;
  } catch (err) {
    console.error("Chargement des statistiques impossible :", err);
    error = describeGoogleError(err);
  }

  return (
    <StatsView
      user={session.user}
      expenses={expenses}
      settings={settings}
      sheetUrl={sheetUrl}
      error={error}
    />
  );
}
