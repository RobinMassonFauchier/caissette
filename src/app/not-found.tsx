import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/">
          <Logo />
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-6 pb-24 pt-20 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
          Erreur 404
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
          Cette page n&apos;existe pas
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Le lien est peut-être incorrect, ou la page a été déplacée.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
        >
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
