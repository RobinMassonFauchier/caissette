"use client";

import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatEuro } from "@/lib/format";
import type { Expense } from "@/lib/types";

export function ConflictDialog({
  current,
  busy = false,
  onReload,
  onForce,
  onClose,
}: {
  current: Expense;
  busy?: boolean;
  onReload: () => void;
  onForce: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Ce ticket a été modifié entre-temps"
      subtitle="Vos changements n'ont pas été écrasés."
      onClose={onClose}
      width="sm:max-w-md"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onForce}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldAlert className="size-4" />
            )}
            Garder mes modifications
          </button>
          <button
            type="button"
            onClick={onReload}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <RefreshCw className="size-4" />
            Recharger la version à jour
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-stone-600">
        <p>
          Une autre fenêtre, un autre appareil ou une modification directe dans
          le Google Sheet a enregistré ce ticket avant vous.
        </p>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-[12.5px] text-stone-700">
          <p className="font-medium text-stone-900">{current.merchant}</p>
          <p className="mt-0.5 tabular-nums">
            {formatEuro(current.amount)} · {current.category}
            {current.savings > 0
              ? ` · ${formatEuro(current.savings)} d'économies`
              : ""}
          </p>
        </div>
        <p>
          « Recharger » affiche la version enregistrée. « Garder mes
          modifications » réapplique votre saisie par-dessus, en connaissance de
          cause.
        </p>
      </div>
    </Modal>
  );
}
