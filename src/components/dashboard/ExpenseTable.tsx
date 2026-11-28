"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowDownUp,
  BadgePercent,
  Filter,
  ListFilter,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import { CATEGORY_STYLES } from "@/lib/catalog";
import { formatDateShort, formatEuro, parseAmountInput } from "@/lib/format";
import type { Category, Expense } from "@/lib/types";
import { CategorySelect } from "@/components/ui/CategorySelect";
import { PaymentSelect } from "@/components/ui/PaymentSelect";
import { fieldCompactClass } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

type SortKey =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "savings-desc";

const SORT_LABELS: Record<SortKey, string> = {
  "date-desc": "Plus récents",
  "date-asc": "Plus anciens",
  "amount-desc": "Montant décroissant",
  "amount-asc": "Montant croissant",
  "savings-desc": "Plus d'économies",
};

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
  const [payment, setPayment] = useState<string | "all">("all");
  const [merchant, setMerchant] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [savingsOnly, setSavingsOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const merchants = useMemo(
    () =>
      [...new Set(expenses.map((expense) => expense.merchant).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "fr"))
        .slice(0, 200),
    [expenses],
  );

  const minimum = minAmount.trim() ? parseAmountInput(minAmount) : null;
  const maximum = maxAmount.trim() ? parseAmountInput(maxAmount) : null;
  const merchantQuery = merchant.trim().toLowerCase();

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return [...expenses]
      .filter((expense) => category === "all" || expense.category === category)
      .filter((expense) => payment === "all" || expense.payment === payment)
      .filter(
        (expense) =>
          !merchantQuery || expense.merchant.toLowerCase().includes(merchantQuery),
      )
      .filter(
        (expense) => minimum === null || expense.amount >= minimum,
      )
      .filter(
        (expense) => maximum === null || expense.amount <= maximum,
      )
      .filter((expense) => !savingsOnly || expense.savings > 0)
      .filter((expense) => {
        if (!query) return true;
        return [
          expense.merchant,
          expense.category,
          expense.payment,
          expense.note,
          expense.date,
          formatEuro(expense.amount),
          formatEuro(expense.savings),
          ...expense.items.map((item) => item.label),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        switch (sort) {
          case "date-asc":
            return a.date.localeCompare(b.date) || a.row - b.row;
          case "amount-desc":
            return b.amount - a.amount || b.date.localeCompare(a.date);
          case "amount-asc":
            return a.amount - b.amount || b.date.localeCompare(a.date);
          case "savings-desc":
            return b.savings - a.savings || b.date.localeCompare(a.date);
          default:
            return b.date.localeCompare(a.date) || b.row - a.row;
        }
      });
  }, [
    expenses,
    deferredSearch,
    category,
    payment,
    merchantQuery,
    minimum,
    maximum,
    savingsOnly,
    sort,
  ]);

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const totalSavings = filtered.reduce(
    (sum, expense) => sum + expense.savings,
    0,
  );

  const activeFilters = [
    category !== "all",
    payment !== "all",
    merchantQuery.length > 0,
    minimum !== null,
    maximum !== null,
    savingsOnly,
    search.trim().length > 0,
  ].filter(Boolean).length;

  function resetFilters() {
    setSearch("");
    setCategory("all");
    setPayment("all");
    setMerchant("");
    setMinAmount("");
    setMaxAmount("");
    setSavingsOnly(false);
    setSort("date-desc");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Tickets</h2>
            <p className="text-[11px] text-stone-500">
              {filtered.length} dépense{filtered.length > 1 ? "s" : ""}
              {activeFilters > 0 ? ` · ${activeFilters} filtre${activeFilters > 1 ? "s" : ""}` : ""}
              {totalSavings > 0
                ? ` · ${formatEuro(totalSavings)} économisés`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-0 sm:w-56 sm:flex-none">
              <label htmlFor="expense-search" className="sr-only">
                Rechercher dans les tickets
              </label>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-500" />
              <input
                id="expense-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Magasin, article, note…"
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
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition",
                filtersOpen || activeFilters > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-stone-300 bg-white text-stone-700 hover:border-stone-400",
              )}
            >
              <Filter className="size-3.5" />
              Filtres
              {activeFilters > 0 && (
                <span className="grid size-4 place-items-center rounded-full bg-emerald-600 text-[9px] font-semibold text-white">
                  {activeFilters}
                </span>
              )}
            </button>

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

        {filtersOpen && (
          <div className="animate-in-up grid gap-2.5 rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-stone-600">
                Moyen de paiement
              </span>
              <PaymentSelect
                value={payment}
                onChange={setPayment}
                includeAll
                variant="filter"
                ariaLabel="Filtrer par moyen de paiement"
              />
            </div>

            <label className="block lg:col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-stone-600">
                Magasin
              </span>
              <div className="relative">
                <Store className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  list="expense-merchants"
                  value={merchant}
                  onChange={(event) => setMerchant(event.target.value)}
                  placeholder="Tous les magasins"
                  className={cn(fieldCompactClass, "pl-8")}
                />
                <datalist id="expense-merchants">
                  {merchants.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-stone-600">
                Prix min.
              </span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                  placeholder="0,00"
                  className={cn(fieldCompactClass, "pr-5 text-right tabular-nums")}
                />
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-stone-500">
                  €
                </span>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-stone-600">
                Prix max.
              </span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)}
                  placeholder="∞"
                  className={cn(fieldCompactClass, "pr-5 text-right tabular-nums")}
                />
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-stone-500">
                  €
                </span>
              </div>
            </label>

            <label className="flex items-center gap-2 self-end rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[11.5px] text-stone-700 lg:col-span-2">
              <input
                type="checkbox"
                checked={savingsOnly}
                onChange={(event) => setSavingsOnly(event.target.checked)}
                className="size-3.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              Uniquement les tickets avec économies
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1 block text-[11px] font-medium text-stone-600">
                Trier par
              </span>
              <div className="relative">
                <ArrowDownUp className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className={cn(fieldCompactClass, "pl-8")}
                >
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="flex items-end lg:col-span-2">
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilters === 0 && sort === "date-desc"}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-stone-600 transition hover:border-stone-400 disabled:opacity-40"
              >
                <RotateCcw className="size-3" />
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-stone-500">
            {activeFilters > 0 ? (
              <ListFilter className="size-6" />
            ) : (
              <ReceiptText className="size-6" />
            )}
          </span>
          <p className="mt-4 text-sm font-medium text-stone-800">
            {activeFilters > 0
              ? "Aucun ticket ne correspond"
              : "Aucun ticket pour ce mois"}
          </p>
          <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-stone-500">
            {activeFilters > 0
              ? "Essayez un autre mot-clé, un autre magasin ou élargissez la fourchette de prix."
              : "Déposez un PDF ou une photo ci-dessus, ou ajoutez la dépense à la main."}
          </p>
          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-stone-400"
            >
              Effacer les filtres
            </button>
          ) : (
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
                      {expense.items.length > 0 && (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          {expense.items.length} art.
                        </span>
                      )}
                      {expense.savings > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <BadgePercent className="size-2.5" />
                          {formatEuro(expense.savings)}
                        </span>
                      )}
                    </div>
                    {expense.note && (
                      <p className="mt-1 truncate text-[11px] text-stone-500">{expense.note}</p>
                    )}
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-stone-900">
                      {formatEuro(expense.amount)}
                    </p>
                    <p className="text-[10px] text-stone-500">{expense.payment}</p>
                  </div>
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
                    <td className="max-w-[280px] px-3 py-3">
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {expense.note && (
                          <p className="max-w-[180px] truncate text-[11px] text-stone-500">
                            {expense.note}
                          </p>
                        )}
                        {expense.items.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-stone-500">
                            <ReceiptText className="size-2.5" />
                            {expense.items.length} article
                            {expense.items.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {expense.savings > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700">
                            <BadgePercent className="size-2.5" />
                            −{formatEuro(expense.savings)}
                          </span>
                        )}
                      </div>
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-[11px] uppercase tracking-wider text-stone-500">
                Total affiché
              </span>
              <span className="text-sm font-semibold tabular-nums text-stone-900">
                {formatEuro(total)}
              </span>
            </div>
            {totalSavings > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                <BadgePercent className="size-3" />
                {formatEuro(totalSavings)} d&apos;économies
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
