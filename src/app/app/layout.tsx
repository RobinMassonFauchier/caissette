import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/AppHeader";
import { WorkspaceProvider } from "@/components/app/WorkspaceProvider";
import { getSession, isGoogleConfigured } from "@/lib/session";
import { getAuthClient } from "@/lib/google";
import { ensureWorkspace, readExpenses } from "@/lib/sheet";
import { DEFAULT_SETTINGS, readSettings, type AppSettings } from "@/lib/settings";
import { defaultProfile, readProfile } from "@/lib/profile";
import { describeGoogleError } from "@/lib/google-errors";
import type { Expense, UserProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isGoogleConfigured()) redirect("/?error=config");

  const session = await getSession();
  if (!session.refreshToken || !session.user) redirect("/");

  let expenses: Expense[] = [];
  let settings: AppSettings = DEFAULT_SETTINGS;
  let profile: UserProfile = defaultProfile(session.user);
  let sheetUrl = "";
  let folderId = "";
  let error: string | null = null;

  try {
    const auth = await getAuthClient(session.refreshToken);
    const workspace = await ensureWorkspace(auth);
    sheetUrl = workspace.spreadsheetUrl;
    folderId = workspace.folderId;
    const [rows, loadedSettings, loadedProfile] = await Promise.all([
      readExpenses(auth, workspace.spreadsheetId),
      readSettings(auth, workspace.folderId),
      readProfile(auth, workspace.folderId, session.user).catch((profileError) => {
        console.error("Chargement du profil impossible :", profileError);
        return defaultProfile(session.user!);
      }),
    ]);
    expenses = rows;
    settings = loadedSettings;
    profile = loadedProfile;
  } catch (err) {
    console.error("Chargement de l'espace de travail impossible :", err);
    error = describeGoogleError(err);
  }

  return (
    <WorkspaceProvider
      initial={{
        user: session.user,
        profile,
        expenses,
        settings,
        sheetUrl,
        folderId,
        error,
      }}
    >
      <div
        id="contenu"
        tabIndex={-1}
        className="min-h-screen bg-stone-50 pb-safe-nav outline-none md:pb-0"
      >
        <AppHeader user={session.user} profile={profile} sheetUrl={sheetUrl} />
        {children}
      </div>
    </WorkspaceProvider>
  );
}
