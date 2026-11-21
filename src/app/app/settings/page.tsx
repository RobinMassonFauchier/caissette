import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";
import { getSession, isGoogleConfigured } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace } from "@/lib/sheet";
import { DEFAULT_SETTINGS, readSettings, type AppSettings } from "@/lib/settings";
import { describeGoogleError } from "@/lib/google-errors";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!isGoogleConfigured()) redirect("/?error=config");

  const session = await getSession();
  if (!session.refreshToken || !session.user) redirect("/");

  let settings: AppSettings = DEFAULT_SETTINGS;
  let sheetUrl = "";
  let folderUrl = "";
  let error: string | null = null;

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    sheetUrl = workspace.spreadsheetUrl;
    folderUrl = `https://drive.google.com/drive/folders/${workspace.folderId}`;
    settings = await readSettings(auth, workspace.folderId);
  } catch (err) {
    console.error("Chargement des paramètres impossible :", err);
    error = describeGoogleError(err);
  }

  return (
    <SettingsView
      user={session.user}
      settings={settings}
      sheetUrl={sheetUrl}
      folderUrl={folderUrl}
      error={error}
    />
  );
}
