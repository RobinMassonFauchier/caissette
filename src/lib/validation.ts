import { isCategory, CATEGORIES } from "./catalog";
import type { ExpenseInput } from "./sheet";
import { parseAmountInput } from "./format";

type Result =
  | { ok: true; value: ExpenseInput }
  | { ok: false; error: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return parseAmountInput(value);
  return null;
}

export function parseExpenseInput(payload: unknown): Result {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "Données invalides." };
  }

  const data = payload as Record<string, unknown>;

  const date = asString(data.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "La date est invalide (format attendu : AAAA-MM-JJ)." };
  }
  const dateCheck = new Date(`${date}T12:00:00`);
  if (Number.isNaN(dateCheck.getTime())) {
    return { ok: false, error: "La date est invalide." };
  }

  const merchant = asString(data.merchant).slice(0, 120);
  if (!merchant) {
    return { ok: false, error: "Indiquez le nom du magasin." };
  }

  const category = asString(data.category);
  if (!isCategory(category)) {
    return {
      ok: false,
      error: `Catégorie inconnue. Valeurs possibles : ${CATEGORIES.join(", ")}.`,
    };
  }

  const rawAmount = asNumber(data.amount);
  if (rawAmount === null || rawAmount <= 0 || rawAmount > 1_000_000) {
    return { ok: false, error: "Le montant doit être un nombre positif." };
  }
  const amount = Math.round(rawAmount * 100) / 100;

  const rawTva = data.tva === "" || data.tva === null || data.tva === undefined
    ? null
    : asNumber(data.tva);
  if (rawTva !== null && (rawTva < 0 || rawTva > amount)) {
    return { ok: false, error: "La TVA doit être comprise entre 0 et le montant total." };
  }
  const tva = rawTva === null ? null : Math.round(rawTva * 100) / 100;

  const payment = (asString(data.payment) || "Carte bancaire").slice(0, 40);
  const note = asString(data.note).slice(0, 500);

  const receiptUrl = asString(data.receiptUrl);
  if (receiptUrl && !/^https:\/\//i.test(receiptUrl)) {
    return { ok: false, error: "Le lien du ticket est invalide." };
  }

  return {
    ok: true,
    value: {
      date,
      merchant,
      category,
      amount,
      tva,
      payment,
      note,
      receiptUrl,
    },
  };
}
