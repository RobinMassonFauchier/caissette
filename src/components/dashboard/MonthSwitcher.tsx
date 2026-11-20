"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MonthSwitcher({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const current = currentMonth();
  const isAll = month === "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isAll && (
        <div className="flex items-center rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onChange(shiftMonth(month, -1))}
            className="grid size-7 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[132px] px-1 text-center text-[13px] font-medium capitalize text-stone-800">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => onChange(shiftMonth(month, 1))}
            disabled={month >= current}
            className="grid size-7 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Mois suivant"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {month !== current && (
        <button
          type="button"
          onClick={() => onChange(current)}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
        >
          Ce mois
        </button>
      )}

      <button
        type="button"
        onClick={() => onChange(isAll ? current : "all")}
        className={cn(
          "rounded-xl border px-3 py-2 text-[13px] font-medium shadow-sm transition",
          isAll
            ? "border-stone-900 bg-stone-900 text-white"
            : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900",
        )}
      >
        Tout
      </button>
    </div>
  );
}
