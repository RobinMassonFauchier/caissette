import { isCategory, CATEGORIES } from "./catalog";
import type { Category, ExpenseFingerprint } from "./types";
import type { ExpenseInput, ExpensePatch } from "./sheet";
import { parseAmountInput } from "./format";
import {
  computeItemSavings,
  computeItemTva,
  MAX_ITEMS,
  normalizeItems,
  roundCurrency,
} from "./items";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type ExpensePatchResult = {
  patch: ExpensePatch;
  expectedUpdatedAt?: string;
  expectedOriginal?: ExpenseFingerprint;
  force?: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return parseAmountInput(value);
  return null;
}

function parseDate(value: unknown): string | null {
  const date = asString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const dateCheck = new Date(`${date}T12:00:00`);
  if (Number.isNaN(dateCheck.getTime())) return null;
  return date;
}

function parseMerchant(value: unknown): string | null {
  const merchant = asString(value).slice(0, 120);
  return merchant || null;
}

function parseCategory(value: unknown): Category | null {
  const category = asString(value);
  return isCategory(category) ? category : null;
}

function parseAmount(value: unknown): number | null {
  const raw = asNumber(value);
  if (raw === null || raw <= 0 || raw > 1_000_000) return null;
  return roundCurrency(raw);
}

function parsePayment(value: unknown): string {
  return (asString(value) || "Carte bancaire").slice(0, 40);
}

function parseNote(value: unknown): string {
  return asString(value).slice(0, 500);
}

function parseReceiptUrl(value: unknown): string | null {
  const receiptUrl = asString(value);
  if (receiptUrl && !/^https:\/\//i.test(receiptUrl)) return null;
  return receiptUrl;
}

function parseItemsPayload(
  value: unknown,
): Result<{ items: ReturnType<typeof normalizeItems>; tva: number | null; savings: number }> {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Le détail des articles est invalide." };
  }
  if (value.length > MAX_ITEMS) {
    return {
      ok: false,
      error: `Un ticket ne peut pas contenir plus de ${MAX_ITEMS} articles.`,
    };
  }

  const items = normalizeItems(value);
  if (value.length > 0 && items.length === 0) {
    return { ok: false, error: "Aucun article valide dans le détail du ticket." };
  }

  return {
    ok: true,
    value: {
      items,
      tva: computeItemTva(items),
      savings: computeItemSavings(items),
    },
  };
}

export function parseExpenseInput(payload: unknown): Result<ExpenseInput> {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Données invalides." };
  }

  const data = payload as Record<string, unknown>;

  const date = parseDate(data.date);
  if (!date) {
    return { ok: false, error: "La date est invalide (format attendu : AAAA-MM-JJ)." };
  }

  const merchant = parseMerchant(data.merchant);
  if (!merchant) {
    return { ok: false, error: "Indiquez le nom du magasin." };
  }

  const category = parseCategory(data.category);
  if (!category) {
    return {
      ok: false,
      error: `Catégorie inconnue. Valeurs possibles : ${CATEGORIES.join(", ")}.`,
    };
  }

  const amount = parseAmount(data.amount);
  if (amount === null) {
    return { ok: false, error: "Le montant doit être un nombre positif." };
  }

  const receiptUrl = parseReceiptUrl(data.receiptUrl);
  if (receiptUrl === null) {
    return { ok: false, error: "Le lien du ticket est invalide." };
  }

  let items = normalizeItems(data.items);
  let tva = computeItemTva(items);
  let savings = computeItemSavings(items);
  let ticketSavings = 0;

  if (data.items !== undefined) {
    const parsedItems = parseItemsPayload(data.items);
    if (!parsedItems.ok) return parsedItems;
    items = parsedItems.value.items;
    tva = parsedItems.value.tva;
    savings = parsedItems.value.savings;
  }

  if (
    data.ticketSavings !== undefined &&
    data.ticketSavings !== null &&
    data.ticketSavings !== ""
  ) {
    const parsedSavings = asNumber(data.ticketSavings);
    if (parsedSavings === null || parsedSavings < 0 || parsedSavings > amount) {
      return {
        ok: false,
        error: "Les économies du ticket doivent être comprises entre 0 et le montant.",
      };
    }
    ticketSavings = roundCurrency(parsedSavings);
    savings = roundCurrency(Math.max(savings, ticketSavings));
  }

  if (data.ticketTva !== undefined && data.ticketTva !== null && data.ticketTva !== "") {
    const ticketTva = asNumber(data.ticketTva);
    if (ticketTva === null || ticketTva < 0 || ticketTva > amount) {
      return {
        ok: false,
        error: "La TVA du ticket doit être comprise entre 0 et le montant total.",
      };
    }
    if (tva === null) tva = roundCurrency(ticketTva);
  }

  return {
    ok: true,
    value: {
      date,
      merchant,
      category,
      amount,
      payment: parsePayment(data.payment),
      note: parseNote(data.note),
      receiptUrl,
      items,
      tva,
      savings,
      ticketSavings,
      legacyTva: null,
    },
  };
}

