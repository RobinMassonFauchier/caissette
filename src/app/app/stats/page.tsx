import type { Metadata } from "next";
import { StatsView } from "@/components/stats/StatsView";

export const metadata: Metadata = {
  title: "Statistiques — Caissette",
  description:
    "Vos dépenses par mois, par catégorie, par moyen de paiement et par magasin.",
};

export default function StatsPage() {
  return <StatsView />;
}
