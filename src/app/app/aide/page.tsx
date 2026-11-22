import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  Landmark,
  Lock,
  MousePointerClick,
  Pencil,
  Plus,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Table2,
  Wallet,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Aide — Caissette",
  description:
    "Guide pas à pas pour ajouter un ticket, comprendre les statistiques et installer Caissette sur votre téléphone.",
};

const STEPS = [
  {
    icon: Camera,
    title: "1. Ajoutez un ticket",
    text: "Prenez une photo bien nette ou choisissez le PDF envoyé par le magasin. Vous pouvez aussi saisir la dépense à la main.",
  },
  {
    icon: CheckCircle2,
    title: "2. Vérifiez",
    text: "Caissette pré-remplit la date, le magasin, le montant et la catégorie. Corrigez si besoin, puis enregistrez.",
  },
  {
    icon: Table2,
    title: "3. C'est rangé",
    text: "La ligne est ajoutée à votre Google Sheet. Vos statistiques et votre budget se mettent à jour tout seuls.",
  },
];

const FAQ = [
  {
    question: "Est-ce vraiment gratuit ?",
    answer:
      "Oui. Caissette est un outil familial gratuit : pas d'abonnement, pas de carte bancaire et aucune publicité. Le compte Google utilisé pour la feuille de calcul suffit.",
  },
  {
    question: "Faut-il créer un compte ou installer quelque chose ?",
    answer:
      "Non. Vous vous connectez simplement avec votre compte Google, dans votre navigateur. Aucune application n'est à télécharger. Vous pouvez quand même ajouter Caissette à l'écran d'accueil de votre téléphone, comme un raccourci.",
  },
  {
    question: "Puis-je utiliser Caissette à plusieurs ?",
    answer:
      "Oui. Chaque personne se connecte avec son propre compte Google et obtient sa propre feuille et son propre dossier de tickets. Les données ne sont pas partagées entre les comptes.",
  },
  {
    question: "Le ticket n'a pas été bien lu, que faire ?",
    answer:
      "Ce n'est pas grave : la fenêtre de vérification permet de corriger tous les champs avant d'enregistrer. Pour de meilleurs résultats, posez le ticket à plat, cadrez-le en entier et évitez les ombres et les reflets.",
  },
  {
    question: "Puis-je modifier ou supprimer un ticket ?",
    answer:
      "Oui. Dans la liste des dépenses, utilisez « Modifier » ou « Supprimer » sur la ligne concernée. La feuille Google est mise à jour immédiatement. Le fichier original reste dans votre Drive.",
  },
  {
    question: "Où sont mes données ?",
    answer:
      "Dans votre propre Google Drive : une feuille de calcul « Dépenses — Caissette » et un dossier « Tickets de caisse — Caissette ». Caissette ne conserve aucune donnée sur son serveur.",
  },
  {
    question: "Pourquoi le premier chargement est parfois lent ?",
    answer:
      "L'hébergement gratuit met le service en pause après quelques minutes sans activité. Le premier accès peut alors prendre jusqu'à une minute. Ensuite, la navigation est rapide.",
  },
  {
    question: "Que faire si Google refuse la connexion ?",
    answer:
      "Vérifiez que vous utilisez bien l'adresse Google autorisée par la personne qui gère Caissette. Si le problème continue, déconnectez-vous puis reconnectez-vous avec Google.",
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50/60 p-5 shadow-sm sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
          <Sparkles className="size-3.5" />
          Guide simple
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-[30px]">
          Bienvenue dans Caissette
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-stone-700">
          Caissette lit vos tickets de caisse et remplit votre Google Sheet à
          votre place. Voici tout ce qu&apos;il faut savoir, sans termes
          techniques.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Camera className="size-4" />
            Ajouter un ticket
          </Link>
          <Link
            href="/app/settings"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-[13.5px] font-medium text-stone-800 shadow-sm transition hover:border-stone-400"
          >
            <Wallet className="size-4 text-stone-500" />
            Régler mon budget
          </Link>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="demarrer">
        <h2
          id="demarrer"
          className="text-lg font-semibold tracking-tight text-stone-900"
        >
          En 3 étapes
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                <Icon className="size-4.5" />
              </span>
              <h3 className="mt-3 text-[13.5px] font-semibold text-stone-900">
                {title}
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="ajouter">
        <h2
          id="ajouter"
          className="text-lg font-semibold tracking-tight text-stone-900"
        >
          Ajouter un ticket
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
          Quatre façons, choisissez la plus simple pour vous.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: Camera,
              title: "Prendre une photo",
              text: "Sur téléphone, le bouton « Prendre une photo » ouvre directement l'appareil. Posez le ticket à plat et cadrez-le entièrement.",
            },
            {
              icon: FolderOpen,
              title: "Choisir un fichier",
              text: "Sélectionnez une photo ou un PDF déjà présent sur votre appareil. Formats acceptés : PDF, JPG, PNG, WEBP. Taille maximale : 15 Mo.",
            },
            {
              icon: Landmark,
              title: "Importer depuis Drive",
              text: "Si le ticket est déjà dans votre Google Drive, utilisez « Importer depuis Google Drive » et sélectionnez jusqu'à 5 fichiers.",
            },
            {
              icon: Plus,
              title: "Saisir à la main",
              text: "Le bouton « Ajouter » de la liste permet de créer une dépense sans justificatif. Pratique pour les achats en espèces.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-700">
                <Icon className="size-4.5" />
              </span>
              <div>
                <h3 className="text-[13.5px] font-semibold text-stone-900">
                  {title}
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">
                  {text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="chiffres">
        <h2
          id="chiffres"
          className="text-lg font-semibold tracking-tight text-stone-900"
        >
          Comprendre les chiffres
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <dl className="divide-y divide-stone-100">
            {[
              {
                term: "Total",
                definition:
                  "La somme de tous les tickets affichés pour la période choisie (le mois en cours par défaut).",
              },
              {
                term: "Ticket moyen",
                definition:
                  "Le total divisé par le nombre de tickets. Utile pour repérer les petites dépenses qui s'accumulent.",
              },
              {
                term: "Top catégorie",
                definition:
                  "La catégorie qui représente la plus grosse part de vos dépenses sur la période.",
              },
              {
                term: "Budget mensuel",
                definition:
                  "Facultatif. Réglez-le dans Paramètres pour voir la marge restante et être alerté en cas de dépassement.",
              },
              {
                term: "Statistiques",
                definition:
                  "La page Statistiques regroupe l'évolution mois par mois, la répartition par catégorie, les moyens de paiement et vos magasins favoris.",
              },
            ].map(({ term, definition }) => (
              <div key={term} className="px-4 py-3 sm:px-5">
                <dt className="text-[13.5px] font-semibold text-stone-900">
                  {term}
                </dt>
                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-stone-600">
                  {definition}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="donnees">
        <h2
          id="donnees"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900"
        >
          <ShieldCheck className="size-5 text-emerald-600" />
          Où sont mes données ?
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-stone-900">
              <FileSpreadsheet className="size-4 text-emerald-600" />
              Votre Google Sheet
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">
              Toutes les dépenses sont écrites dans votre feuille « Dépenses —
              Caissette ». Vous pouvez l&apos;ouvrir à tout moment avec le
              bouton « Ouvrir le Sheet », en haut de l&apos;écran.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-stone-900">
              <Lock className="size-4 text-emerald-600" />
              Vos tickets
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">
              Les photos et PDF sont archivés dans votre dossier « Tickets de
              caisse — Caissette » sur votre Drive. Ils ne sont jamais envoyés à
              un service tiers.
            </p>
          </article>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="telephone">
        <h2
          id="telephone"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900"
        >
          <Smartphone className="size-5 text-emerald-600" />
          Installer sur le téléphone
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-[13.5px] font-semibold text-stone-900">
              Android (Chrome)
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">
              Ouvrez Caissette, touchez le menu <strong>⋮</strong> en haut à
              droite, puis <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-[13.5px] font-semibold text-stone-900">
              iPhone (Safari)
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-stone-600">
              Ouvrez Caissette, touchez <strong>Partager</strong> (le carré avec
              une flèche), puis <strong>Sur l&apos;écran d&apos;accueil</strong>.
            </p>
          </article>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-stone-500">
          <MousePointerClick className="mt-0.5 size-3.5 shrink-0" />
          Cette manipulation crée un simple raccourci : aucune application n&apos;est
          téléchargée et vos données restent dans Google.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="faq">
        <h2
          id="faq"
          className="text-lg font-semibold tracking-tight text-stone-900"
        >
          Questions fréquentes
        </h2>
        <div className="mt-3 space-y-2">
          {FAQ.map(({ question, answer }) => (
            <details
              key={question}
              className="group rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm open:bg-stone-50/60"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13.5px] font-medium text-stone-900">
                {question}
                <span
                  aria-hidden="true"
                  className="text-lg leading-none text-stone-500 transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 pr-6 text-[12.5px] leading-relaxed text-stone-600">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm">
        <ReceiptText className="mx-auto size-6 text-emerald-600" />
        <p className="mt-2 text-[14px] font-semibold text-stone-900">
          Prêt à essayer ?
        </p>
        <p className="mt-1 text-[12.5px] text-stone-600">
          Le premier ticket est le plus long. Les suivants prennent quelques
          secondes.
        </p>
        <Link
          href="/app"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Ajouter un ticket
          <ArrowRight className="size-4" />
        </Link>
      </section>

      <div className="mt-6 flex items-center gap-2 text-[11.5px] text-stone-500">
        <Pencil className="size-3.5" />
        Vous pouvez modifier vos préférences à tout moment dans Paramètres.
      </div>
    </main>
  );
}
