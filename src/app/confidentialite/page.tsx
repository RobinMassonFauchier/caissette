import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Caissette",
  description:
    "Comment Caissette traite vos tickets de caisse et vos données personnelles.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-[13px] font-medium text-stone-600 transition hover:text-stone-900"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main
        id="contenu"
        className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
          <ShieldCheck className="size-3.5" />
          Données hébergées chez vous
        </span>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-stone-900">
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Dernière mise à jour : 20 novembre 2026
        </p>

        <div className="mt-10 space-y-8 text-[14px] leading-relaxed text-stone-600">
          <section>
            <h2 className="text-base font-semibold text-stone-900">
              1. Qui utilise l&apos;application
            </h2>
            <p className="mt-2">
              Caissette est une application personnelle destinée à un usage
              familial. Elle permet de lire des tickets de caisse et de tenir un
              tableau de dépenses dans une feuille de calcul Google.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-stone-900">
              2. Données traitées
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                Les fichiers de tickets que vous déposez (PDF ou photo), ainsi que
                les informations qui en sont extraites : date, magasin, montant,
                TVA, moyen de paiement, catégorie et note.
              </li>
              <li>
                Les informations de votre compte Google nécessaires à la connexion :
                nom, adresse e-mail et photo de profil.
              </li>
              <li>
                Un cookie de session chiffré contenant votre jeton d&apos;autorisation
                Google.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-stone-900">
              3. Où sont stockées les données
            </h2>
            <p className="mt-2">
              La feuille de calcul et les tickets originaux sont créés et stockés
              dans <strong>votre Google Drive</strong>. L&apos;application ne
              dispose ni de base de données ni d&apos;espace de stockage de fichiers
              sur son serveur. Le serveur ne conserve que le cookie de session
              chiffré dans votre navigateur.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-stone-900">
              4. Lecture des tickets (OCR)
            </h2>
            <p className="mt-2">
              Les photos sont analysées localement par le moteur de reconnaissance
              de caractères Tesseract installé sur la machine qui héberge
              l&apos;application. Aucune image n&apos;est envoyée à un service
              d&apos;intelligence artificielle tiers. Le texte extrait peut
              toutefois être affiché dans l&apos;interface pour vous permettre de
              vérifier les informations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-stone-900">
              5. Accès à votre compte Google
            </h2>
            <p className="mt-2">
              La connexion utilise OAuth 2.0 avec les autorisations suivantes :
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px]">
                  drive.file
                </code>{" "}
                : accéder uniquement aux fichiers créés ou ouverts par
                l&apos;application (la feuille de calcul et les tickets
                archivés).
              </li>
              <li>
                <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px]">
                  openid, email, profile
                </code>{" "}
                : identifier votre compte et afficher votre nom.
              </li>
            </ul>
            <p className="mt-2">
              L&apos;application ne demande donc <strong>aucun accès sensible</strong> à
              l&apos;ensemble de vos feuilles de calcul. Elle ne peut pas accéder au
              reste de votre Drive, à vos e-mails ni à vos contacts. Vous pouvez
              révoquer cet accès à tout moment sur{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-700 underline-offset-2 hover:underline"
              >
                myaccount.google.com/permissions
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-stone-900">
              6. Conservation et suppression
            </h2>
            <p className="mt-2">
              Les données restent dans votre Drive tant que vous ne les supprimez
              pas. Supprimer une dépense depuis l&apos;application efface la ligne
              correspondante dans la feuille ; supprimer un fichier depuis Google
              Drive efface définitivement le justificatif. La déconnexion efface le
              cookie de session.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-stone-900">
              7. Partage
            </h2>
            <p className="mt-2">
              Aucune donnée n&apos;est vendue, louée ou transmise à des tiers.
              L&apos;application ne dépose aucun cookie publicitaire et
              n&apos;utilise aucun outil de suivi.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-stone-900">8. Contact</h2>
            <p className="mt-2">
              Pour toute question relative à vos données, contactez
              l&apos;administrateur de l&apos;application à l&apos;adresse
              robin.massonfauchier@gmail.com.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-stone-200 pt-6">
          <Link
            href="/"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            ← Retour à Caissette
          </Link>
        </div>
      </main>
    </div>
  );
}
