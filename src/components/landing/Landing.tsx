import {
  ArrowRight,
  Camera,
  Check,
  FileSpreadsheet,
  Lock,
  ScanLine,
  Sparkles,
  Table2,
  TriangleAlert,
} from "lucide-react";
import { GoogleIcon } from "@/components/GoogleIcon";
import { Logo } from "@/components/Logo";

const ERROR_MESSAGES: Record<string, string> = {
  config:
    "Configuration incomplète : renseignez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env.local, puis redémarrez l'application.",
  forbidden:
    "Ce compte Google n'est pas autorisé à utiliser cette application. Demandez à l'administrateur de vous ajouter à la liste ALLOWED_EMAILS.",
  access_denied: "Vous avez annulé la connexion Google. Vous pouvez réessayer quand vous voulez.",
  auth_failed: "La connexion à Google a échoué. Réessayez dans un instant.",
  invalid_state: "La session de connexion a expiré. Réessayez.",
  missing_code: "La connexion à Google est incomplète. Réessayez.",
  no_refresh_token:
    "Google n'a pas accordé d'accès durable. Réessayez en acceptant toutes les autorisations demandées.",
  profile: "Impossible de récupérer les informations de votre compte Google.",
};

const DEMO_ROWS = [
  { merchant: "Carrefour Market", category: "Alimentation", amount: "42,18 €", tone: "bg-emerald-500" },
  { merchant: "SNCF Connect", category: "Transport", amount: "68,00 €", tone: "bg-sky-500" },
  { merchant: "Le Bistrot", category: "Restaurants", amount: "23,50 €", tone: "bg-orange-500" },
  { merchant: "Netflix", category: "Abonnements", amount: "13,49 €", tone: "bg-slate-500" },
];

export function Landing({
  configured,
  error,
}: {
  configured: boolean;
  error?: string;
}) {
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Une erreur est survenue. Réessayez." : null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-emerald-100),transparent)]" />
      <div className="pointer-events-none absolute -right-32 top-24 -z-10 size-96 rounded-full bg-amber-100/50 blur-3xl" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Logo />
        {configured ? (
          <a
            href="/api/auth/login"
            className="rounded-full border border-stone-300 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-400 hover:text-stone-900"
          >
            Se connecter
          </a>
        ) : (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            Configuration requise
          </span>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="grid items-center gap-16 pb-16 pt-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pb-24 lg:pt-12">
          <section className="animate-in-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-800">
              <Sparkles className="size-3.5" />
              Lecture automatique des tickets
            </span>

            <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-stone-900 sm:text-6xl">
              Vos tickets de caisse,
              <br className="hidden sm:block" />{" "}
              enfin <span className="text-emerald-700">rangés</span>.
            </h1>

            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-stone-600 sm:text-base">
              Prenez un ticket en photo, ou déposez le PDF envoyé par le magasin.
              Caissette en extrait la date, le montant et la catégorie, puis complète
              votre tableau de dépenses — stocké dans votre propre Google&nbsp;Sheet.
            </p>

            <div className="mt-8">
              {errorMessage && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {!configured ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-900">
                  <p className="flex items-center gap-2 font-medium">
                    <TriangleAlert className="size-4" />
                    Il reste une étape de configuration
                  </p>
                  <p className="mt-2 leading-relaxed">
                    Renseignez <code className="rounded bg-white/70 px-1 py-0.5">GOOGLE_CLIENT_ID</code> et{" "}
                    <code className="rounded bg-white/70 px-1 py-0.5">GOOGLE_CLIENT_SECRET</code> dans{" "}
                    <code className="rounded bg-white/70 px-1 py-0.5">.env.local</code>, puis redémarrez.
                    La procédure complète est dans le <strong>README.md</strong>.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  <a
                    href="/api/auth/login"
                    className="group inline-flex items-center gap-3 rounded-xl border border-stone-300 bg-white px-5 py-3.5 text-sm font-medium text-stone-800 shadow-sm shadow-stone-900/5 transition hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md"
                  >
                    <GoogleIcon className="size-5" />
                    Continuer avec Google
                    <ArrowRight className="size-4 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-600" />
                  </a>
                  <p className="flex items-center gap-1.5 text-xs text-stone-500">
                    <Lock className="size-3.5" />
                    Connexion sécurisée. Vos données restent dans votre Drive.
                  </p>
                </div>
              )}
            </div>

            <ul className="mt-10 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
              {[
                { icon: Camera, label: "Photo ou PDF" },
                { icon: ScanLine, label: "Champs pré-remplis" },
                { icon: Table2, label: "Google Sheet à jour" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-stone-200 bg-white text-emerald-700 shadow-sm">
                    <Icon className="size-4" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </section>

          <section className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gradient-to-br from-emerald-200/60 via-stone-100 to-amber-100/60 blur-2xl" />
            <div className="relative rotate-[-1.2deg] rounded-3xl border border-stone-200/90 bg-white/95 p-5 shadow-2xl shadow-stone-900/10 backdrop-blur sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
                    Novembre 2026
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
                    842,60 €
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">28 tickets · 6 catégories</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                  À jour
                </span>
              </div>

              <div className="mt-5 flex h-24 items-end gap-2 rounded-xl bg-stone-50/80 px-3 pb-3 pt-2">
                {[38, 62, 48, 78, 55, 92].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-md ${index === 5 ? "bg-emerald-500" : "bg-emerald-200"}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-1">
                {DEMO_ROWS.map((row) => (
                  <div
                    key={row.merchant}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${row.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-stone-800">
                        {row.merchant}
                      </p>
                      <p className="text-[11px] text-stone-400">{row.category}</p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums text-stone-800">
                      {row.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-5 right-2 flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 shadow-lg shadow-stone-900/10 sm:-right-4">
              <span className="grid size-7 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <div>
                <p className="text-[11px] font-semibold text-stone-800">Ticket ajouté</p>
                <p className="text-[10px] text-stone-500">Carrefour · 42,18 €</p>
              </div>
            </div>
          </section>
        </div>

        <section className="grid gap-4 border-t border-stone-200/80 pt-12 sm:grid-cols-3">
          {[
            {
              icon: Camera,
              title: "Importez en un geste",
              text: "Photo bien cadrée ou PDF du magasin : le ticket est lu en quelques secondes, sans rien retaper.",
            },
            {
              icon: FileSpreadsheet,
              title: "Un vrai tableau qui vit",
              text: "Chaque ticket complète automatiquement votre Google Sheet. Vous pouvez aussi tout modifier à la main.",
            },
            {
              icon: Lock,
              title: "Vos données chez vous",
              text: "Aucun stockage sur nos serveurs : la feuille et les justificatifs restent dans votre compte Google.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="rounded-2xl border border-stone-200/80 bg-white/60 p-5 transition hover:border-stone-300 hover:bg-white"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                <Icon className="size-[18px]" />
              </span>
              <h2 className="mt-4 text-sm font-semibold text-stone-900">{title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-stone-500">{text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-stone-200/70 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 text-xs text-stone-400 sm:flex-row sm:px-8">
          <p>Caissette · votre budget familial, sans prise de tête.</p>
          <p>Un outil privé, hébergé chez vous.</p>
        </div>
      </footer>
    </div>
  );
}
