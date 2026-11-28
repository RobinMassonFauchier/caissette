"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  BadgePercent,
  Info,
  Plus,
  ReceiptText,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { fieldCompactClass } from "@/components/ui/field-styles";
import { formatEuro, parseAmountInput } from "@/lib/format";
import type { Category, ReceiptItem, ReceiptItemKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type EditableItem = {
  key: string;
  label: string;
  category: Category;
  quantity: string;
  unitPrice: string;
  amount: string;
  tva: number | null;
  tvaRate: number | null;
  savings: number;
  bold: boolean;
  kind: ReceiptItemKind;
};

let rowCounter = 0;

function nextKey(): string {
  rowCounter += 1;
  return `item-${rowCounter}`;
}

function toEditable(item: ReceiptItem): EditableItem {
  return {
    key: nextKey(),
    label: item.label,
    category: item.category,
    quantity: String(item.quantity || 1),
    unitPrice:
      item.unitPrice !== null
        ? item.unitPrice.toFixed(2).replace(".", ",")
        : "",
    amount: item.amount.toFixed(2).replace(".", ","),
    tva: item.tva,
    tvaRate: item.tvaRate,
    savings: item.savings,
    bold: item.bold,
    kind: item.kind,
  };
}

function fromEditable(row: EditableItem): ReceiptItem {
  const quantity = Math.max(1, Math.round(parseAmountInput(row.quantity) ?? 1));
  const amountInput = parseAmountInput(row.amount);
  const unitInput = parseAmountInput(row.unitPrice);

  let amount = amountInput !== null && amountInput > 0 ? amountInput : 0;
  let unitPrice =
    unitInput !== null && unitInput > 0 ? unitInput : null;

  if (amount === 0 && unitPrice !== null) {
    amount = Math.round(unitPrice * quantity * 100) / 100;
  }
  if (row.kind === "discount") {
    unitPrice = null;
  } else if (amount > 0) {
    unitPrice = Math.round((amount / quantity) * 100) / 100;
  }

  const tva =
    row.tvaRate !== null && amount > 0
      ? Math.round(
          (amount - amount / (1 + row.tvaRate / 100)) * 100,
        ) / 100
      : row.tva;

  return {
    label: row.label.trim() || "Article",
    category: row.category,
    quantity,
    unitPrice,
    amount,
    tva,
    tvaRate: row.tvaRate,
    savings:
      row.kind === "discount"
        ? amount
        : Math.min(row.savings, Math.max(0, amount)),
    bold: row.bold,
    kind: row.kind,
  };
}

function itemsTotal(items: ReceiptItem[]): number {
  return Math.round(
    items.reduce(
      (sum, item) =>
        item.kind === "discount" ? sum - item.amount : sum + item.amount,
      0,
    ) * 100,
  ) / 100;
}

export function ItemsEditor({
  items,
  onChange,
  defaultCategory,
  ticketTotal,
}: {
  items: ReceiptItem[];
  onChange: (items: ReceiptItem[]) => void;
  defaultCategory: Category;
  ticketTotal: number | null;
}) {
  const [rows, setRows] = useState<EditableItem[]>(() =>
    items.map(toEditable),
  );
  const lastEmitted = useRef<ReceiptItem[] | null>(null);

  // Les articles peuvent arriver après le premier rendu (OCR asynchrone).
  useEffect(() => {
    if (items === lastEmitted.current) return;
    setRows(items.map(toEditable));
  }, [items]);

  function emit(nextRows: EditableItem[]) {
    setRows(nextRows);
    const nextItems = nextRows.map(fromEditable).filter((item) => item.amount > 0);
    lastEmitted.current = nextItems;
    onChange(nextItems);
  }

  function updateRow(key: string, patch: Partial<EditableItem>) {
    emit(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addItem(kind: ReceiptItemKind) {
    const row: EditableItem = {
      key: nextKey(),
      label: kind === "discount" ? "Remise" : "Nouvel article",
      category: defaultCategory,
      quantity: "1",
      unitPrice: "",
      amount: "",
      tva: null,
      tvaRate: null,
      savings: 0,
      bold: false,
      kind,
    };
    emit([...rows, row]);
  }

  function removeRow(key: string) {
    emit(rows.filter((row) => row.key !== key));
  }

  const currentItems = rows
    .map(fromEditable)
    .filter((item) => item.amount > 0);
  const total = itemsTotal(currentItems);
  const savings = currentItems.reduce((sum, item) => sum + item.savings, 0);
  const tva = currentItems.reduce((sum, item) => sum + (item.tva ?? 0), 0);
  const difference =
    ticketTotal !== null ? Math.round((ticketTotal - total) * 100) / 100 : null;
  const reconciled = difference !== null && Math.abs(difference) < 0.06;

  return (
    <section className="rounded-xl border border-stone-200 bg-stone-50/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-white text-stone-500 ring-1 ring-inset ring-stone-200">
            <ReceiptText className="size-3.5" />
          </span>
          <div>
            <h3 className="text-[12.5px] font-semibold text-stone-800">
              Détail des articles
            </h3>
            <p className="text-[10.5px] text-stone-500">
              {currentItems.length} ligne{currentItems.length > 1 ? "s" : ""}
              {savings > 0 ? ` · ${formatEuro(savings)} économisés` : ""}
              {tva > 0 ? ` · TVA ${formatEuro(tva)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => addItem("item")}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:border-stone-400"
          >
            <Plus className="size-3" />
            Article
          </button>
          <button
            type="button"
            onClick={() => addItem("discount")}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 transition hover:border-amber-300"
          >
            <BadgePercent className="size-3" />
            Remise
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-[12px] leading-relaxed text-stone-600">
            Aucun article n&apos;a été lu sur ce ticket. Vous pouvez les ajouter
            à la main, ou enregistrer uniquement le total.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-stone-200/70">
          {rows.map((row) => {
            const editableItem = fromEditable(row);
            const isDiscount = row.kind === "discount";
            return (
              <li key={row.key} className="px-3 py-2.5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_58px_92px_92px_148px_auto] sm:items-center">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateRow(row.key, { bold: !row.bold })
                      }
                      aria-pressed={row.bold}
                      aria-label={
                        row.bold
                          ? "Retirer la mise en avant"
                          : "Mettre l'article en avant"
                      }
                      title="Article mis en avant sur le ticket"
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md border text-[11px] transition",
                        row.bold
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-stone-200 bg-white text-stone-400 hover:text-stone-600",
                      )}
                    >
                      <Bold className="size-3.5" />
                    </button>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(event) =>
                        updateRow(row.key, { label: event.target.value })
                      }
                      maxLength={120}
                      className={cn(
                        fieldCompactClass,
                        "min-w-0",
                        row.bold && "font-semibold text-stone-900",
                        isDiscount && "text-amber-800",
                      )}
                      aria-label={`Libellé de l'article ${row.label}`}
                    />
                  </div>

                  <label className="flex items-center gap-1">
                    <span className="sr-only">Quantité</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.key, { quantity: event.target.value })
                      }
                      className={cn(fieldCompactClass, "px-1.5 text-center tabular-nums")}
                      aria-label="Quantité"
                    />
                  </label>

                  <label className="flex items-center gap-1">
                    <span className="sr-only">Prix unitaire</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(event) =>
                        updateRow(row.key, {
                          unitPrice: event.target.value,
                          amount: "",
                        })
                      }
                      placeholder="P.U."
                      className={cn(
                        fieldCompactClass,
                        "px-1.5 text-right tabular-nums",
                      )}
                      aria-label="Prix unitaire"
                    />
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) =>
                        updateRow(row.key, { amount: event.target.value })
                      }
                      placeholder="0,00"
                      className={cn(
                        fieldCompactClass,
                        "pr-5 text-right tabular-nums",
                      )}
                      aria-label="Montant de la ligne"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[10px] text-stone-500">
                      €
                    </span>
                  </div>

                  <CategorySelect
                    value={row.category}
                    onChange={(value) => {
                      if (value !== "all") {
                        updateRow(row.key, { category: value });
                      }
                    }}
                    ariaLabel={`Catégorie de ${row.label}`}
                    className="min-h-9 text-[12px]"
                  />

                  <div className="flex items-center justify-end gap-1">
                    {row.savings > 0 && !isDiscount && (
                      <span className="hidden rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 sm:inline">
                        −{formatEuro(row.savings)}
                      </span>
                    )}
                    {isDiscount && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                        Remise
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Supprimer ${row.label}`}
                      className="grid size-7 place-items-center rounded-md text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-9 text-[10px] text-stone-500">
                  {editableItem.kind !== "discount" &&
                    editableItem.quantity > 1 &&
                    editableItem.unitPrice !== null && (
                      <span>
                        {editableItem.quantity} ×{" "}
                        {formatEuro(editableItem.unitPrice)} ={" "}
                        {formatEuro(editableItem.amount)}
                      </span>
                    )}
                  {editableItem.tva !== null && editableItem.tva > 0 && (
                    <span>
                      TVA
                      {editableItem.tvaRate !== null
                        ? ` ${editableItem.tvaRate.toFixed(1).replace(".", ",")} %`
                        : ""}{" "}
                      · {formatEuro(editableItem.tva)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {ticketTotal !== null && currentItems.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/80 px-3.5 py-2.5 text-[11.5px]",
            reconciled ? "text-stone-600" : "text-amber-800",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {reconciled ? (
              <Info className="size-3.5" />
            ) : (
              <TriangleAlert className="size-3.5" />
            )}
            Somme des articles : <strong>{formatEuro(total)}</strong>
          </span>
          <span>
            {reconciled
              ? "Correspond au total du ticket."
              : `Écart de ${formatEuro(Math.abs(difference ?? 0))} avec le total (${formatEuro(ticketTotal)}).`}
          </span>
        </div>
      )}
    </section>
  );
}
