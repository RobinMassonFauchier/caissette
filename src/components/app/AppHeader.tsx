"use client";

import Link from "next/link";
import {
  ChartNoAxesColumnIncreasing,
  ExternalLink,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AppSection = "expenses" | "stats" | "settings";

const NAV = [
  { id: "expenses", href: "/app", label: "Dépenses", icon: Wallet },
  {
    id: "stats",
    href: "/app/stats",
    label: "Statistiques",
    icon: ChartNoAxesColumnIncreasing,
  },
  { id: "settings", href: "/app/settings", label: "Paramètres", icon: Settings },
] as const;

export function AppHeader({
  user,
  sheetUrl,
  active,
}: {
  user: SessionUser;
  sheetUrl: string;
  active: AppSection;
}) {
  const initials = (user.name || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-stone-50/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/app" aria-label="Accueil Caissette">
            <Logo />
          </Link>

          <nav
            className="hidden items-center gap-1 rounded-xl bg-stone-100/80 p-1 md:flex"
            aria-label="Navigation principale"
          >
            {NAV.map(({ id, href, label, icon: Icon }) => (
              <Link
                key={id}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
                  active === id
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-800",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <nav className="flex items-center gap-1 md:hidden" aria-label="Navigation principale">
            {NAV.map(({ id, href, label, icon: Icon }) => (
              <Link
                key={id}
                href={href}
                aria-label={label}
                className={cn(
                  "grid size-8 place-items-center rounded-lg transition",
                  active === id
                    ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200"
                    : "text-stone-500 hover:bg-stone-200/60 hover:text-stone-800",
                )}
              >
                <Icon className="size-4" />
              </Link>
            ))}
          </nav>

          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:text-stone-900 sm:px-3"
            >
              <span className="hidden sm:inline">Ouvrir le Sheet</span>
              <span className="sm:hidden">Sheet</span>
              <ExternalLink className="size-3.5 text-stone-400" />
            </a>
          )}

          <div className="hidden items-center gap-2 border-l border-stone-200 pl-3 lg:flex">
            {user.picture ? (
              <img
                src={user.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="size-8 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                {initials}
              </span>
            )}
            <div className="max-w-[140px]">
              <p className="truncate text-[12px] font-medium leading-tight text-stone-800">
                {user.name}
              </p>
              <p className="truncate text-[10px] leading-tight text-stone-400">
                {user.email}
              </p>
            </div>
          </div>

          <a
            href="/api/auth/logout"
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="grid size-8 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-200/60 hover:text-stone-700"
          >
            <LogOut className="size-4" />
          </a>
        </div>
      </div>
    </header>
  );
}
