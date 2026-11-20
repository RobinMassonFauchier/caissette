import { CATEGORY_STYLES } from "@/lib/catalog";
import { formatEuro } from "@/lib/format";
import type { Category, Expense } from "@/lib/types";

export function CategoryBreakdown({ expenses }: { expenses: Expense[] }) {
  const totals = new Map<Category, number>();

  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }

  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  const max = entries[0]?.[1] ?? 0;

  return (
    <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-900">Répartition</h2>
        <span className="text-[11px] text-stone-400">par catégorie</span>
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 text-[13px] leading-relaxed text-stone-500">
          Ajoutez un ticket pour voir la répartition de vos dépenses.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[11px] text-stone-500">
            {formatEuro(total)} sur la période
          </p>

          <ul className="mt-4 space-y-3.5">
            {entries.map(([category, amount]) => {
              const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
              const width = max > 0 ? Math.max(4, (amount / max) * 100) : 0;

              return (
                <li key={category}>
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex min-w-0 items-center gap-2 text-stone-600">
                      <span
                        className={`size-2 shrink-0 rounded-full ${CATEGORY_STYLES[category].dot}`}
                      />
                      <span className="truncate">{category}</span>
                      <span className="text-[10px] text-stone-400">{percent} %</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums text-stone-800">
                      {formatEuro(amount)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${CATEGORY_STYLES[category].bar}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
