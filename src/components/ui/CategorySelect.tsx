"use client";

import {
  Fuel,
  Gamepad2,
  HeartPulse,
  House,
  Layers,
  Repeat2,
  ShoppingBag,
  ShoppingBasket,
  Tag,
  TrainFront,
  UtensilsCrossed,
} from "lucide-react";
import { CATEGORIES, CATEGORY_STYLES } from "@/lib/catalog";
import type { Category } from "@/lib/types";
import {
  OptionSelect,
  type SelectOption,
} from "@/components/ui/OptionSelect";

export type CategoryValue = Category | "all";

const CATEGORY_ICONS: Record<Category, typeof Tag> = {
  Alimentation: ShoppingBasket,
  Restaurants: UtensilsCrossed,
  Transport: TrainFront,
  Carburant: Fuel,
  Santé: HeartPulse,
  Logement: House,
  Loisirs: Gamepad2,
  Shopping: ShoppingBag,
  Abonnements: Repeat2,
  Divers: Tag,
};

function buildOptions(includeAll: boolean): SelectOption<CategoryValue>[] {
  const categories: SelectOption<CategoryValue>[] = CATEGORIES.map(
    (category) => ({
      value: category,
      label: category,
      icon: CATEGORY_ICONS[category],
      chip: CATEGORY_STYLES[category].chip,
    }),
  );

  if (!includeAll) return categories;

  return [
    {
      value: "all",
      label: "Toutes les catégories",
      icon: Layers,
      chip: "bg-stone-100 text-stone-600 ring-stone-500/10",
    },
    ...categories,
  ];
}

export function CategorySelect({
  value,
  onChange,
  includeAll = false,
  variant = "form",
  className,
  ariaLabel = "Catégorie",
}: {
  value: CategoryValue;
  onChange: (value: CategoryValue) => void;
  includeAll?: boolean;
  variant?: "form" | "filter";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <OptionSelect
      value={value}
      onChange={onChange}
      options={buildOptions(includeAll)}
      ariaLabel={ariaLabel}
      variant={variant}
      className={className}
    />
  );
}
