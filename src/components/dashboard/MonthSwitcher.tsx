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
    <div
      role="group"
      aria-label="Choisir la période affichée"
      className="flex flex-wrap items-center gap-2"
    >
      {!isAll && (
        <div className="flex items-center rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onChange(shiftMonth(month, -1))}
            className="grid size-9 place-items-center rounded-lg text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            aria-live="polite"
            className="min-w-[136px] px-1 text-center text-[13px] font-medium capitalize text-stone-800"
          >
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => onChange(shiftMonth(month, 1))}
            disabled={month >= current}
            className="grid size-9 place-items-center rounded-lg text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-30 disabled:hover:bg-transparent"
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
          className="min-h-9 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
        >
          Mois en cours
        </button>
      )}

      <button
        type="button"
        onClick={() => onChange(isAll ? current : "all")}
        aria-pressed={isAll}
        className={cn(
          "min-h-9 rounded-xl border px-3 py-2 text-[13px] font-medium shadow-sm transition",
          isAll
            ? "border-stone-900 bg-stone-900 text-white"
            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-900",
        )}
      >
        Tous les mois
      </button>
    </div>
  );
}
