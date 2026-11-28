"use client";

import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  Landmark,
  Layers,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PAYMENT_METHODS } from "@/lib/catalog";
import {
  OptionSelect,
  type SelectOption,
} from "@/components/ui/OptionSelect";

export const PAYMENT_STYLES: Record<
  string,
  { icon: LucideIcon; chip: string }
> = {
  "Carte bancaire": {
    icon: CreditCard,
    chip: "bg-sky-50 text-sky-700 ring-sky-600/15",
  },
  Espèces: {
    icon: Banknote,
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  },
  Chèque: {
    icon: Landmark,
    chip: "bg-amber-50 text-amber-700 ring-amber-600/15",
  },
  Virement: {
    icon: ArrowRightLeft,
    chip: "bg-violet-50 text-violet-700 ring-violet-600/15",
  },
  Autre: {
    icon: Wallet,
    chip: "bg-stone-100 text-stone-600 ring-stone-600/15",
  },
};

const DEFAULT_STYLE = {
  icon: Wallet,
  chip: "bg-stone-100 text-stone-600 ring-stone-600/15",
};

export type PaymentValue = string | "all";

export function paymentStyle(payment: string) {
  return PAYMENT_STYLES[payment] ?? DEFAULT_STYLE;
}

function buildOptions(
  includeAll: boolean,
  current: string,
): SelectOption<PaymentValue>[] {
  const values = [...PAYMENT_METHODS] as string[];
  // Conserve un moyen de paiement personnalisé déjà enregistré (vieille ligne
  // ou saisie libre) au lieu de le faire disparaître du menu.
  if (current && current !== "all" && !values.includes(current)) {
    values.unshift(current);
  }

  const options: SelectOption<PaymentValue>[] = values.map((payment) => ({
    value: payment,
    label: payment,
    ...paymentStyle(payment),
  }));

  if (!includeAll) return options;

  return [
    {
      value: "all",
      label: "Tous les paiements",
      icon: Layers,
      chip: "bg-stone-100 text-stone-600 ring-stone-500/10",
    },
    ...options,
  ];
}

export function PaymentSelect({
  value,
  onChange,
  includeAll = false,
  variant = "form",
  className,
  ariaLabel = "Moyen de paiement",
}: {
  value: PaymentValue;
  onChange: (value: PaymentValue) => void;
  includeAll?: boolean;
  variant?: "form" | "filter";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <OptionSelect
      value={value}
      onChange={onChange}
      options={buildOptions(includeAll, value)}
      ariaLabel={ariaLabel}
      variant={variant}
      className={className}
    />
  );
}
