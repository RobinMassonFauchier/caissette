"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="/">
          <Logo />
        </a>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-6 pb-24 pt-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-inset ring-rose-600/10">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-stone-900">
          Quelque chose s&apos;est mal passé
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          L&apos;application a rencontré une erreur inattendue. Vos données dans
          Google Drive ne sont pas affectées.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            <RotateCcw className="size-4" />
            Réessayer
          </button>
          <a
            href="/"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
          >
            Accueil
          </a>
        </div>
      </main>
    </div>
  );
}
