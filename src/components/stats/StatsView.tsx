"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Banknote,
  CalendarDays,
  ChartPie,
  CreditCard,
  Landmark,
  ReceiptText,
  Settings2,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { CATEGORY_STYLES } from "@/lib/catalog";
import {
  currentMonth,
  formatEuro,
  monthLabel,
  parseISODate,
} from "@/lib/format";
import type { AppSettings } from "@/lib/settings";
import type { Category, Expense, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function monthOf(expense: Expense): number {
  return Number(expense.date.slice(5, 7)) - 1;
}

function yearOf(expense: Expense): number {
  return Number(expense.date.slice(0, 4));
}

export function StatsView({
  user,
  expenses,
  settings,
  sheetUrl,
  error,
}: {
  user: SessionUser;
  expenses: Expense[];
  settings: AppSettings;
  sheetUrl: string;
  error: string | null;
}) {
  const nowYear = new Date().getFullYear();
  const years = useMemo(() => {
    const set = new Set<number>(expenses.map(yearOf).filter((year) => Number.isFinite(year)));
    set.add(nowYear);
    return [...set].sort((a, b) => b - a);
  }, [expenses, nowYear]);
  const [year, setYear] = useState(nowYear);

  const yearExpenses = useMemo(
    () => expenses.filter((expense) => yearOf(expense) === year),
    [expenses, year],
  );

  const totalYear = yearExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const count = yearExpenses.length;
  const monthsElapsed = year === nowYear ? new Date().getMonth() + 1 : 12;
  const averageMonth = totalYear / Math.max(1, monthsElapsed);

  const biggest = useMemo(
    () =>
      yearExpenses.reduce<Expense | null>(
        (best, expense) =>
          !best || expense.amount > best.amount ? expense : best,
        null,
      ),
    [yearExpenses],
  );

  const monthlyTotals = useMemo(() => {
    const totals = Array.from({ length: 12 }, () => 0);
    for (const expense of yearExpenses) {
      const month = monthOf(expense);
      if (month >= 0 && month < 12) totals[month] += expense.amount;
    }
    return totals;
  }, [yearExpenses]);

  const maxMonth = Math.max(...monthlyTotals, 0);

  const categoryTotals = useMemo(() => {
    const map = new Map<Category, number>();
    for (const expense of yearExpenses) {
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [yearExpenses]);

  const topCategory = categoryTotals[0] ?? null;

  const merchantTotals = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const expense of yearExpenses) {
      const current = map.get(expense.merchant) ?? { total: 0, count: 0 };
      current.total += expense.amount;
      current.count += 1;
      map.set(expense.merchant, current);
    }
    return [...map.entries()]
      .map(([merchant, value]) => ({ merchant, ...value }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [yearExpenses]);

  const paymentTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of yearExpenses) {
      map.set(expense.payment, (map.get(expense.payment) ?? 0) + expense.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [yearExpenses]);

  const weekdayTotals = useMemo(() => {
    const totals = Array.from({ length: 7 }, () => 0);
    for (const expense of yearExpenses) {
      const date = parseISODate(expense.date);
      if (!date) continue;
      const day = date.getDay();
      totals[(day + 6) % 7] += expense.amount;
    }
    return totals;
  }, [yearExpenses]);

  const maxWeekday = Math.max(...weekdayTotals, 0);

  const comparison = useMemo(() => {
    const monthKeys = new Set(yearExpenses.map((expense) => expense.date.slice(0, 7)));
    const sorted = [...monthKeys].sort();
    if (sorted.length === 0) return null;

    const latest = sorted[sorted.length - 1];
    const previousDate = parseISODate(`${latest}-01`);
    if (!previousDate) return null;
    previousDate.setMonth(previousDate.getMonth() - 1);
    const previous = `${previousDate.getFullYear()}-${String(
      previousDate.getMonth() + 1,
    ).padStart(2, "0")}`;

    const currentTotal = yearExpenses
      .filter((expense) => expense.date.startsWith(latest))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const previousTotal = yearExpenses
      .filter((expense) => expense.date.startsWith(previous))
      .reduce((sum, expense) => sum + expense.amount, 0);

    const change =
      previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal) * 100
        : null;

    return { latest, currentTotal, previousTotal, change };
  }, [yearExpenses]);

  const budget = settings.monthlyBudget;
  const currentMonthKey = currentMonth();
  const currentMonthTotal = expenses
    .filter((expense) => expense.date.startsWith(currentMonthKey))
    .reduce((sum, expense) => sum + expense.amount, 0);
  const budgetPercent = budget ? (currentMonthTotal / budget) * 100 : 0;
  const budgetRemaining = budget ? budget - currentMonthTotal : 0;

  const donut = useMemo(() => {
    if (totalYear <= 0 || categoryTotals.length === 0) {
      return "conic-gradient(#e7e5e4 0 100%)";
    }
    let cursor = 0;
    const segments = categoryTotals.map(([category, amount]) => {
      const start = cursor;
      const size = (amount / totalYear) * 100;
      cursor += size;
      return `${CATEGORY_STYLES[category].hex} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [categoryTotals, totalYear]);

  const topCategoryPercent =
    topCategory && totalYear > 0
      ? Math.round((topCategory[1] / totalYear) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader user={user} sheetUrl={sheetUrl} active="stats" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-stone-500">Vue d'ensemble de vos dépenses</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">
              Statistiques
            </h1>
          </div>

          <div className="flex items-center rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setYear((value) => value - 1)}
              className="grid size-7 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              aria-label="Année précédente"
            >
              <ArrowRight className="size-4 rotate-180" />
            </button>
            <span className="min-w-[64px] text-center text-[13px] font-medium tabular-nums text-stone-800">
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear((value) => value + 1)}
              disabled={year >= nowYear}
              className="grid size-7 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Année suivante"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
            {error}{" "}
            <a href="/api/auth/login" className="font-medium underline">
              Se reconnecter
            </a>
          </div>
        )}

        {count === 0 ? (
          <section className="rounded-2xl border border-stone-200/80 bg-white p-10 text-center shadow-sm">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ChartPie className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-stone-900">
              Pas encore de statistiques pour {year}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-stone-500">
              Ajoutez un ticket pour voir vos tendances, votre répartition par
              catégorie et votre budget.
            </p>
            <a
              href="/app"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              Ajouter un ticket
              <ArrowRight className="size-4" />
            </a>
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                icon={Wallet}
                label={`Total ${year}`}
                value={formatEuro(totalYear)}
                hint={`${count} ticket${count > 1 ? "s" : ""}`}
                tone="bg-emerald-50 text-emerald-700"
              />
              <Kpi
                icon={CalendarDays}
                label="Moyenne mensuelle"
                value={formatEuro(averageMonth)}
                hint={`sur ${monthsElapsed} mois`}
                tone="bg-sky-50 text-sky-700"
              />
              <Kpi
                icon={ReceiptText}
                label="Plus grosse dépense"
                value={biggest ? formatEuro(biggest.amount) : "—"}
                hint={biggest ? biggest.merchant : "—"}
                tone="bg-amber-50 text-amber-700"
              />
              <Kpi
                icon={Store}
                label="Magasin favori"
                value={merchantTotals[0]?.merchant ?? "—"}
                hint={
                  merchantTotals[0]
                    ? `${formatEuro(merchantTotals[0].total)} · ${merchantTotals[0].count} ticket${merchantTotals[0].count > 1 ? "s" : ""}`
                    : "—"
                }
                tone="bg-violet-50 text-violet-700"
                small
              />
            </div>

            <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-stone-900">
                        Évolution mensuelle
                      </h2>
                      <p className="text-[11px] text-stone-500">
                        Dépenses par mois en {year}
                      </p>
                    </div>
                    <span className="text-[11px] text-stone-400">
                      {formatEuro(totalYear)} au total
                    </span>
                  </div>

                  <div className="mt-5 flex h-52 items-end gap-1.5 sm:gap-2">
                    {monthlyTotals.map((amount, index) => {
                      const ratio = maxMonth > 0 ? amount / maxMonth : 0;
                      const isCurrent =
                        year === nowYear && index === new Date().getMonth();
                      return (
                        <div
                          key={index}
                          className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                          title={`${MONTH_LETTERS[index]} : ${formatEuro(amount)}`}
                        >
                          <span className="text-[9px] font-medium tabular-nums text-stone-400 opacity-0 transition group-hover:opacity-100">
                            {amount > 0 ? formatEuro(amount) : ""}
                          </span>
                          <div
                            className={cn(
                              "w-full rounded-t-md transition-all group-hover:opacity-80",
                              amount === 0
                                ? "bg-stone-100"
                                : isCurrent
                                  ? "bg-emerald-600"
                                  : "bg-emerald-200",
                            )}
                            style={{
                              height: amount === 0 ? "4px" : `${Math.max(4, ratio * 100)}%`,
                            }}
                          />
                          <span
                            className={cn(
                              "text-[10px]",
                              isCurrent
                                ? "font-semibold text-emerald-700"
                                : "text-stone-400",
                            )}
                          >
                            {MONTH_LETTERS[index]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="grid gap-6 md:grid-cols-2">
                  <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-stone-900">
                      Répartition par catégorie
                    </h2>
                    <p className="text-[11px] text-stone-500">
                      {formatEuro(totalYear)} sur l'année
                    </p>

                    <div className="mt-5 flex items-center gap-5">
                      <div className="relative size-32 shrink-0 rounded-full" style={{ background: donut }}>
                        <div className="absolute inset-[18px] grid place-items-center rounded-full bg-white">
                          <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-stone-400">
                              Total
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-stone-900">
                              {formatEuro(totalYear)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <ul className="min-w-0 flex-1 space-y-2">
                        {categoryTotals.slice(0, 6).map(([category, amount]) => (
                          <li
                            key={category}
                            className="flex items-center justify-between gap-2 text-[12px]"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-stone-600">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: CATEGORY_STYLES[category].hex }}
                              />
                              <span className="truncate">{category}</span>
                            </span>
                            <span className="shrink-0 font-medium tabular-nums text-stone-800">
                              {formatEuro(amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-stone-900">
                      Moyens de paiement
                    </h2>
                    <p className="text-[11px] text-stone-500">
                      Répartition des dépenses
                    </p>

                    <ul className="mt-4 space-y-3.5">
                      {paymentTotals.map(([payment, amount]) => {
                        const percent = totalYear > 0 ? (amount / totalYear) * 100 : 0;
                        return (
                          <li key={payment}>
                            <div className="flex items-center justify-between gap-2 text-[12px]">
                              <span className="flex items-center gap-2 text-stone-600">
                                <PaymentIcon payment={payment} />
                                {payment}
                              </span>
                              <span className="font-medium tabular-nums text-stone-800">
                                {formatEuro(amount)}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                              <div
                                className="h-full rounded-full bg-sky-500"
                                style={{ width: `${Math.max(3, percent)}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>

                <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-stone-900">
                      Jours de la semaine
                    </h2>
                    <span className="text-[11px] text-stone-400">
                      quand dépensez-vous ?
                    </span>
                  </div>
                  <div className="mt-4 flex h-36 items-end gap-2">
                    {weekdayTotals.map((amount, index) => {
                      const ratio = maxWeekday > 0 ? amount / maxWeekday : 0;
                      return (
                        <div
                          key={index}
                          className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                          title={`${WEEKDAYS[index]} : ${formatEuro(amount)}`}
                        >
                          <div
                            className="w-full rounded-t-md bg-violet-200 transition group-hover:bg-violet-300"
                            style={{ height: `${Math.max(3, ratio * 100)}%` }}
                          />
                          <span className="text-[10px] text-stone-400">
                            {WEEKDAYS[index]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Target className="size-3.5" />
                    </span>
                    <h2 className="text-sm font-semibold text-stone-900">
                      Budget du mois
                    </h2>
                  </div>

                  {budget ? (
                    <>
                      <div className="mt-4 flex items-baseline justify-between gap-2">
                        <p className="text-lg font-semibold tabular-nums text-stone-900">
                          {formatEuro(currentMonthTotal)}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          sur {formatEuro(budget)}
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className={cn(
                            "h-full rounded-full transition",
                            budgetPercent >= 100
                              ? "bg-rose-500"
                              : budgetPercent >= 80
                                ? "bg-amber-500"
                                : "bg-emerald-500",
                          )}
                          style={{ width: `${Math.min(100, Math.max(2, budgetPercent))}%` }}
                        />
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-[11px]",
                          budgetRemaining >= 0 ? "text-stone-500" : "text-rose-600",
                        )}
                      >
                        {budgetRemaining >= 0
                          ? `Il reste ${formatEuro(budgetRemaining)} pour ${monthLabel(currentMonthKey)}.`
                          : `Dépassement de ${formatEuro(Math.abs(budgetRemaining))} sur ${monthLabel(currentMonthKey)}.`}
                      </p>
                    </>
                  ) : (
                    <div className="mt-3">
                      <p className="text-[12px] leading-relaxed text-stone-500">
                        Fixez un budget mensuel pour suivre vos limites en un
                        coup d'œil.
                      </p>
                      <a
                        href="/app/settings"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[12px] font-medium text-stone-700 transition hover:border-stone-400"
                      >
                        <Settings2 className="size-3.5" />
                        Définir un budget
                      </a>
                    </div>
                  )}
                </section>

                {comparison && (
                  <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-lg",
                          comparison.change !== null && comparison.change > 0
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-600",
                        )}
                      >
                        {comparison.change !== null && comparison.change > 0 ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <TrendingDown className="size-3.5" />
                        )}
                      </span>
                      <h2 className="text-sm font-semibold text-stone-900">
                        Évolution
                      </h2>
                    </div>

                    <p className="mt-3 text-[13px] leading-relaxed text-stone-600">
                      {monthLabel(comparison.latest)} :{" "}
                      <strong className="text-stone-900">
                        {formatEuro(comparison.currentTotal)}
                      </strong>
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">
                      mois précédent : {formatEuro(comparison.previousTotal)}
                    </p>

                    {comparison.change !== null ? (
                      <p
                        className={cn(
                          "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                          comparison.change > 0
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {comparison.change > 0 ? (
                          <ArrowUpRight className="size-3.5" />
                        ) : (
                          <ArrowDownRight className="size-3.5" />
                        )}
                        {comparison.change > 0 ? "+" : ""}
                        {comparison.change.toFixed(0)} % par rapport au mois précédent
                      </p>
                    ) : (
                      <p className="mt-3 text-[11px] text-stone-400">
                        Pas de mois précédent comparable.
                      </p>
                    )}
                  </section>
                )}

                <section className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-stone-900">
                    Top magasins
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Vos commerces les plus dépensiers
                  </p>

                  <ul className="mt-4 space-y-3">
                    {merchantTotals.map((item, index) => (
                      <li key={item.merchant}>
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="flex min-w-0 items-center gap-2 text-stone-600">
                            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-stone-100 text-[10px] font-semibold text-stone-500">
                              {index + 1}
                            </span>
                            <span className="truncate">{item.merchant}</span>
                          </span>
                          <span className="shrink-0 font-medium tabular-nums text-stone-800">
                            {formatEuro(item.total)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-stone-400"
                            style={{
                              width: `${Math.max(
                                4,
                                (item.total / (merchantTotals[0]?.total || 1)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white to-stone-50 p-5 shadow-sm">
                  <p className="text-[11px] uppercase tracking-wider text-stone-400">
                    Top catégorie
                  </p>
                  {topCategory ? (
                    <>
                      <p className="mt-1 text-lg font-semibold text-stone-900">
                        {topCategory[0]}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {topCategoryPercent} % du total · {formatEuro(topCategory[1])}
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${topCategoryPercent}%`,
                            backgroundColor: CATEGORY_STYLES[topCategory[0]].hex,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-[12px] text-stone-500">Aucune donnée.</p>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/70 pt-5 text-[11px] text-stone-400">
          <p>Caissette · vos tickets, classés sans effort.</p>
          <p>Statistiques calculées à partir de votre Google Sheet.</p>
        </footer>
      </main>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  small = false,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  tone: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
          {label}
        </p>
        <span className={`grid size-7 place-items-center rounded-lg ${tone}`}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p
        className={cn(
          "mt-2.5 truncate font-semibold tracking-tight tabular-nums text-stone-900",
          small ? "text-base" : "text-xl",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-stone-500">{hint}</p>
    </div>
  );
}

function PaymentIcon({ payment }: { payment: string }) {
  const className = "size-3.5 text-stone-400";
  if (/esp/i.test(payment)) return <Banknote className={className} />;
  if (/ch[eè]que/i.test(payment)) return <Landmark className={className} />;
  if (/virement/i.test(payment)) return <ArrowRight className={className} />;
  if (/carte/i.test(payment)) return <CreditCard className={className} />;
  return <CreditCard className={className} />;
}
