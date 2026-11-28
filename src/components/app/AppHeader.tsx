"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  ExternalLink,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SessionUser, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "expenses", href: "/app", label: "Dépenses", icon: Wallet },
  {
    id: "stats",
    href: "/app/stats",
    label: "Statistiques",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    id: "settings",
    href: "/app/settings",
    label: "Paramètres",
    icon: Settings,
  },
  { id: "help", href: "/app/aide", label: "Aide", icon: CircleHelp },
] as const;

function getActive(pathname: string) {
  if (pathname.startsWith("/app/stats")) return "stats";
  if (pathname.startsWith("/app/settings")) return "settings";
  if (pathname.startsWith("/app/aide")) return "help";
  return "expenses";
}

export function AppHeader({
  user,
  profile,
  sheetUrl,
}: {
  user: SessionUser;
  profile: UserProfile;
  sheetUrl: string;
}) {
  const pathname = usePathname();
  const active = getActive(pathname);

  const displayName = profile.displayName || user.name;
  const initials = (displayName || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <>
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
                  aria-current={active === id ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition",
                    active === id
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-600 hover:bg-white/60 hover:text-stone-900",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:text-stone-900 sm:px-3"
              >
                <span className="hidden sm:inline">Ouvrir le Sheet</span>
                <span className="sm:hidden">Sheet</span>
                <ExternalLink className="size-3.5 text-stone-500" />
              </a>
            )}

            <div className="hidden items-center gap-2 border-l border-stone-200 pl-3 lg:flex">
              {profile.picture || user.picture ? (
                <img
                  src={profile.picture || user.picture}
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
                  {displayName}
                </p>
                <p className="truncate text-[10px] leading-tight text-stone-500">
                  {user.email}
                </p>
              </div>
            </div>

            <a
              href="/api/auth/logout"
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="grid size-10 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-800"
            >
              <LogOut className="size-4.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Navigation mobile : libellés visibles, zone tactile confortable. */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(28,25,23,0.06)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ id, href, label, icon: Icon }) => {
            const current = active === id;
            return (
              <Link
                key={id}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-[58px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10.5px] font-medium transition",
                  current
                    ? "text-emerald-700"
                    : "text-stone-500 hover:text-stone-800",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg transition",
                    current ? "bg-emerald-50" : "",
                  )}
                >
                  <Icon className="size-[19px]" strokeWidth={current ? 2.4 : 2} />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
