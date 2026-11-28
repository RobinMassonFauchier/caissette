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
import { PaymentSelect } from "@/components/ui/PaymentSelect";
import { ItemsEditor } from "@/components/ui/ItemsEditor";
import { fieldClass } from "@/components/ui/field-styles";
import { parseAmountInput, todayISO } from "@/lib/format";
import type {
  Category,
  ExpensePayload,
  ReceiptItem,
} from "@/lib/types";
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
  items?: ReceiptItem[];
  savings?: number;
  ticketSavings?: number;
  updatedAt?: string;
  warnings?: string[];
  rawText?: string;
  defaultCategory?: Category;
};

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
  const [category, setCategory] = useState<Category>(
    initial.category || initial.defaultCategory || "Alimentation",
  );
  const [amount, setAmount] = useState(
    initial.amount !== null && initial.amount !== undefined
      ? cents(initial.amount)
      : "",
  );
  const [payment, setPayment] = useState(initial.payment || "Carte bancaire");
  const [note, setNote] = useState(initial.note || "");
  const [items, setItems] = useState<ReceiptItem[]>(initial.items ?? []);
  const [itemsTouched, setItemsTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warnings = initial.warnings ?? [];
  const isScanned = Boolean(initial.rawText);
  const defaultCategory = initial.defaultCategory || category;
  const itemDefaultCategory =
    initial.category && initial.category !== "Divers"
      ? initial.category
      : defaultCategory;

  const itemTva =
    items.reduce((sum, item) => sum + (item.tva ?? 0), 0) || null;
  const amountForDisplay = parseAmountInput(amount);
  const legacyTicketTva =
    initial.tva !== null &&
    initial.tva !== undefined &&
    amountForDisplay !== null &&
    initial.tva <= amountForDisplay
      ? initial.tva
      : null;
  const displayedTva = itemTva ?? legacyTicketTva;

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

    const payload: ExpensePayload = {
      date,
      merchant: merchant.trim(),
      category,
      amount: Math.round(amountValue * 100) / 100,
      payment,
      note: note.trim(),
      receiptUrl: initial.receiptUrl || "",
    };

    // La TVA globale n'est envoyée qu'à la création. En modification, le
    // serveur conserve celle du ticket (ou la recalcule depuis les articles)
    // pour ne jamais bloquer un changement de montant.
    if (
      mode === "create" &&
      initial.tva !== null &&
      initial.tva !== undefined &&
      initial.tva <= amountValue
    ) {
      payload.ticketTva = initial.tva;
    }

    // En création, les articles sont toujours transmis. En modification, on ne
    // les envoie que s'ils ont réellement changé : un ancien ticket V1 conserve
    // ainsi sa TVA héritée, et une modification de date ne réécrit pas le détail.
    const initialItems = initial.items ?? [];
    const itemsChanged =
      itemsTouched &&
      JSON.stringify(items) !== JSON.stringify(initialItems);

    if (mode === "create" || itemsChanged) {
      payload.items = items;
      payload.ticketSavings = Math.min(
        initial.ticketSavings ?? 0,
        amountValue,
      );
    }
    if (mode === "edit") {
      payload.expectedUpdatedAt = initial.updatedAt ?? "";
    }

    setSaving(true);
    try {
      await onSubmit(payload);
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
          : "Corrigez les informations puis enregistrez. Seuls les champs modifiés sont réécrits."
      }
      onClose={onClose}
      width="sm:max-w-3xl"
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
                Vérifiez la date, le magasin, le montant et le détail des
                articles. Tout reste modifiable plus tard.
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
              className={fieldClass}
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
                className={cn(fieldClass, "pr-9 tabular-nums")}
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
              className={fieldClass}
              maxLength={120}
              data-autofocus
              required
            />
          </label>

          <div className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Catégorie
            </span>
            <CategorySelect
              value={category}
              onChange={(value) => {
                if (value !== "all") setCategory(value);
              }}
              ariaLabel="Catégorie de la dépense"
            />
          </div>

          <div className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
              Moyen de paiement
            </span>
            <PaymentSelect
              value={payment}
              onChange={setPayment}
              ariaLabel="Moyen de paiement"
            />
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
              className={cn(fieldClass, "resize-none")}
            />
          </label>
        </div>

        <ItemsEditor
          items={items}
          onChange={(next) => {
            setItems(next);
            setItemsTouched(true);
          }}
          defaultCategory={itemDefaultCategory}
          ticketTotal={parseAmountInput(amount)}
        />

        {displayedTva !== null && displayedTva > 0 && (
          <p className="text-[11px] leading-relaxed text-stone-500">
            TVA {itemTva ? "calculée à partir des articles" : "enregistrée sur ce ticket"} :{" "}
            <strong className="text-stone-700">
              {displayedTva.toFixed(2).replace(".", ",")} €
            </strong>
            . Elle n&apos;est plus saisie globalement : chaque article peut
            porter son propre taux, repris du ticket.
          </p>
        )}

        {(initial.ticketSavings ?? 0) > 0 && (
          <p className="text-[11px] leading-relaxed text-stone-500">
            Remise globale lue sur le ticket :{" "}
            <strong className="text-stone-700">
              {(initial.ticketSavings ?? 0).toFixed(2).replace(".", ",")} €
            </strong>
            . Elle est prise en compte dans les économies, sans double
            comptage.
          </p>
        )}

        {initial.receiptUrl && (
          <a
            href={initial.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700 hover:underline"
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
