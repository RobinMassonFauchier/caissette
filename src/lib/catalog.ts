import type { Category, PaymentMethod } from "./types";

export const CATEGORIES: Category[] = [
  "Alimentation",
  "Restaurants",
  "Transport",
  "Carburant",
  "Santé",
  "Logement",
  "Loisirs",
  "Shopping",
  "Abonnements",
  "Divers",
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  "Carte bancaire",
  "Espèces",
  "Chèque",
  "Virement",
  "Autre",
];

type CategoryStyle = {
  /** Pastille colorée (tableau). */
  chip: string;
  /** Barre du graphique par catégorie. */
  bar: string;
  /** Icône / point coloré. */
  dot: string;
  /** Couleur hexadécimale (graphiques). */
  hex: string;
};

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  Alimentation: {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    hex: "#10b981",
  },
  Restaurants: {
    chip: "bg-orange-50 text-orange-700 ring-orange-600/15",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    hex: "#f97316",
  },
  Transport: {
    chip: "bg-sky-50 text-sky-700 ring-sky-600/15",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    hex: "#0ea5e9",
  },
  Carburant: {
    chip: "bg-amber-50 text-amber-700 ring-amber-600/15",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  Santé: {
    chip: "bg-rose-50 text-rose-700 ring-rose-600/15",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    hex: "#f43f5e",
  },
  Logement: {
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-600/15",
    bar: "bg-indigo-500",
    dot: "bg-indigo-500",
    hex: "#6366f1",
  },
  Loisirs: {
    chip: "bg-violet-50 text-violet-700 ring-violet-600/15",
    bar: "bg-violet-500",
    dot: "bg-violet-500",
    hex: "#8b5cf6",
  },
  Shopping: {
    chip: "bg-pink-50 text-pink-700 ring-pink-600/15",
    bar: "bg-pink-500",
    dot: "bg-pink-500",
    hex: "#ec4899",
  },
  Abonnements: {
    chip: "bg-slate-100 text-slate-700 ring-slate-600/15",
    bar: "bg-slate-500",
    dot: "bg-slate-500",
    hex: "#64748b",
  },
  Divers: {
    chip: "bg-stone-100 text-stone-600 ring-stone-600/15",
    bar: "bg-stone-400",
    dot: "bg-stone-400",
    hex: "#a8a29e",
  },
};

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}