/**
 * Validation d'une modification partielle : seuls les champs réellement
 * envoyés sont contrôlés et modifiés. Les autres restent intacts dans la
 * feuille Google.
 */
export function parseExpensePatch(payload: unknown): Result<ExpensePatchResult> {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Données invalides." };
  }

  const data = payload as Record<string, unknown>;
  const patch: ExpensePatch = {};
  let touched = 0;

  if (data.date !== undefined) {
    const date = parseDate(data.date);
    if (!date) {
      return { ok: false, error: "La date est invalide (format attendu : AAAA-MM-JJ)." };
    }
    patch.date = date;
    touched += 1;
  }

  if (data.merchant !== undefined) {
    const merchant = parseMerchant(data.merchant);
    if (!merchant) {
      return { ok: false, error: "Indiquez le nom du magasin." };
    }
    patch.merchant = merchant;
    touched += 1;
  }

  if (data.category !== undefined) {
    const category = parseCategory(data.category);
    if (!category) {
      return {
        ok: false,
        error: `Catégorie inconnue. Valeurs possibles : ${CATEGORIES.join(", ")}.`,
      };
    }
    patch.category = category;
    touched += 1;
  }

  if (data.amount !== undefined) {
    const amount = parseAmount(data.amount);
    if (amount === null) {
      return { ok: false, error: "Le montant doit être un nombre positif." };
    }
    patch.amount = amount;
    touched += 1;
  }

  if (data.payment !== undefined) {
    patch.payment = parsePayment(data.payment);
    touched += 1;
  }

  if (data.note !== undefined) {
    patch.note = parseNote(data.note);
    touched += 1;
  }

  if (data.receiptUrl !== undefined) {
    const receiptUrl = parseReceiptUrl(data.receiptUrl);
    if (receiptUrl === null) {
      return { ok: false, error: "Le lien du ticket est invalide." };
    }
    patch.receiptUrl = receiptUrl;
    touched += 1;
  }

  let ticketTva: number | null | undefined;
  if (
    data.ticketTva !== undefined &&
    data.ticketTva !== null &&
    data.ticketTva !== ""
  ) {
    const parsedTva = asNumber(data.ticketTva);
    if (parsedTva === null || parsedTva < 0) {
      return {
        ok: false,
        error: "La TVA du ticket doit être un nombre positif.",
      };
    }
    ticketTva = roundCurrency(parsedTva);
  }

  let ticketSavings: number | undefined;
  if (
    data.ticketSavings !== undefined &&
    data.ticketSavings !== null &&
    data.ticketSavings !== ""
  ) {
    const parsedSavings = asNumber(data.ticketSavings);
    if (parsedSavings === null || parsedSavings < 0) {
      return {
        ok: false,
        error: "Les économies du ticket doivent être un nombre positif.",
      };
    }
    ticketSavings = roundCurrency(parsedSavings);
  }

  if (data.items !== undefined) {
    const parsedItems = parseItemsPayload(data.items);
    if (!parsedItems.ok) return parsedItems;
    patch.items = parsedItems.value.items;
    patch.tva = parsedItems.value.tva ?? ticketTva ?? null;
    patch.savings = roundCurrency(
      Math.max(parsedItems.value.savings, ticketSavings ?? 0),
    );
    if (ticketSavings !== undefined) {
      patch.ticketSavings = ticketSavings;
    }
    touched += 1;
  } else if (ticketTva !== undefined) {
    patch.tva = ticketTva;
    touched += 1;
  } else if (ticketSavings !== undefined) {
    patch.ticketSavings = ticketSavings;
    patch.savings = ticketSavings;
    touched += 1;
  }

  if (touched === 0) {
    return { ok: false, error: "Aucune modification à enregistrer." };
  }

  let expectedOriginal: ExpenseFingerprint | undefined;
  if (
    typeof data.expectedOriginal === "object" &&
    data.expectedOriginal !== null
  ) {
    const raw = data.expectedOriginal as Record<string, unknown>;
    const fingerprintDate = parseDate(raw.date);
    const fingerprintMerchant = asString(raw.merchant);
    const fingerprintAmount = asNumber(raw.amount);
    const fingerprintCreatedAt = asString(raw.createdAt);
    if (
      fingerprintDate &&
      fingerprintMerchant &&
      fingerprintAmount !== null &&
      Number.isFinite(fingerprintAmount)
    ) {
      expectedOriginal = {
        date: fingerprintDate,
        merchant: fingerprintMerchant,
        amount: roundCurrency(fingerprintAmount),
        createdAt: fingerprintCreatedAt,
      };
    }
  }

  return {
    ok: true,
    value: {
      patch,
      expectedUpdatedAt:
        typeof data.expectedUpdatedAt === "string"
          ? data.expectedUpdatedAt
          : undefined,
      expectedOriginal,
      force: data.force === true,
    },
  };
}
