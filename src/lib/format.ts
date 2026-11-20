const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

export function formatEuro(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return euroFormatter.format(value);
}

export function formatDateShort(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return iso || "—";
  return shortDateFormatter.format(date).replace(".", "");
}

export function monthLabel(month: string): string {
  if (month === "all") return "Toutes les dépenses";
  const date = parseISODate(`${month}-01`);
  if (!date) return month;
  return monthFormatter.format(date);
}

export function formatMonthShort(month: string): string {
  const date = parseISODate(`${month}-01`);
  if (!date) return month;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" })
    .format(date)
    .replace(".", "");
}

/** Parse YYYY-MM-DD (ou un ISO complet) en date locale sans décalage de fuseau. */
export function parseISODate(iso: string): Date | null {
  if (!iso) return null;
  const dateOnly = iso.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const date = parseISODate(`${month}-01`);
  if (!date) return month;
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
