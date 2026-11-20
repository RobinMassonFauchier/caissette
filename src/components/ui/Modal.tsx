"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "sm:max-w-2xl",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-stone-950/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-in-up relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-stone-200/80 bg-white shadow-2xl sm:rounded-2xl",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-6 border-b border-stone-100 px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-stone-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-stone-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Fermer la fenêtre"
          >
            <X className="size-4.5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <footer className="border-t border-stone-100 bg-stone-50/70 px-5 py-4 sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
