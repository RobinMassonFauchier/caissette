import type { Metadata } from "next";
import Dashboard from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Dépenses — Caissette",
  description: "Vos tickets et vos dépenses du mois, classés automatiquement.",
};

export default function AppPage() {
  return <Dashboard />;
}
