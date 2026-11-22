"use client";

import { useMemo, useState } from "react";
import {
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import { CATEGORY_STYLES } from "@/lib/catalog";
import { formatDateShort, formatEuro } from "@/lib/format";
import type { Category, Expense } from "@/lib/types";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { fieldCompactClass } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

export function ExpenseTable({
  expenses,
  onAdd,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...expenses]
      .filter((expense) => category === "all" || expense.category === category)
      .filter((expense) => {
        if (!query) return true;
        return [
          expense.merchant,
          expense.category,
          expense.payment,
          expense.note,
          expense.date,
          formatEuro(expense.amount),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.row - a.row);
  }, [expenses, search, category]);

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const hasFilters = search.trim().length > 0 || category !== "all";

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Tickets</h2>
          <p className="text-[11px] text-stone-500">
            {filtered.length} dépense{filtered.length > 1 ? "s" : ""}
            {hasFilters ? " affichée(s)" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-0 sm:w-52 sm:flex-none">
            <label htmlFor="expense-search" className="sr-only">
              Rechercher dans les tickets
            </label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-500" />
            <input
              id="expense-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un magasin, une note…"
              className={cn(
                fieldCompactClass,
                "bg-stone-50/60 pl-8 focus:bg-white",
              )}
            />
          </div>

          <CategorySelect
            value={category}
            onChange={setCategory}
            includeAll
            variant="filter"
            ariaLabel="Filtrer par catégorie"
            className="min-w-0 flex-1 sm:w-[190px] sm:flex-none"
          />

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Ajouter
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-stone-500">
            <ReceiptText className="size-6" />
          </span>
          <p className="mt-4 text-sm font-medium text-stone-800">
            {hasFilters ? "Aucun ticket ne correspond" : "Aucun ticket pour ce mois"}
          </p>
          <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-stone-500">
            {hasFilters
              ? "Essayez un autre mot-clé ou une autre catégorie."
              : "Déposez un PDF ou une photo ci-dessus, ou ajoutez la dépense à la main."}
          </p>
          {!hasFilters && (
            <button
              type="button"
              onClick={onAdd}
              className="mt-4 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-400"
            >
              Ajouter une dépense
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Version mobile : cartes */}
          <ul className="divide-y divide-stone-100 sm:hidden">
            {filtered.map((expense) => (
              <li key={expense.row} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onEdit(expense)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium text-stone-800">
                      {expense.merchant}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] text-stone-500">
                        {formatDateShort(expense.date)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                          CATEGORY_STYLES[expense.category].chip,
                        )}
                      >
                        {expense.category}
                      </span>
                    </div>
                    {expense.note && (
                      <p className="mt-1 truncate text-[11px] text-stone-500">{expense.note}</p>
                    )}
                  </button>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                    {formatEuro(expense.amount)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  {expense.receiptUrl && (
                    <a
                      href={expense.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-800"
                    >
                      <Paperclip className="size-3.5" />
                      Ticket
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(expense)}
                    aria-label={`Modifier ${expense.merchant}`}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-800"
                  >
                    <Pencil className="size-3.5" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(expense)}
                    aria-label={`Supprimer ${expense.merchant}`}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[11.5px] font-medium text-stone-600 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="size-3.5" />
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Version desktop : tableau */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left">
              <caption className="sr-only">
                Liste des tickets du mois sélectionné. Chaque ligne peut être
                modifiée ou supprimée.
              </caption>
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] uppercase tracking-wider text-stone-500">
                  <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Magasin</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Catégorie</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Paiement</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Montant</th>
                  <th scope="col" className="w-24 px-5 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((expense) => (
                  <tr key={expense.row} className="group transition hover:bg-stone-50/70">
                    <td className="whitespace-nowrap px-5 py-3 text-[13px] text-stone-500">
                      {formatDateShort(expense.date)}
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[13px] font-medium text-stone-800">
                          {expense.merchant}
                        </p>
                        {expense.receiptUrl && (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Ouvrir le ticket"
                            className="shrink-0 text-stone-300 transition hover:text-emerald-600"
                          >
                            <Paperclip className="size-3" />
                          </a>
                        )}
                      </div>
                      {expense.note && (
                        <p className="mt-0.5 truncate text-[11px] text-stone-500">
                          {expense.note}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                          CATEGORY_STYLES[expense.category].chip,
                        )}
                      >
                        {expense.category}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-stone-500">
                      {expense.payment}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-stone-900">
                      {formatEuro(expense.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-0.5 opacity-60 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => onEdit(expense)}
                          aria-label={`Modifier ${expense.merchant}`}
                          className="grid size-8 place-items-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(expense)}
                          aria-label={`Supprimer ${expense.merchant}`}
                          className="grid size-8 place-items-center rounded-md text-stone-500 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-4 py-3 sm:px-5">
            <span className="text-[11px] uppercase tracking-wider text-stone-500">
              Total affiché
            </span>
            <span className="text-sm font-semibold tabular-nums text-stone-900">
              {formatEuro(total)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
