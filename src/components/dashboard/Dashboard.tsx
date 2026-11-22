"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  Camera,
  CheckCircle2,
  CircleHelp,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Table2,
  Tag,
  Target,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/app/WorkspaceProvider";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import {
  ExpenseDialog,
  type ExpenseDialogInitial,
} from "@/components/dashboard/ExpenseDialog";
import { ExpenseTable } from "@/components/dashboard/ExpenseTable";
import { MonthSwitcher } from "@/components/dashboard/MonthSwitcher";
import { UploadCard } from "@/components/dashboard/UploadCard";
import { DriveImportButton } from "@/components/dashboard/DriveImportButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BatchImportDialog } from "@/components/dashboard/BatchImportDialog";
import { currentMonth, formatEuro, monthLabel, todayISO } from "@/lib/format";
import type {
  DriveImportResult,
  Expense,
  ExpensePayload,
  ExtractedReceipt,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user, expenses, settings, error, refresh } = useWorkspace();
  const [month, setMonth] = useState(currentMonth());
  const [creating, setCreating] = useState<ExpenseDialogInitial | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [batchImport, setBatchImport] = useState<DriveImportResult[] | null>(
    null,
  );

  const monthExpenses = useMemo(
    () =>
      month === "all"
        ? expenses
        : expenses.filter((expense) => expense.date.slice(0, 7) === month),
    [expenses, month],
  );

  const summary = useMemo(() => {
    const total = monthExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );
    const count = monthExpenses.length;
    const average = count > 0 ? total / count : 0;

    const totals = new Map<string, number>();
    for (const expense of monthExpenses) {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) + expense.amount,
      );
    }
    const topCategory =
      [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    return { total, count, average, topCategory };
  }, [monthExpenses]);

  const { total, count, average, topCategory } = summary;
  const hasAnyExpense = expenses.length > 0;

  const firstName = user.name?.split(" ")[0] || "vous";

  function handleExtracted(receipt: ExtractedReceipt) {
    setCreating({
      date: receipt.date,
      merchant: receipt.merchant,
      category: receipt.category,
      amount: receipt.amount,
      tva: receipt.tva,
      payment: receipt.payment,
      note: "",
      receiptUrl: receipt.fileUrl,
      warnings: receipt.warnings,
      rawText: receipt.rawText,
    });
  }

  async function createExpense(payload: ExpensePayload) {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Enregistrement impossible. Réessayez.");
    }

    toast.success("Ticket enregistré", {
      description: `${payload.merchant} · ${formatEuro(payload.amount)}`,
    });
    setMonth(payload.date.slice(0, 7));
    setCreating(null);
    try {
      await refresh();
    } catch {
      toast.error("Ticket enregistré, mais le tableau n'a pas pu se rafraîchir.");
    }
  }

  async function updateExpense(payload: ExpensePayload) {
    if (!editing) return;

    const response = await fetch(`/api/expenses/${editing.row}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Modification impossible. Réessayez.");
    }

    toast.success("Dépense mise à jour");
    setMonth(payload.date.slice(0, 7));
    setEditing(null);
    try {
      await refresh();
    } catch {
      toast.error("Dépense mise à jour, mais le tableau n'a pas pu se rafraîchir.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);

    try {
      const response = await fetch(`/api/expenses/${deleting.row}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Suppression impossible.");
      }

      toast.success("Dépense supprimée");
      setDeleting(null);
      try {
        await refresh();
      } catch {
        toast.error("Dépense supprimée, mais le tableau n'a pas pu se rafraîchir.");
      }
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "Suppression impossible.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-stone-500">Bonjour {firstName} 👋</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">
              Vos dépenses
            </h1>
            <p className="mt-1 text-[12px] capitalize text-stone-500">{monthLabel(month)}</p>
            <Link
              href="/app/aide"
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              <CircleHelp className="size-3.5" />
              Comment ça marche ?
            </Link>
          </div>
          <MonthSwitcher month={month} onChange={setMonth} />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-500">
              <TriangleAlert className="size-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-stone-900">
              Impossible de charger votre Google Sheet
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-stone-500">
              {error}
            </p>
            <a
              href="/api/auth/login"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              <RefreshCw className="size-4" />
              Se reconnecter
            </a>
          </div>
        ) : (
          <>
            {!hasAnyExpense && (
              <section className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50/60 p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <Sparkles className="size-3.5" />
                      Bienvenue {firstName} !
                    </span>
                    <h2 className="mt-3 text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
                      Votre premier ticket en 30 secondes
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-stone-700">
                      Pas de compte à créer, pas d&apos;application à installer.
                      Prenez une photo du ticket ou déposez son PDF : Caissette
                      remplit votre Google Sheet automatiquement.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <a
                        href="#ajouter"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        <Camera className="size-4" />
                        Ajouter mon premier ticket
                      </a>
                      <Link
                        href="/app/aide"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-[13.5px] font-medium text-stone-800 shadow-sm transition hover:border-stone-400"
                      >
                        <CircleHelp className="size-4 text-stone-500" />
                        Voir le guide
                      </Link>
                    </div>
                  </div>

                  <ol className="grid gap-2 sm:grid-cols-3 lg:w-[430px]">
                    {[
                      {
                        icon: Camera,
                        title: "1. Photographiez",
                        text: "Le ticket bien à plat, en entier.",
                      },
                      {
                        icon: CheckCircle2,
                        title: "2. Vérifiez",
                        text: "Date, magasin et montant sont pré-remplis.",
                      },
                      {
                        icon: Table2,
                        title: "3. C'est rangé",
                        text: "La ligne arrive dans votre Sheet.",
                      },
                    ].map(({ icon: Icon, title, text }) => (
                      <li
                        key={title}
                        className="rounded-xl border border-white bg-white/80 p-3 shadow-sm"
                      >
                        <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                          <Icon className="size-4" />
                        </span>
                        <p className="mt-2 text-[12px] font-semibold text-stone-900">
                          {title}
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-stone-600">
                          {text}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <StatCard
                label="Total"
                value={formatEuro(total)}
                hint={count > 0 ? `${count} ticket${count > 1 ? "s" : ""}` : "Aucun ticket"}
                icon={Wallet}
                tone="bg-emerald-50 text-emerald-700"
              />
              <StatCard
                label="Dépense moyenne"
                value={average > 0 ? formatEuro(average) : "—"}
                hint="par ticket"
                icon={Calculator}
                tone="bg-sky-50 text-sky-700"
              />
              <StatCard
                label="Nombre de tickets"
                value={String(count)}
                hint={`${formatEuro(total)} cumulés`}
                icon={ReceiptText}
                tone="bg-violet-50 text-violet-700"
              />
              <StatCard
                label="Top catégorie"
                value={topCategory ? topCategory[0] : "—"}
                hint={
                  topCategory && total > 0
                    ? `${Math.round((topCategory[1] / total) * 100)} % du total`
                    : "à découvrir"
                }
                icon={Tag}
                tone="bg-amber-50 text-amber-700"
                small={Boolean(topCategory)}
              />
            </div>

            <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
              <div className="space-y-6">
                <UploadCard onExtracted={handleExtracted}>
                  {settings.driveImportEnabled && (
                    <DriveImportButton onBatch={setBatchImport} />
                  )}
                </UploadCard>
                <ExpenseTable
                  expenses={monthExpenses}
                  onAdd={() =>
                    setCreating({
                      date: todayISO(),
                      category: settings.defaultCategory,
                      payment: "Carte bancaire",
                    })
                  }
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              </div>

              <aside className="space-y-6 lg:sticky lg:top-24">
                {month !== "all" && (
                  <BudgetCard
                    budget={settings.monthlyBudget}
                    spent={total}
                    label={monthLabel(month)}
                  />
                )}
                <CategoryBreakdown expenses={monthExpenses} />

                <section className="rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white to-stone-50 p-4 shadow-sm sm:p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                    <Sparkles className="size-4 text-emerald-600" />
                    Pour un bon scan
                  </h2>
                  <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-stone-600">
                    <li className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-stone-300" />
                      Posez le ticket bien à plat, sans ombre.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-stone-300" />
                      Cadrez tout le ticket, du magasin au total.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-stone-300" />
                      Évitez les reflets et les plis.
                    </li>
                  </ul>
                  <p className="mt-4 flex items-start gap-1.5 border-t border-stone-200/70 pt-3 text-[11px] leading-relaxed text-stone-500">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                    Feuille et justificatifs restent dans votre Google Drive.
                  </p>
                </section>
              </aside>
            </div>
          </>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/70 pt-5 text-[11px] text-stone-500">
          <p>Caissette · vos tickets, classés sans effort.</p>
          <p>OCR local · aucune donnée revendue</p>
        </footer>
      </main>

      {creating && (
        <ExpenseDialog
          key="create"
          mode="create"
          initial={creating}
          onClose={() => setCreating(null)}
          onSubmit={createExpense}
        />
      )}

      {editing && (
        <ExpenseDialog
          key={`edit-${editing.row}`}
          mode="edit"
          initial={{
            date: editing.date,
            merchant: editing.merchant,
            category: editing.category,
            amount: editing.amount,
            tva: editing.tva,
            payment: editing.payment,
            note: editing.note,
            receiptUrl: editing.receiptUrl,
          }}
          onClose={() => setEditing(null)}
          onSubmit={updateExpense}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer cette dépense ?"
          description={`« ${deleting.merchant} » (${formatEuro(deleting.amount)}) sera retirée de votre Google Sheet. Le ticket original reste dans votre Drive.`}
          confirmLabel="Supprimer"
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {batchImport && (
        <BatchImportDialog
          results={batchImport}
          onClose={() => setBatchImport(null)}
          onImported={async () => {
            try {
              await refresh();
            } catch {
              toast.error(
                "Tickets importés, mais le tableau n'a pas pu se rafraîchir.",
              );
            }
          }}
        />
      )}
    </>
  );
}

function BudgetCard({
  budget,
  spent,
  label,
}: {
  budget: number | null;
  spent: number;
  label: string;
}) {
  if (!budget) {
    return (
      <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <Target className="size-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-stone-900">Budget mensuel</h2>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-stone-500">
          Fixez un budget pour voir immédiatement s'il vous reste de la marge.
        </p>
        <Link
          href="/app/settings"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          Définir un budget
        </Link>
      </section>
    );
  }

  const percent = budget > 0 ? (spent / budget) * 100 : 0;
  const remaining = budget - spent;

  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <Target className="size-3.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Budget</h2>
            <p className="text-[10px] capitalize text-stone-500">{label}</p>
          </div>
        </div>
        <Link
          href="/app/settings"
          className="text-[11px] text-stone-500 transition hover:text-stone-600 hover:underline"
        >
          Modifier
        </Link>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-lg font-semibold tabular-nums text-stone-900">
          {formatEuro(spent)}
        </p>
        <p className="text-[11px] text-stone-500">sur {formatEuro(budget)}</p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className={cn(
            "h-full rounded-full transition",
            percent >= 100
              ? "bg-rose-500"
              : percent >= 80
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
          style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
        />
      </div>

      <p
        className={cn(
          "mt-2 text-[11px]",
          remaining >= 0 ? "text-stone-500" : "text-rose-600",
        )}
      >
        {remaining >= 0
          ? `Reste ${formatEuro(remaining)}`
          : `Dépassement de ${formatEuro(Math.abs(remaining))}`}
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  small = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10.5px] font-medium uppercase tracking-wider text-stone-500">
          {label}
        </p>
        <span className={`grid size-7 place-items-center rounded-lg ${tone}`}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p
        className={`mt-2.5 truncate font-semibold tracking-tight tabular-nums text-stone-900 ${
          small ? "text-lg" : "text-xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11.5px] text-stone-600">{hint}</p>
    </div>
  );
}
