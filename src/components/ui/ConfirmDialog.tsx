"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width="sm:max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-stone-600">{description}</p>
    </Modal>
  );
}
