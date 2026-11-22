"use client";

import { useState } from "react";
import {
  Check,
  Loader2,
  Paperclip,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CategorySelect } from "@/components/ui/CategorySelect";
import {
  PAYMENT_METHODS,
} from "@/lib/catalog";
import { parseAmountInput, todayISO } from "@/lib/format";
import type { Category, ExpensePayload, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ExpenseDialogInitial = {
  date?: string;
  merchant?: string;
  category?: Category;
  amount?: number | null;
  tva?: number | null;
  payment?: string;
  note?: string;
  receiptUrl?: string;
  warnings?: string[];
  rawText?: string;
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition placeholder:text-stone-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

function cents(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function ExpenseDialog({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: ExpenseDialogInitial;
  onClose: () => void;
  onSubmit: (payload: ExpensePayload) => Promise<void>;
}) {
  const [date, setDate] = useState(initial.date || todayISO());
  const [merchant, setMerchant] = useState(initial.merchant || "");
  const [category, setCategory] = useState<Category>(initial.category || "Alimentation");
  const [amount, setAmount] = useState(
    initial.amount !== null && initial.amount !== undefined ? cents(initial.amount) : "",
  );
  const [tva, setTva] = useState(
    initial.tva !== null && initial.tva !== undefined ? cents(initial.tva) : "",
  );
  const [payment, setPayment] = useState(initial.payment || "Carte bancaire");
  const [note, setNote] = useState(initial.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentOptions = (PAYMENT_METHODS as string[]).includes(payment)
    ? (PAYMENT_METHODS as string[])
    : [payment, ...(PAYMENT_METHODS as string[])];

  const warnings = initial.warnings ?? [];
  const isScanned = Boolean(initial.rawText);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!date) {
      setError("Choisissez une date.");
      return;
    }
    if (!merchant.trim()) {
      setError("Indiquez le nom du magasin.");
      return;
    }

    const amountValue = parseAmountInput(amount);
    if (amountValue === null || amountValue <= 0) {
      setError("Saisissez un montant valide (par exemple 12,50).");
      return;
    }

    const tvaValue = tva.trim() ? parseAmountInput(tva) : null;
    if (tvaValue !== null && (tvaValue < 0 || tvaValue > amountValue)) {
      setError("La TVA doit être comprise entre 0 et le montant total.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        date,
        merchant: merchant.trim(),
        category,
        amount: Math.round(amountValue * 100) / 100,
        tva: tvaValue === null ? null : Math.round(tvaValue * 100) / 100,
        payment,
        note: note.trim(),
        receiptUrl: initial.receiptUrl || "",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Enregistrement impossible. Réessayez.",
      );
      setSaving(false);
    }
  }

  return (
    <Modal
      title={mode === "create" ? "Nouveau ticket" : "Modifier la dépense"}
      subtitle={
        mode === "create"
          ? isScanned
            ? "Vérifiez les informations lues sur le ticket avant de l'enregistrer."
            : "Renseignez les informations de la dépense."
          : "Corrigez les informations puis enregistrez."
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-xs text-stone-500 sm:block">
            Enregistré dans votre Google Sheet
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 sm:flex-none"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="expense-form"
              disabled={saving}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-none"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" strokeWidth={2.5} />
              )}
              {mode === "create" ? "Enregistrer le ticket" : "Mettre à jour"}
            </button>
          </div>
        </div>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
        {isScanned && warnings.length === 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-[13px] font-medium text-emerald-900">
                Ticket lu automatiquement
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-800">
                Vérifiez surtout la date, le magasin et le montant, puis
                enregistrez. Tout reste modifiable plus tard.
              </p>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-amber-900">
              <TriangleAlert className="size-4" />
              À vérifier
            </p>
            <ul className="mt-1.5 space-y-1 pl-6 text-[12px] leading-relaxed text-amber-800">
              {warnings.map((warning) => (
                <li key={warning} className="list-disc">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Date <span className="text-rose-500">*</span>
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Montant <span className="text-rose-500">*</span>
            </span>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0,00"
                className={cn(inputClass, "pr-9 tabular-nums")}
                required
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-500">
                €
              </span>
            </div>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Magasin ou commerce <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              placeholder="Carrefour Market"
              className={inputClass}
              maxLength={120}
              data-autofocus
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Catégorie
            </span>
            <CategorySelect
              value={category}
              onChange={(value) => {
                if (value !== "all") setCategory(value);
              }}
              ariaLabel="Catégorie de la dépense"
              className="!py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Moyen de paiement
            </span>
            <select
              value={payment}
              onChange={(event) => setPayment(event.target.value)}
              className={inputClass}
            >
              {paymentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              TVA <span className="font-normal text-stone-500">(facultatif)</span>
            </span>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={tva}
                onChange={(event) => setTva(event.target.value)}
                placeholder="0,00"
                className={cn(inputClass, "pr-9 tabular-nums")}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-500">
                €
              </span>
            </div>
            <span className="mt-1 block text-[11px] leading-relaxed text-stone-500">
              Montant de TVA indiqué sur certains tickets. Laissez vide si vous
              ne le connaissez pas.
            </span>
          </label>

          <div className="hidden items-end pb-1 sm:flex">
            {initial.receiptUrl && (
              <a
                href={initial.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                <Paperclip className="size-3.5" />
                Voir le ticket original
              </a>
            )}
          </div>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Note <span className="font-normal text-stone-500">(facultatif)</span>
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Courses de la semaine, essence, cadeau…"
              className={cn(inputClass, "resize-none")}
            />
          </label>
        </div>

        {initial.receiptUrl && (
          <a
            href={initial.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 hover:underline sm:hidden"
          >
            <Paperclip className="size-3.5" />
            Voir le ticket original
          </a>
        )}

        {initial.rawText && (
          <details className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
            <summary className="cursor-pointer text-xs font-medium text-stone-600">
              Texte lu sur le ticket
            </summary>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-stone-500">
              {initial.rawText}
            </pre>
          </details>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
