"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleHelp,
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
import { useWorkspace } from "@/components/app/WorkspaceProvider";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { fieldClass } from "@/components/ui/field-styles";
import { parseAmountInput } from "@/lib/format";
import type { Category } from "@/lib/types";
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

export function SettingsView() {
  const { user, settings, sheetUrl, folderId, error, setSettings } =
    useWorkspace();
  const folderUrl = folderId
    ? `https://drive.google.com/drive/folders/${folderId}`
    : "";
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

  const parsedBudget = budget.trim() ? parseAmountInput(budget) : null;
  const budgetChanged =
    budget.trim() === ""
      ? settings.monthlyBudget !== null
      : parsedBudget === null
        ? true
        : parsedBudget !== settings.monthlyBudget;

  const dirty =
    budgetChanged ||
    defaultCategory !== settings.defaultCategory ||
    driveImportEnabled !== settings.driveImportEnabled;

  useEffect(() => {
    if (!dirty || saving) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

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
      if (data.settings) setSettings(data.settings);
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
    <>
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
                      onChange={(event) => {
                        setBudget(event.target.value);
                        setSaved(false);
                      }}
                      placeholder="Par exemple 900,00"
                      className={cn(fieldClass, "pr-9")}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-500">
                      €
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-stone-500">
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
                      if (value !== "all") {
                        setDefaultCategory(value);
                        setSaved(false);
                      }
                    }}
                    ariaLabel="Catégorie par défaut"
                  />
                  <span className="mt-1 block text-[11px] text-stone-500">
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
                    onChange={(value) => {
                      setDriveImportEnabled(value);
                      setSaved(false);
                    }}
                    label="Activer l'import Google Drive"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-[13px] font-medium text-stone-800">
                      Gmail
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10.5px] font-medium text-stone-600">
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
                  <ExternalLink className="size-3.5 text-stone-500" />
                </a>
                <a
                  href={folderUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-white"
                >
                  Ouvrir le dossier des tickets
                  <ExternalLink className="size-3.5 text-stone-500" />
                </a>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
                Caissette ne stocke aucune donnée sur son serveur. La feuille et
                les justificatifs restent dans votre Drive.
              </p>
            </section>

            {formError && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700"
              >
                {formError}
              </p>
            )}

            <div className="sticky bottom-20 z-10 -mx-4 flex flex-col gap-2 border-t border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "flex items-center gap-1.5 text-[12px]",
                  dirty ? "text-amber-700" : "text-stone-500",
                )}
              >
                {dirty ? (
                  <>
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Modifications non enregistrées
                  </>
                ) : saved ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    Paramètres enregistrés
                  </>
                ) : (
                  <>
                    <Check className="size-3.5 text-stone-500" />
                    Vos paramètres sont à jour
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={save}
                disabled={saving || Boolean(error) || !dirty}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
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

            <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-stone-800">
                <CircleHelp className="size-4 text-emerald-600" />
                Besoin d&apos;aide ?
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-stone-600">
                Ajouter un ticket, comprendre les statistiques, installer
                Caissette sur votre téléphone : le guide répond aux questions
                courantes en langage simple.
              </p>
              <Link
                href="/app/aide"
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline"
              >
                Ouvrir le guide
                <ArrowRight className="size-3" />
              </Link>
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
    </>
  );
}
