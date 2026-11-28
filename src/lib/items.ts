import { isCategory } from "./catalog";
import type {
  Category,
  ReceiptDetails,
  ReceiptItem,
  ReceiptItemKind,
} from "./types";

export const MAX_ITEMS = 150;

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function asFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(
      value.replace(/\s/g, "").replace("€", "").replace(",", "."),
    );
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBounded(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const parsed = asFinite(value);
  if (parsed === null || parsed < min || parsed > max) return null;
  return roundCurrency(parsed);
}

function isKind(value: unknown): value is ReceiptItemKind {
  return value === "item" || value === "discount" || value === "fee";
}

export function normalizeItem(input: unknown): ReceiptItem | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  const label = String(raw.label ?? raw.name ?? "").trim().slice(0, 120);
  if (!label) return null;

  const amount = asBounded(raw.amount ?? raw.price, 0, 1_000_000);
  if (amount === null || amount <= 0) return null;

  const category: Category = isCategory(raw.category)
    ? raw.category
    : "Divers";

  const sectionRaw =
    typeof raw.section === "string" ? raw.section.trim().slice(0, 80) : "";
  const section = sectionRaw || undefined;

  const unitRaw =
    typeof raw.unit === "string" ? raw.unit.trim().toLowerCase().slice(0, 10) : "";
  const unit = unitRaw || undefined;

  const kind: ReceiptItemKind = isKind(raw.kind) ? raw.kind : "item";
  const quantityRaw = asFinite(raw.quantity) ?? 1;
  const quantity = Math.max(
    0.001,
    Math.min(999, Math.round(quantityRaw * 1000) / 1000),
  );

  const unitPriceRaw = asBounded(raw.unitPrice, 0, 1_000_000);
  const unitPrice =
    unitPriceRaw === null || unitPriceRaw <= 0
      ? roundCurrency(amount / quantity)
      : unitPriceRaw;

  const tvaRaw = asBounded(raw.tva, 0, 1_000_000);
  const tva = tvaRaw !== null && tvaRaw <= amount ? tvaRaw : null;

  const tvaRateRaw = asBounded(raw.tvaRate, 0, 30);
  const tvaRate = tvaRateRaw !== null && tvaRateRaw > 0 ? tvaRateRaw : null;

  const savingsRaw = asBounded(raw.savings, 0, 1_000_000) ?? 0;
  const savings =
    kind === "discount"
      ? Math.max(savingsRaw, amount)
      : Math.min(savingsRaw, amount);

  return {
    label,
    category,
    section,
    quantity,
    unit,
    unitPrice,
    amount,
    tva,
    tvaRate,
    savings: roundCurrency(savings),
    bold: raw.bold === true,
    kind,
  };
}

export function normalizeItems(input: unknown): ReceiptItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(normalizeItem)
    .filter((item): item is ReceiptItem => item !== null)
    .slice(0, MAX_ITEMS);
}

export function computeItemSavings(items: ReceiptItem[]): number {
  const total = items.reduce((sum, item) => sum + item.savings, 0);
  return roundCurrency(total);
}

export function computeItemTva(items: ReceiptItem[]): number | null {
  const values = items
    .map((item) => item.tva)
    .filter((value): value is number => value !== null && value > 0);
  if (values.length === 0) return null;
  return roundCurrency(values.reduce((sum, value) => sum + value, 0));
}

export function computeItemsTotal(items: ReceiptItem[]): number {
  const total = items.reduce(
    (sum, item) =>
      item.kind === "discount" ? sum - item.amount : sum + item.amount,
    0,
  );
  return roundCurrency(total);
}

export function emptyDetails(legacyTva: number | null = null): ReceiptDetails {
  return {
    version: 1,
    items: [],
    tva: legacyTva,
    savings: 0,
    ticketSavings: 0,
    legacyTva,
  };
}

/**
 * Normalise le JSON « Articles » de la feuille. Tolère les anciens tickets
 * (sans JSON) et les données abîmées : on ne perd jamais la TVA héritée.
 */
export function normalizeDetails(
  input: unknown,
  legacyTva: number | null = null,
): ReceiptDetails {
  if (typeof input === "string" && input.trim()) {
    try {
      return normalizeDetails(JSON.parse(input), legacyTva);
    } catch {
      return emptyDetails(legacyTva);
    }
  }

  if (Array.isArray(input)) {
    const items = normalizeItems(input);
    return {
      version: 1,
      items,
      tva: computeItemTva(items) ?? legacyTva,
      savings: computeItemSavings(items),
      ticketSavings: 0,
      legacyTva,
    };
  }

  if (typeof input !== "object" || input === null) {
    return emptyDetails(legacyTva);
  }

  const raw = input as Record<string, unknown>;
  const items = normalizeItems(raw.items);
  const itemTva = computeItemTva(items);
  const explicitTva = asBounded(raw.tva, 0, 1_000_000);
  const explicitSavings = asBounded(raw.savings, 0, 1_000_000) ?? 0;
  const itemSavings = computeItemSavings(items);
  const ticketSavings = asBounded(raw.ticketSavings, 0, 1_000_000) ?? 0;
  const storedLegacy = asBounded(raw.legacyTva, 0, 1_000_000);
  const effectiveLegacy = legacyTva ?? storedLegacy ?? null;

  return {
    version: 1,
    items,
    tva: itemTva ?? explicitTva ?? effectiveLegacy,
    savings: roundCurrency(
      Math.max(explicitSavings, itemSavings, ticketSavings),
    ),
    ticketSavings,
    legacyTva: effectiveLegacy,
    source:
      raw.source === "pdf" || raw.source === "ocr" ? raw.source : undefined,
  };
}

export function parseDetailsJson(
  value: unknown,
  legacyTva: number | null = null,
): ReceiptDetails {
  const text = String(value ?? "").trim();
  if (!text) return emptyDetails(legacyTva);
  return normalizeDetails(text, legacyTva);
}

export function detailsToJson(details: ReceiptDetails): string {
  const clean = normalizeDetails(details, details.legacyTva ?? null);
  if (
    clean.items.length === 0 &&
    !clean.legacyTva &&
    !clean.ticketSavings &&
    !clean.tva
  ) {
    return "";
  }
  return JSON.stringify(clean);
}

/** Résumé utilisé par la feuille et par l'interface. */
export function summarizeDetails(
  items: ReceiptItem[],
  options: {
    legacyTva?: number | null;
    ticketTva?: number | null;
    ticketSavings?: number | null;
  } = {},
): Pick<ReceiptDetails, "tva" | "savings" | "ticketSavings" | "items"> {
  const itemSavings = computeItemSavings(items);
  const itemTva = computeItemTva(items);
  const ticketSavings = asBounded(options.ticketSavings, 0, 1_000_000) ?? 0;

  return {
    items,
    tva: itemTva ?? options.ticketTva ?? options.legacyTva ?? null,
    savings: roundCurrency(Math.max(itemSavings, ticketSavings)),
    ticketSavings,
  };
}
