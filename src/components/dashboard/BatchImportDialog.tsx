"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ExternalLink,
  Loader2,
  Paperclip,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { formatEuro, parseAmountInput, todayISO } from "@/lib/format";
import type { Category, DriveImportResult, ExpensePayload } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  selected: boolean;
  fileName: string;
  date: string;
  merchant: string;
  amount: string;
  tva: string;
  category: Category;
  payment: string;
  receiptUrl: string;
  warnings: string[];
};

function cents(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function BatchImportDialog({
  results,
  onClose,
  onImported,
}: {
  results: DriveImportResult[];
  onClose: () => void;
  onImported: () => Promise<void> | void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    results.map((result, index) => ({
      id: result.fileId || String(index),
      selected: Boolean(result.merchant && result.amount !== null),
      fileName: result.fileName,
      date: result.date || todayISO(),
      merchant: result.merchant,
      amount: result.amount !== null ? cents(result.amount) : "",
      tva: result.tva !== null ? cents(result.tva) : "",
      category: result.category,
      payment: result.payment,
      receiptUrl: result.fileUrl,
      warnings: result.warnings,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = rows.filter((row) => row.selected).length;
  const total = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (!row.selected) return sum;
        return sum + (parseAmountInput(row.amount) ?? 0);
      }, 0),
    [rows],
  );

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function toggleAll() {
    const allSelected = rows.every((row) => row.selected);
    setRows((current) =>
      current.map((row) => ({ ...row, selected: !allSelected })),
    );
  }

  async function importAll() {
    setError(null);
    const selected = rows.filter((row) => row.selected);

    if (selected.length === 0) {
      setError("Sélectionnez au moins un ticket.");
      return;
    }

    const payloads: ExpensePayload[] = [];

    for (const row of selected) {
      if (!row.date || !row.merchant.trim()) {
        setError(
          `Ticket « ${row.fileName} » : renseignez la date et le magasin.`,
        );
        return;
      }
      const amount = parseAmountInput(row.amount);
      if (amount === null || amount <= 0) {
        setError(`Ticket « ${row.fileName} » : montant invalide.`);
        return;
      }
      const tva = row.tva.trim() ? parseAmountInput(row.tva) : null;
      if (tva !== null && (tva < 0 || tva > amount)) {
        setError(`Ticket « ${row.fileName} » : TVA invalide.`);
        return;
      }

      payloads.push({
        date: row.date,
        merchant: row.merchant.trim(),
        category: row.category,
        amount: Math.round(amount * 100) / 100,
        tva: tva === null ? null : Math.round(tva * 100) / 100,
        payment: row.payment,
        note: "",
        receiptUrl: row.receiptUrl,
      });
    }

    setSaving(true);
    try {
      const response = await fetch("/api/expenses/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses: payloads }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Import impossible.");
      }

      toast.success(
        `${payloads.length} ticket${payloads.length > 1 ? "s" : ""} importé${payloads.length > 1 ? "s" : ""}`,
        { description: "Vous pouvez corriger les lignes dans le tableau." },
      );
      await onImported();
      onClose();
    } catch (importError) {
      const message =
        importError instanceof Error ? importError.message : "Import impossible.";
      setError(message);
      toast.error(message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Tickets trouvés dans Google Drive"
      subtitle="Vérifiez les champs. Les tickets incomplets sont décochés."
      onClose={onClose}
      width="sm:max-w-3xl"
      footer={
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-[12px] text-stone-500">
            <button
              type="button"
              onClick={toggleAll}
              className="font-medium text-emerald-700 hover:underline"
            >
              {rows.every((row) => row.selected)
                ? "Tout décocher"
                : "Tout sélectionner"}
            </button>
            <span className="text-stone-300">·</span>
            <span>
              {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""} ·{" "}
              {formatEuro(total)}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={importAll}
              disabled={saving || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" strokeWidth={2.5} />
              )}
              Importer {selectedCount > 0 ? selectedCount : ""} ticket
              {selectedCount > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </p>
        )}

        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "rounded-xl border p-3 transition",
              row.selected
                ? "border-emerald-200 bg-emerald-50/30"
                : "border-stone-200 bg-white",
            )}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={(event) =>
                  updateRow(row.id, { selected: event.target.checked })
                }
                className="mt-0.5 size-4 shrink-0 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                aria-label={`Importer ${row.fileName}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium text-stone-500">
                    <Paperclip className="size-3 shrink-0" />
                    <span className="truncate">{row.fileName}</span>
                  </p>
                  {row.receiptUrl && (
                    <a
                      href={row.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-stone-400 hover:text-emerald-700"
                    >
                      Ouvrir
                      <ExternalLink className="size-2.5" />
                    </a>
                  )}
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_105px_150px]">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(event) =>
                      updateRow(row.id, { date: event.target.value })
                    }
                    className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[12px] text-stone-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    aria-label="Date"
                  />
                  <input
                    type="text"
                    value={row.merchant}
                    onChange={(event) =>
                      updateRow(row.id, { merchant: event.target.value })
                    }
                    placeholder="Magasin"
                    className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[12px] text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    aria-label="Magasin"
                  />
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) =>
                        updateRow(row.id, { amount: event.target.value })
                      }
                      placeholder="0,00"
                      className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 pr-6 text-[12px] tabular-nums text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                      aria-label="Montant"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] text-stone-400">
                      €
                    </span>
                  </div>
                  <CategorySelect
                    value={row.category}
                    onChange={(value) => {
                      if (value !== "all") updateRow(row.id, { category: value });
                    }}
                    ariaLabel="Catégorie"
                    className="!py-1.5 !text-[12px]"
                  />
                </div>

                {row.warnings.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-700">
                    <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                    {row.warnings.join(" ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
