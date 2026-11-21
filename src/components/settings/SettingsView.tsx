"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  FolderOpen,
  Gauge,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { parseAmountInput } from "@/lib/format";
import type { AppSettings } from "@/lib/settings";
import type { Category, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 focus-visible:outline-offset-2",
        checked ? "bg-emerald-600" : "bg-stone-300",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "ml-0.5 size-5 rounded-full bg-white shadow-sm transition",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

export function SettingsView({
  user,
  settings,
  sheetUrl,
  folderUrl,
  error,
}: {
  user: SessionUser;
  settings: AppSettings;
  sheetUrl: string;
  folderUrl: string;
  error: string | null;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(
    settings.monthlyBudget
      ? String(settings.monthlyBudget).replace(".", ",")
      : "",
  );
  const [defaultCategory, setDefaultCategory] = useState<Category>(
    settings.defaultCategory,
  );
  const [driveImportEnabled, setDriveImportEnabled] = useState(
    settings.driveImportEnabled,
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setFormError(null);
    setSaved(false);

    let monthlyBudget: number | null = null;
    if (budget.trim()) {
      const parsed = parseAmountInput(budget);
      if (parsed === null || parsed <= 0) {
        setFormError("Saisissez un budget mensuel valide, ou laissez vide.");
        return;
      }
      monthlyBudget = Math.round(parsed * 100) / 100;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyBudget,
          defaultCategory,
          driveImportEnabled,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Enregistrement impossible.");
      }
      setSaved(true);
      toast.success("Paramètres enregistrés");
      router.refresh();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Enregistrement impossible.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const initials = (user.name || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader user={user} sheetUrl={sheetUrl} active="settings" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-7">
          <p className="text-[13px] text-stone-500">Votre compte et vos préférences</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">
            Paramètres
          </h1>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Impossible de charger vos paramètres.</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
              <a
                href="/api/auth/login"
                className="mt-2 inline-block font-medium underline underline-offset-2"
              >
                Se reconnecter
              </a>
            </div>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                  <Gauge className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-stone-900">
                    Budget et préférences
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Ces choix s'appliquent à votre tableau de bord.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
                    Budget mensuel
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="Par exemple 900,00"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 pr-9 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-400">
                      €
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-stone-400">
                    Laissez vide pour ne pas afficher de budget.
                  </span>
                </label>

                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
                    Catégorie par défaut
                  </span>
                  <CategorySelect
                    value={defaultCategory}
                    onChange={(value) => {
                      if (value !== "all") setDefaultCategory(value);
                    }}
                    ariaLabel="Catégorie par défaut"
                    className="!py-2"
                  />
                  <span className="mt-1 block text-[11px] text-stone-400">
                    Proposition lors d'un ajout manuel.
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/10">
                  <FolderOpen className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-stone-900">
                    Intégrations
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Récupération de vos justificatifs.
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-stone-100">
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-stone-800">
                      Import depuis Google Drive
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
                      Affiche un bouton pour choisir un PDF ou une photo déjà
                      présent dans votre Drive, sans le retélécharger.
                    </p>
                  </div>
                  <Toggle
                    checked={driveImportEnabled}
                    onChange={setDriveImportEnabled}
                    label="Activer l'import Google Drive"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-[13px] font-medium text-stone-800">
                      Gmail
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                        Non activé
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
                      La lecture de Gmail est une autorisation restreinte par
                      Google : elle impose une vérification de l'application et
                      réactiverait l'avertissement. Elle reste désactivée pour
                      garder Caissette simple et sans avertissement.
                    </p>
                  </div>
                  <Toggle
                    checked={false}
                    onChange={() => undefined}
                    disabled
                    label="Gmail désactivé"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/10">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-stone-900">
                    Vos données
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Tout reste dans votre compte Google.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={sheetUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-white"
                >
                  Ouvrir le Google Sheet
                  <ExternalLink className="size-3.5 text-stone-400" />
                </a>
                <a
                  href={folderUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-white"
                >
                  Ouvrir le dossier des tickets
                  <ExternalLink className="size-3.5 text-stone-400" />
                </a>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
                Caissette ne stocke aucune donnée sur son serveur. La feuille et
                les justificatifs restent dans votre Drive.
              </p>
            </section>

            {formError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
                  <Check className="size-3.5" />
                  Enregistré
                </span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving || Boolean(error)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" strokeWidth={2.5} />
                )}
                Enregistrer les paramètres
              </button>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
              <div className="flex flex-col items-center text-center">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-16 rounded-full object-cover ring-4 ring-stone-100"
                  />
                ) : (
                  <span className="grid size-16 place-items-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-700 ring-4 ring-stone-100">
                    {initials}
                  </span>
                )}
                <p className="mt-3 text-sm font-semibold text-stone-900">
                  {user.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-500">
                  <Mail className="size-3" />
                  {user.email}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Compte Google connecté
                </span>
              </div>

              <div className="mt-5 border-t border-stone-100 pt-4">
                <a
                  href="/api/auth/logout"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-[12.5px] font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  <LogOut className="size-3.5" />
                  Se déconnecter
                </a>
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white to-stone-50 p-5 shadow-sm">
              <p className="flex items-center gap-2 text-[12px] font-semibold text-stone-800">
                <ShieldCheck className="size-4 text-emerald-600" />
                Confidentialité
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
                Aucune donnée n'est revendue. L'import Drive utilise uniquement
                les fichiers que vous sélectionnez. Gmail n'est pas demandé.
              </p>
              <a
                href="/confidentialite"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
              >
                Lire la politique de confidentialité
                <ExternalLink className="size-3" />
              </a>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
