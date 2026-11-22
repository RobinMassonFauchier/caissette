import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Paramètres — Caissette",
  description: "Budget mensuel, catégorie par défaut et accès à vos données.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
