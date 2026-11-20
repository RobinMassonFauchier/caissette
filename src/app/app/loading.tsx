import { Logo } from "@/components/Logo";

export default function Loading() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200/70 bg-stone-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-stone-200/80" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="h-3.5 w-28 animate-pulse rounded bg-stone-200/80" />
            <div className="mt-2 h-7 w-44 animate-pulse rounded bg-stone-200/80" />
          </div>
          <div className="h-9 w-52 animate-pulse rounded-xl bg-stone-200/70" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[104px] animate-pulse rounded-2xl border border-stone-200/70 bg-white/70"
            />
          ))}
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-6">
            <div className="h-72 animate-pulse rounded-2xl border border-stone-200/70 bg-white/70" />
            <div className="h-96 animate-pulse rounded-2xl border border-stone-200/70 bg-white/70" />
          </div>
          <div className="hidden h-80 animate-pulse rounded-2xl border border-stone-200/70 bg-white/70 lg:block" />
        </div>
      </main>
    </div>
  );
}
