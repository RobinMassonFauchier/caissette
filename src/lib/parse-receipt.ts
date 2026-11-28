import type {
  Category,
  ParsedReceipt,
  PaymentMethod,
  ReceiptItem,
} from "./types";
import { todayISO } from "./format";

/**
 * Extraction des informations d'un ticket de caisse français à partir du texte
 * brut (texte natif d'un PDF ou résultat d'OCR). Volontairement heuristique :
 * l'utilisateur relit et corrige toujours le résultat avant l'enregistrement.
 */

const FRENCH_MONTHS: Record<string, number> = {
  JANVIER: 1,
  FEVRIER: 2,
  MARS: 3,
  AVRIL: 4,
  MAI: 5,
  JUIN: 6,
  JUILLET: 7,
  AOUT: 8,
  SEPTEMBRE: 9,
  OCTOBRE: 10,
  NOVEMBRE: 11,
  DECEMBRE: 12,
};

const AMOUNT_RE =
  /(-?\d{1,3}(?:[ .]\d{3})*[,.]\d{2})(?!\d)(?!\s*%)/g;

const TVA_PATTERN = /T\.?\s?V\.?\s?A\.?/;
const TVA_TOTAL_PATTERN =
  /(?:TOTAL|DONT|MONTANT|TAXE)\s*(?:DE\s*)?(?:LA\s*)?T\.?\s?V\.?\s?A\.?|T\.?\s?V\.?\s?A\.?\s*(?:TOTALE|TOTAL|AFFICHEE|INCLUSE|COMPRISE|DU TICKET)/;

/**
 * Certains PDF renvoient tout le ticket sur une seule ligne (ou des colonnes
 * séparées par plusieurs espaces). On recoupe les lignes trop longues devant
 * les mots-clés d'un ticket pour que le reste de l'analyse retrouve ses repères.
 */
const LINE_BREAK_KEYWORDS =
  /\s+(?=(?:TOTAL|SOUS[ -]?TOTAL|TVA|DONT\s+TVA|DATE|HEURE|CARTE|ESPECES|ESPÈCES|CB|MERCI|RENDU|MONNAIE|SIRET|TEL)\b)/gi;

const MAX_LINE_LENGTH = 60;

function splitRawLines(text: string): string[] {
  const result: string[] = [];

  for (const rawLine of text.replace(/\r/g, "\n").split("\n")) {
    const line = rawLine.replace(/\u00a0/g, " ").trim();
    if (!line) continue;

    if (line.length <= MAX_LINE_LENGTH) {
      result.push(line);
      continue;
    }

    const chunks = line.split(/\s{2,}/).flatMap((chunk) =>
      chunk.length <= MAX_LINE_LENGTH ? [chunk] : chunk.split(LINE_BREAK_KEYWORDS),
    );

    for (const chunk of chunks) {
      const value = chunk.trim();
      if (value) result.push(value);
    }
  }

  return result;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function parseAmount(raw: string): number | null {
  const value = Number(
    raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."),
  );
  return Number.isFinite(value) ? value : null;
}

function extractAmounts(line: string): number[] {
  const amounts: number[] = [];
  for (const match of line.matchAll(AMOUNT_RE)) {
    const value = parseAmount(match[1]);
    if (value !== null && Math.abs(value) > 0 && Math.abs(value) < 1_000_000) {
      amounts.push(Math.abs(value));
    }
  }
  return amounts;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toISO(year: number, month: number, day: number): string | null {
  if (!isValidDate(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type DateCandidate = { date: string; score: number; index: number };

function findDate(rawLines: string[]): { date: string; found: boolean } {
  const candidates: DateCandidate[] = [];

  rawLines.forEach((rawLine, index) => {
    const line = normalizeText(rawLine);
    const nearbyDateLabel = rawLines
      .slice(Math.max(0, index - 2), index + 1)
      .some((candidate) => /\bDATE\b/.test(normalizeText(candidate)));
    const dateHint = nearbyDateLabel ? 4 : 0;
    // La date de transaction est presque toujours en haut du ticket ; les
    // dates des encarts publicitaires en bas ne doivent pas prendre le dessus.
    const positionBonus =
      index <= 12 ? 2 : index > rawLines.length - 15 ? -2 : 0;

    // 2026-11-20
    for (const match of line.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
      const iso = toISO(Number(match[1]), Number(match[2]), Number(match[3]));
      if (iso) {
        candidates.push({
          date: iso,
          score: dateHint + positionBonus + 3,
          index,
        });
      }
    }

    // 20/11/2026, 20.11.26, 20-11-2026
    for (const match of line.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g)) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      let year = Number(match[3]);
      if (match[3].length === 2) year += year < 80 ? 2000 : 1900;
      const iso = toISO(year, month, day);
      if (iso) {
        candidates.push({
          date: iso,
          score: dateHint + positionBonus + 2,
          index,
        });
      }
    }

    // 20 NOVEMBRE 2026
    for (const match of line.matchAll(
      /\b(\d{1,2})\s+(JANVIER|FEVRIER|MARS|AVRIL|MAI|JUIN|JUILLET|AOUT|SEPTEMBRE|OCTOBRE|NOVEMBRE|DECEMBRE)\s+(\d{4})\b/g,
    )) {
      const iso = toISO(
        Number(match[3]),
        FRENCH_MONTHS[match[2]],
        Number(match[1]),
      );
      if (iso) {
        candidates.push({
          date: iso,
          score: dateHint + positionBonus + 3,
          index,
        });
      }
    }
  });

  if (candidates.length === 0) {
    return { date: todayISO(), found: false };
  }

  const today = todayISO();
  const notInFuture = candidates.filter((c) => c.date <= today);
  const pool = notInFuture.length > 0 ? notInFuture : candidates;

  pool.sort((a, b) => b.score - a.score || a.index - b.index);
  return { date: pool[0].date, found: true };
}

const TOTAL_EXCLUDED =
  /(TVA|H\.?T\b|SOUS[ -]?TOTAL|ARTICLE|REMISE|REDUCTION|ECONOMIE|FIDELITE|DONT|CARTE|ESPECES|RENDU|MONNAIE|CHEQUE|SOLDE|ANCIEN|AVANT|POINTS|NB\b|NOMBRE)/;

function totalScore(line: string): number {
  if (/\bNET A PAYER\b/.test(line)) return 5;
  if (/\bTOTAL TTC\b/.test(line)) return 4;
  if (/\bTOTAL A PAYER\b/.test(line) || /\bA PAYER\b/.test(line)) return 4;
  if (/\bMONTANT TOTAL\b/.test(line)) return 3;
  if (/\bTOTAL EUR\b/.test(line) || /\bTOTAL EURO\b/.test(line)) return 3;
  if (/\bTOTAL\b/.test(line)) return 2;
  if (/\bMONTANT\b/.test(line)) return 1;
  return 0;
}

function findTotal(rawLines: string[]): {
  amount: number | null;
  certain: boolean;
  index: number | null;
} {
  type Candidate = { amount: number; score: number; index: number };
  const candidates: Candidate[] = [];

  rawLines.forEach((rawLine, index) => {
    const line = normalizeText(rawLine);
    const score = totalScore(line);
    if (score === 0 || TOTAL_EXCLUDED.test(line)) return;
    const amounts = extractAmounts(rawLine);
    if (amounts.length === 0) return;
    // Le montant total est en général le dernier nombre de la ligne.
    candidates.push({ amount: amounts[amounts.length - 1], score, index });
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score || b.index - a.index);
    return {
      amount: candidates[0].amount,
      certain: candidates[0].score >= 2,
      index: candidates[0].index,
    };
  }

  // Dernier recours : le plus gros montant du ticket (hors lignes de paiement).
  const fallback: { amount: number; index: number }[] = [];
  rawLines.forEach((rawLine, index) => {
    const line = normalizeText(rawLine);
    if (TOTAL_EXCLUDED.test(line)) return;
    for (const amount of extractAmounts(rawLine)) {
      fallback.push({ amount, index });
    }
  });

  const best = fallback.sort((a, b) => b.amount - a.amount)[0];
  return {
    amount: best?.amount ?? null,
    certain: false,
    index: best?.index ?? null,
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function isValidTvaAmount(amount: number, total: number | null): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (amount > 50_000) return false;
  // La TVA est toujours strictement inférieure au total TTC.
  if (total !== null && amount >= total) return false;
  return true;
}

function hasPlausibleTvaRate(amount: number, total: number | null): boolean {
  if (total === null) return true;
  const base = total - amount;
  if (base <= 0) return false;
  const impliedRate = (amount / base) * 100;
  return impliedRate >= 0.5 && impliedRate <= 30;
}

const COMMON_TVA_RATES = [5, 5.5, 10, 20];

function isCommonTvaRate(value: number): boolean {
  return COMMON_TVA_RATES.some((rate) => Math.abs(rate - value) < 0.06);
}

function tvaFromRate(total: number, rate: number): number {
  return roundCurrency(total - total / (1 + rate / 100));
}

function matchesTvaRate(amount: number, total: number, rate: number): boolean {
  const base = total - amount;
  if (base <= 0) return false;
  const implied = (amount / base) * 100;
  return Math.abs(implied - rate) <= Math.max(1.5, rate * 0.15);
}

/**
 * La TVA est souvent présentée de trois façons :
 *   - une ligne de total : « TOTAL TVA 7,55 » ou « DONT TVA 7,55 » ;
 *   - un tableau par taux : « TVA 5,50% 0,52 » puis « TVA 20,00% 7,03 » ;
 *   - une seule ligne : « TVA 20,00% 7,03 ».
 *
 * Correctif V2 : le taux est désormais lu séparément du montant, ce qui évite
 * de confondre « TVA 20,00 » (taux dont le montant a sauté à l'OCR) avec une
 * TVA de 20 €. Si seul le taux est lisible et que le total est connu, la TVA
 * est recalculée : total × taux / (100 + taux).
 */
function findTva(rawLines: string[], total: number | null): number | null {
  type Detail = {
    rate: number | null;
    amount: number;
    index: number;
    /** Montant déduit du taux, et non lu explicitement sur le ticket. */
    computed: boolean;
  };

  const details: Detail[] = [];
  let explicitTotal: number | null = null;

  rawLines.forEach((rawLine, index) => {
    const line = normalizeText(rawLine);
    if (!TVA_PATTERN.test(line)) return;

    const rateMatches = [
      ...line.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g),
    ];
    const parsedRate = rateMatches.length
      ? parseAmount(rateMatches[rateMatches.length - 1][1])
      : null;
    const rate =
      parsedRate !== null && parsedRate > 0 && parsedRate <= 30
        ? parsedRate
        : null;

    const withoutRates = rateMatches.length
      ? line.replace(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g, " ")
      : line;
    const amounts = extractAmounts(withoutRates);

    // 1. Total de TVA explicitement indiqué.
    if (TVA_TOTAL_PATTERN.test(line)) {
      // Une ligne « TOTAL TVA 96,80 9,30 106,10 » contient le HT, la TVA et le
      // TTC : on choisit le montant qui reste plausible comme TVA, pas le
      // dernier nombre de la ligne.
      const candidate = amounts.find(
        (value) =>
          isValidTvaAmount(value, total) &&
          hasPlausibleTvaRate(value, total) &&
          (rate === null ||
            total === null ||
            matchesTvaRate(value, total, rate)),
      );
      if (candidate !== undefined) {
        explicitTotal = candidate;
        return;
      }
    }

    if (rate !== null) {
      const candidate =
        amounts.find(
          (amount) =>
            isValidTvaAmount(amount, total) &&
            (total === null || matchesTvaRate(amount, total, rate)),
        ) ?? amounts[amounts.length - 1];

      if (
        candidate !== undefined &&
        isValidTvaAmount(candidate, total) &&
        hasPlausibleTvaRate(candidate, total)
      ) {
        details.push({ rate, amount: candidate, index, computed: false });
        return;
      }

      if (total !== null) {
        details.push({
          rate,
          amount: tvaFromRate(total, rate),
          index,
          computed: true,
        });
      }
      return;
    }

    if (amounts.length >= 2) {
      const first = amounts[0];
      const last = amounts[amounts.length - 1];
      if (
        isCommonTvaRate(first) &&
        isValidTvaAmount(last, total) &&
        (total === null || matchesTvaRate(last, total, first))
      ) {
        details.push({ rate: first, amount: last, index, computed: false });
        return;
      }
    }

    if (amounts.length === 0) {
      const bare = /\b(\d{1,2})\b/.exec(
        line.replace(TVA_PATTERN, " ").replace(/TOTALE?|AFFICHEE|INCLUSE|COMPRISE/g, " "),
      );
      const bareRate = bare ? Number(bare[1]) : null;
      if (
        bareRate !== null &&
        isCommonTvaRate(bareRate) &&
        total !== null
      ) {
        details.push({
          rate: bareRate,
          amount: tvaFromRate(total, bareRate),
          index,
          computed: true,
        });
      }
      return;
    }

    const value = amounts[amounts.length - 1];
    if (value === undefined) return;

    // Un nombre isolé qui ressemble à un taux (5, 5,5, 10, 20) est un taux,
    // pas un montant : on le recalcule à partir du total TTC.
    if (rate === null && isCommonTvaRate(value) && value >= 5) {
      if (total !== null) {
        details.push({
          rate: value,
          amount: tvaFromRate(total, value),
          index,
          computed: true,
        });
      }
      // Sans total, impossible de distinguer un taux d'un montant : on
      // préfère ne rien proposer plutôt qu'une TVA fausse.
      return;
    }

    if (isValidTvaAmount(value, total) && hasPlausibleTvaRate(value, total)) {
      details.push({ rate: null, amount: value, index, computed: false });
    }
  });

  if (
    explicitTotal !== null &&
    isValidTvaAmount(explicitTotal, total) &&
    hasPlausibleTvaRate(explicitTotal, total)
  ) {
    return roundCurrency(explicitTotal);
  }

  if (details.length === 0) return null;

  // On ne garde que le dernier bloc de lignes de TVA : c'est le tableau
  // récapitulatif du bas de ticket. Cela évite de compter deux fois un même
  // taux affiché à la fois en haut et en bas.
  const groups: Detail[][] = [];
  for (const detail of details) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    if (current && previous && detail.index - previous.index <= 2) {
      current.push(detail);
    } else {
      groups.push([detail]);
    }
  }

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    const byRate = new Map<number, { amount: number; computed: boolean }>();
    const unrated: number[] = [];

    for (const detail of group) {
      if (detail.rate === null) {
        unrated.push(detail.amount);
        continue;
      }

      const existing = byRate.get(detail.rate);
      if (!existing) {
        byRate.set(detail.rate, {
          amount: detail.amount,
          computed: detail.computed,
        });
      } else if (existing.computed && !detail.computed) {
        // Un montant réellement lu est plus fiable qu'un montant recalculé
        // depuis le taux (ligne « TVA 20 % » sans montant).
        byRate.set(detail.rate, {
          amount: detail.amount,
          computed: false,
        });
      } else if (!existing.computed && !detail.computed) {
        byRate.set(detail.rate, {
          amount: roundCurrency(existing.amount + detail.amount),
          computed: false,
        });
      } else if (existing.computed && detail.computed) {
        byRate.set(detail.rate, detail);
      }
    }

    const sum = roundCurrency(
      [...byRate.values()].reduce(
        (totalTva, detail) => totalTva + detail.amount,
        0,
      ) + unrated.reduce((totalTva, amount) => totalTva + amount, 0),
    );

    if (isValidTvaAmount(sum, total) && hasPlausibleTvaRate(sum, total)) {
      return sum;
    }
  }

  return null;
}

type Brand = {
  pattern: RegExp;
  name: string;
  category: Category;
  /** Marque dont le nom est un mot courant : à chercher uniquement en haut. */
  headerOnly?: boolean;
};

const BRANDS: Brand[] = [
  { pattern: /\bCARREFOUR MARKET\b/, name: "Carrefour Market", category: "Alimentation" },
  { pattern: /\bCARREFOUR CITY\b/, name: "Carrefour City", category: "Alimentation" },
  { pattern: /\bCARREFOUR CONTACT\b/, name: "Carrefour Contact", category: "Alimentation" },
  { pattern: /\bCARREFOUR EXPRESS\b/, name: "Carrefour Express", category: "Alimentation" },
  { pattern: /\bCARREFOUR\b/, name: "Carrefour", category: "Alimentation" },
  { pattern: /\bE\.?\s?LECLERC\b|\bLECLERC\b/, name: "E.Leclerc", category: "Alimentation" },
  { pattern: /\bLIDL\b/, name: "Lidl", category: "Alimentation" },
  { pattern: /\bALDI\b/, name: "Aldi", category: "Alimentation" },
  { pattern: /\bAUCHAN\b/, name: "Auchan", category: "Alimentation" },
  { pattern: /\bINTERMARCHE\b/, name: "Intermarché", category: "Alimentation" },
  { pattern: /\bSUPER U\b|\bHYPER U\b|\bU EXPRESS\b|\bMAGASIN U\b/, name: "Système U", category: "Alimentation" },
  { pattern: /\bMONOPRIX\b/, name: "Monoprix", category: "Alimentation" },
  { pattern: /\bCASINO\b/, name: "Casino", category: "Alimentation", headerOnly: true },
  { pattern: /\bFRANPRIX\b/, name: "Franprix", category: "Alimentation" },
  { pattern: /\bPICARD\b/, name: "Picard", category: "Alimentation" },
  { pattern: /\bBIOCOOP\b|\bNATURALIA\b/, name: "Biocoop", category: "Alimentation" },
  { pattern: /\bGRAND FRAIS\b/, name: "Grand Frais", category: "Alimentation" },
  { pattern: /\bMETRO\b/, name: "Metro", category: "Alimentation", headerOnly: true },
  { pattern: /\bCOSTCO\b/, name: "Costco", category: "Alimentation" },
  { pattern: /\bCORA\b/, name: "Cora", category: "Alimentation" },
  { pattern: /\bMAXIMARCHE\b/, name: "Maximarché", category: "Alimentation" },
  { pattern: /\bNETTO\b/, name: "Netto", category: "Alimentation" },
  { pattern: /\bSPAR\b/, name: "Spar", category: "Alimentation", headerOnly: true },
  { pattern: /\bVIVAL\b/, name: "Vival", category: "Alimentation", headerOnly: true },
  { pattern: /\bMATCH\b/, name: "Match", category: "Alimentation", headerOnly: true },

  { pattern: /\bMCDONALD'?S?\b|\bMCDO\b/, name: "McDonald's", category: "Restaurants" },
  { pattern: /\bBURGER KING\b/, name: "Burger King", category: "Restaurants" },
  { pattern: /\bKFC\b/, name: "KFC", category: "Restaurants" },
  { pattern: /\bSUBWAY\b/, name: "Subway", category: "Restaurants" },
  { pattern: /\bDOMINO'?S\b/, name: "Domino's Pizza", category: "Restaurants" },
  { pattern: /\bPIZZA HUT\b/, name: "Pizza Hut", category: "Restaurants" },
  { pattern: /\bSTARBUCKS\b/, name: "Starbucks", category: "Restaurants" },
  { pattern: /\bUBER EATS\b/, name: "Uber Eats", category: "Restaurants" },
  { pattern: /\bDELIVEROO\b/, name: "Deliveroo", category: "Restaurants" },
  { pattern: /\bPAUL\b/, name: "Paul", category: "Restaurants", headerOnly: true },
  { pattern: /\bBRIOCHE DOREE\b/, name: "Brioche Dorée", category: "Restaurants" },

  { pattern: /\bUBER\b/, name: "Uber", category: "Transport", headerOnly: true },
  { pattern: /\bBOLT\b/, name: "Bolt", category: "Transport", headerOnly: true },
  { pattern: /\bBLABLACAR\b/, name: "BlaBlaCar", category: "Transport" },
  { pattern: /\bSNCF\b|\bOUIGO\b|\bTGV\b/, name: "SNCF", category: "Transport" },
  { pattern: /\bRATP\b|\bNAVIGO\b/, name: "RATP", category: "Transport" },

  { pattern: /\bTOTALENERGIES\b|\bTOTAL ENERGIES\b/, name: "TotalEnergies", category: "Carburant" },
  { pattern: /\bESSO\b/, name: "Esso", category: "Carburant" },
  { pattern: /\bSHELL\b/, name: "Shell", category: "Carburant" },
  { pattern: /\bAVIA\b/, name: "Avia", category: "Carburant" },

  { pattern: /\bPHARMACIE\b/, name: "Pharmacie", category: "Santé" },
  { pattern: /\bOPTIC(?:IEN|2000)\b/, name: "Opticien", category: "Santé" },

  { pattern: /\bAMAZON\b/, name: "Amazon", category: "Shopping" },
  { pattern: /\bFNAC\b/, name: "Fnac", category: "Shopping" },
  { pattern: /\bDARTY\b/, name: "Darty", category: "Shopping" },
  { pattern: /\bIKEA\b/, name: "Ikea", category: "Shopping" },
  { pattern: /\bLEROY MERLIN\b/, name: "Leroy Merlin", category: "Shopping" },
  { pattern: /\bCASTORAMA\b/, name: "Castorama", category: "Shopping" },
  { pattern: /\bBRICO DEPOT\b/, name: "Brico Dépôt", category: "Shopping" },
  { pattern: /\bDECATHLON\b/, name: "Decathlon", category: "Shopping" },
  { pattern: /\bACTION\b/, name: "Action", category: "Shopping", headerOnly: true },
  { pattern: /\bGIFI\b/, name: "Gifi", category: "Shopping" },
  { pattern: /\bKIABI\b/, name: "Kiabi", category: "Shopping" },
  { pattern: /\bZARA\b/, name: "Zara", category: "Shopping" },
  { pattern: /\bH&M\b|\bH & M\b/, name: "H&M", category: "Shopping" },
  { pattern: /\bCULTURA\b/, name: "Cultura", category: "Shopping" },
  { pattern: /\bSEPHORA\b/, name: "Sephora", category: "Shopping" },
  { pattern: /\bGALERIES LAFAYETTE\b/, name: "Galeries Lafayette", category: "Shopping" },

  { pattern: /\bNETFLIX\b/, name: "Netflix", category: "Abonnements" },
  { pattern: /\bSPOTIFY\b/, name: "Spotify", category: "Abonnements" },
  { pattern: /\bDISNEY\s?\+?\b/, name: "Disney+", category: "Abonnements" },
  { pattern: /\bCANAL\s?\+?\b/, name: "Canal+", category: "Abonnements", headerOnly: true },
  { pattern: /\bPRIME VIDEO\b/, name: "Prime Video", category: "Abonnements" },
  { pattern: /\bSTEAM\b/, name: "Steam", category: "Loisirs", headerOnly: true },

  { pattern: /\bEDF\b/, name: "EDF", category: "Logement" },
  { pattern: /\bENGIE\b/, name: "Engie", category: "Logement" },
  { pattern: /\bORANGE\b/, name: "Orange", category: "Logement", headerOnly: true },
  { pattern: /\bSFR\b/, name: "SFR", category: "Logement", headerOnly: true },
  { pattern: /\bBOUYGUES TELECOM\b/, name: "Bouygues Telecom", category: "Logement" },
  { pattern: /\bFREE\b/, name: "Free", category: "Logement", headerOnly: true },
];

const CATEGORY_KEYWORDS: { category: Category; pattern: RegExp }[] = [
  { category: "Carburant", pattern: /\b(GASOIL|ESSENCE|SP95|SP98|E10|E85|GPL|CARBURANT|POMPE)\b/ },
  { category: "Abonnements", pattern: /\b(ABONNEMENT|FORFAIT|NETFLIX|SPOTIFY|DISNEY|CANAL|PRIME VIDEO)\b/ },
  { category: "Transport", pattern: /\b(SNCF|RATP|TGV|OUIGO|TER|BUS|METRO|TRAM|PEAGE|AUTOROUTE|PARKING|NAVIGO|BILLET)\b/ },
  { category: "Restaurants", pattern: /\b(RESTAURANT|BRASSERIE|BISTRO|SNACK|PIZZERIA|SUSHI|TACOS|CAFE|BOULANGERIE)\b/ },
  { category: "Alimentation", pattern: /\b(SUPERMARCHE|SUPERETTE|EPICERIE|MARCHE|ALIMENTATION|BOUCHERIE|PRIMEUR|FROMAGERIE|PATISSERIE)\b/ },
  { category: "Santé", pattern: /\b(PHARMACIE|MEDECIN|DENTISTE|CLINIQUE|HOPITAL|OPTICIEN|LABORATOIRE|MUTUELLE)\b/ },
  { category: "Logement", pattern: /\b(LOYER|ELECTRICITE|GAZ|EAU|INTERNET|ASSURANCE HABITATION|CHAUFFAGE)\b/ },
  { category: "Loisirs", pattern: /\b(CINEMA|UGC|PATHE|GAUMONT|MUSEE|THEATRE|FITNESS|PISCINE|LOISIR|JEUX)\b/ },
  { category: "Shopping", pattern: /\b(VETEMENT|CHAUSSURES|MEUBLE|BRICOLAGE|JOUET|LIBRAIRIE)\b/ },
];

const MERCHANT_NOISE =
  /(TICKET|RECU|REÇU|MERCI|BIENVENUE|A BIENTOT|BONNE JOURNEE|BONNE SOIREE|CAISSE|SIRET|SIREN|RCS|TVA|TEL|TELEPHONE|FAX|WWW\.|HTTP|@|DATE|HEURE|CLIENT|FACTURE|COMMANDE|NUMERO|ADRESSE|MONTANT|TOTAL|CARTE|ESPECES|ESPÈCES|RENDU|MONNAIE|CHEQUE|SOLDE|DUPLICATA|ORIGINAL|COPIE|OUVERT|HORAIRES|PROMOTION|FIDELITE)/;

/** Bruit spécifique aux lignes d'articles : ne pas rejeter « Original » ou « Copie » dans un libellé produit. */
const ITEM_NOISE =
  /(TICKET|RECU|REÇU|MERCI|BIENVENUE|A BIENTOT|CAISSE|SIRET|SIREN|RCS|TVA|TEL|TELEPHONE|FAX|WWW\.|HTTP|@|DATE|HEURE|CLIENT|FACTURE|COMMANDE|NUMERO|ADRESSE|MONTANT|TOTAL|CARTE|ESPECES|ESPÈCES|RENDU|MONNAIE|CHEQUE|SOLDE|HORAIRES|PROMOTION|FIDELITE)/;

const STREET_NOISE =
  /\b(RUE|AVENUE|AV|BOULEVARD|BD|PLACE|ROUTE|CHEMIN|IMPASSE|ALLEE|ZONE|ZA|ZI|CENTRE COMMERCIAL|GALERIE|QUAI|COURS|PASSAGE|SQUARE|LIEU DIT|CEDEX|BP)\b/;

const LEGAL_SUFFIX =
  /\s+\b(?:SARL|SASU?|EURL|SCI|SNC|RCS|SIRET|SIREN|APE|NAF)\b[\s\S]*$/i;

function cleanMerchantLine(line: string): string {
  return line
    .replace(/[*=~_|<>[\]{}]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—.:;]+|[\s\-–—.:;]+$/g, "")
    .trim();
}

function cleanMerchantName(line: string): string {
  return cleanMerchantLine(
    line
      .replace(LEGAL_SUFFIX, "")
      .replace(/\s*[#N°]\s*\d+$/i, "")
      .replace(/\s{2,}/g, " "),
  );
}

function titleCase(value: string): string {
  const hasLowercase = /[a-zà-ÿ]/.test(value);
  if (hasLowercase) return value;
  return value
    .toLowerCase()
    .replace(/(^|[\s'’\-/])(\p{L})/gu, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

function merchantScore(line: string, index: number): number {
  let score = 6 - Math.min(index, 5);
  if (index === 0) score += 3;
  if (line === line.toUpperCase()) score += 1;
  if (line.length >= 6) score += 1;
  if (line.split(/\s+/).length >= 2) score += 1;
  if (/\d/.test(line)) score -= 2;
  return score;
}

/**
 * Cherche une enseigne connue en haut du ticket. On teste d'abord deux lignes
 * consécutives pour reconnaître « CARREFOUR » puis « MARKET » sur deux lignes
 * distinctes, puis chaque ligne seule. On s'arrête à la première trouvée pour
 * éviter qu'une marque citée plus bas (produit, publicité) prenne le dessus.
 */
function findBrandInHeader(rawLines: string[]): Brand | null {
  const header = rawLines.slice(0, 12).map(normalizeText);

  for (let index = 0; index < header.length; index += 1) {
    const line = header[index];
    const pair = `${line} ${header[index + 1] ?? ""}`.trim();

    for (const brand of BRANDS) {
      if (brand.headerOnly) continue;
      if (brand.pattern.test(pair)) return brand;
    }

    for (const brand of BRANDS) {
      if (
        brand.headerOnly &&
        (index > 4 ||
          line.length > 24 ||
          /\d+[.,]\d{2}/.test(line) ||
          line.split(/\s+/).length > 3)
      ) {
        continue;
      }
      if (brand.pattern.test(line)) return brand;
    }
  }

  return null;
}

function findCityFromAddress(rawLines: string[]): string | null {
  const header = rawLines.slice(0, 15);
  for (let index = 0; index < header.length - 1; index += 1) {
    const line = cleanMerchantLine(header[index]);
    const next = header[index + 1].trim();
    if (
      /^[A-Za-zÀ-ÿ'’ -]{2,32}$/.test(line) &&
      /^\d{5}\b/.test(next) &&
      !MERCHANT_NOISE.test(normalizeText(line)) &&
      !STREET_NOISE.test(normalizeText(line))
    ) {
      return titleCase(line);
    }
  }
  return null;
}

/**
 * Les tickets « Magasin U » n'impriment pas toujours l'enseigne en texte
 * (logo). On s'appuie sur la Carte U et sur la ville de l'adresse pour
 * reconstruire un libellé utile : « Magasin U Rognonas ».
 */
function findUStore(rawLines: string[]): {
  merchant: string;
  found: boolean;
  category: Category | null;
} | null {
  const full = normalizeText(rawLines.join(" "));
  if (!/\b(CARTE U|MAGASIN U|SUPER U|HYPER U|U EXPRESS)\b/.test(full)) {
    return null;
  }

  const city = findCityFromAddress(rawLines);
  return {
    merchant: city ? `Magasin U ${city}` : "Magasin U",
    found: true,
    category: "Alimentation",
  };
}

function findMerchant(rawLines: string[]): {
  merchant: string;
  found: boolean;
  category: Category | null;
} {
  const uStore = findUStore(rawLines);
  if (uStore) return uStore;

  const brand = findBrandInHeader(rawLines);
  if (brand) {
    return { merchant: brand.name, found: true, category: brand.category };
  }

  const candidates = rawLines
    .slice(0, 12)
    .map((rawLine, index) => {
      const line = cleanMerchantLine(rawLine);
      return { line, index };
    })
    .filter(({ line }) => {
      if (line.length < 3 || line.length > 42) return false;
      if (!/[a-zA-ZÀ-ÿ]/.test(line)) return false;

      const normalized = normalizeText(line);
      if (MERCHANT_NOISE.test(normalized)) return false;
      if (STREET_NOISE.test(normalized)) return false;
      if (/^(SARL|SASU?|EURL|SCI|SNC)$/.test(normalized)) return false;

      // Évite les lignes d'adresse, de téléphone et de codes.
      const digits = (line.match(/\d/g) || []).length;
      if (digits > Math.max(2, line.length * 0.25)) return false;
      if (
        /\d{3,}/.test(line) &&
        (line.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length < 4
      ) {
        return false;
      }
      if (/\d+[.,]\d{2}/.test(line)) return false;

      return true;
    })
    .map(({ line, index }) => {
      const name = titleCase(cleanMerchantName(line));
      return { name, score: merchantScore(name, index) };
    })
    .filter(({ name }) => name.length >= 3)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return { merchant: "", found: false, category: null };
  }

  return { merchant: candidates[0].name, found: true, category: null };
}

function findCategory(
  fullText: string,
  merchant: string,
  brandCategory: Category | null,
): Category {
  const normalized = normalizeText(fullText);

  // Les mots-clés « forts » priment sur la marque (ex. station-service Carrefour).
  if (/\b(GASOIL|ESSENCE|SP95|SP98|E10|E85|GPL|CARBURANT)\b/.test(normalized)) {
    return "Carburant";
  }

  if (brandCategory) return brandCategory;

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.pattern.test(normalized)) return entry.category;
  }

  if (merchant) return "Divers";
  return "Divers";
}

function findPayment(fullText: string): PaymentMethod {
  const normalized = normalizeText(fullText);

  if (/\b(CARTE BANCAIRE|PAIEMENT CARTE|CARTE CB|CB\b|VISA|MASTERCARD|CONTACTLESS|SANS CONTACT)\b/.test(normalized)) {
    return "Carte bancaire";
  }
  if (/\b(ESPECES|LIQUIDE|CASH)\b/.test(normalized)) return "Espèces";
  if (/\b(CHEQUE)\b/.test(normalized)) return "Chèque";
  if (/\b(VIREMENT)\b/.test(normalized)) return "Virement";
  return "Carte bancaire";
}

/* ------------------------------------------------------------------ */
/* Détail des articles                                                */
/* ------------------------------------------------------------------ */

const ITEM_CATEGORY_RULES: { category: Category; pattern: RegExp }[] = [
  {
    category: "Carburant",
    pattern:
      /\b(GASOIL|ESSENCE|SP95|SP98|E10|E85|GPL|CARBURANT|DIESEL|ADBLUE|POMPE|LITRE)\b/,
  },
  {
    category: "Abonnements",
    pattern:
      /\b(ABONNEMENT|FORFAIT|NETFLIX|SPOTIFY|DISNEY|CANAL|PRIME VIDEO|YOUTUBE|APPLE|ICLOUD|GOOGLE ONE|MICROSOFT|OFFICE 365|ORANGE|SFR|BOUYGUES|FREE|INTERNET|MOBILE|TELEPHONE)\b/,
  },
  {
    category: "Transport",
    pattern:
      /\b(SNCF|RATP|TGV|OUIGO|TER|BUS|METRO|TRAM|PEAGE|AUTOROUTE|PARKING|NAVIGO|BILLET|TRAIN|AVION|UBER|BOLT|CARBURANT)\b/,
  },
  {
    category: "Santé",
    pattern:
      /\b(PHARMACIE|MEDICAMENT|DOLIPRANE|PARACETAMOL|SPASFON|VITAMINE|COMPLEMENT|MASQUE|TEST|OPTIQUE|LUNETTES|PANSEMENT|SIROP|SERUM PHYSIOLOGIQUE)\b/,
  },
  {
    category: "Logement",
    pattern:
      /\b(LESSIVE|DETERGENT|NETTOYANT|EAU DE JAVEL|PAPIER TOILETTE|ESSUIE TOUT|AMPOULE|PILE|BOULON|BRICOLAGE|PEINTURE|JARDIN|PLANTE|TERREAU|LOYER|ELECTRICITE|GAZ|ASSURANCE|CHAUFFAGE|MEUBLE|VAISSELLE|SAC POUBELLE|EPONGE)\b/,
  },
  {
    category: "Loisirs",
    pattern:
      /\b(CINEMA|UGC|PATHE|GAUMONT|MUSEE|THEATRE|FITNESS|PISCINE|LOISIR|JEUX|JOUET|JEU|LIVRE|BD|MAGAZINE)\b/,
  },
  {
    category: "Shopping",
    pattern:
      /\b(VETEMENT|CHAUSSURE|CHAUSSURES|MEUBLE|JOUET|LIBRAIRIE|CADEAU|BIJOU|SAC|COSMETIQUE|PARFUM|MAQUILLAGE|SHAMPOO|SAVON|DENTIFRICE|DEODORANT|RASOIR|COUCHES|PILE)\b/,
  },
  {
    category: "Alimentation",
    pattern:
      /\b(PAIN|BAGUETTE|CROISSANT|LAIT|BEURRE|OEUF|OEUFS|FROMAGE|YAOURT|FRUIT|LEGUME|VIANDE|POULET|POISSON|PATE|RIZ|CAFE|THE|EAU|JUS|SODA|BISCUIT|CHOCOLAT|CEREALE|CONSERVE|HUILE|SUCRE|FARINE|SALADE|TOMATE|POMME|BANANE|COMPOTE|SURGELE|PIZZA|LAITIER|CREME FRAICHE|EPICE|SAUCE|CONFITURE|MIEL|VIN|BIERE)\b/,
  },
];

const NON_ITEM_START =
  /^(?:TOTAL|SOUS[ -]?TOTAL|MONTANT|NET A PAYER|RESTE A PAYER|A PAYER|RENDU|MONNAIE|CARTE|CB|ESPECES|ESPECES|CHEQUE|VIREMENT|PAIEMENT|POURBOIRE|ARRONDI|SOLDE|ANCIEN|TICKET|DATE|HEURE|CAISSE|CLIENT|MERCI|SIRET|SIREN|TVA|DONT|POINTS|NOMBRE|NB|ARTICLES|HT|TTC|BASE|TAUX|VOTRE|VOS)\b/;

const DISCOUNT_KEYWORD =
  /\b(REMISE|REDUCTION|REDUC|ECONOMIE|ECO|AVANTAGE|COUPON|OFFERT|GRATUIT|SOLDE|DEDUCTION|DEDUIT|FIDELITE|CAGNOTTE|BON DE REDUCTION|BON D'ACHAT)\b/;

const TICKET_SAVINGS =
  /\b(VOUS AVEZ (?:ECONOMISE|GAGNE)|TOTAL (?:ECONOMIES?|REMISES?|REDUCTIONS?)|ECONOMIES? (?:REALISEES?|TOTALES?)|CUMUL (?:ECONOMIES?|REMISES?)|DONT (?:REMISE|ECONOMIE))\b/;

const LOYALTY_HEADER =
  /(VOS .*CARTE U|VOTRE SOLDE|VOS .*CARTE|CARTE U GAGNES|AVANTAGES? CARTE|GRACE A VOTRE CARTE|VOS POINTS|POINTS FIDELITE|SOLDE FIDELITE|VOTRE CAGNOTTE|MA CAGNOTTE|CAGNOTTE|VOS AVANTAGES|MES AVANTAGES|PROGRAMME FIDELITE|VOS ECONOMIES|TOTAL AVANTAGES)/;

const TRAILING_AMOUNT_RE =
  /(-?\d{1,4}(?:[ .]\d{3})*[,.]\d{2})\s*(?:€|EUR)?\s*([A-Z]|\d{1,2})?\s*$/i;

const DATE_IN_LINE_RE =
  /\b(?:\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|20\d{2}[/.\-]\d{1,2}[/.\-]\d{1,2})\b/;

const VAT_TABLE_LINE_RE = /^\s*\d{1,2}\s*\/\s*\d{1,2}(?:[.,]\d{1,2})?\b/;

/** Codes de TVA imprimés en fin de ligne sur les tickets U (11 = 5,5 %, 13 = 20 %). */
function detectTaxCodeRates(rawLines: string[]): Map<string, number> {
  const rates = new Map<string, number>();

  for (const rawLine of rawLines) {
    const line = normalizeText(rawLine);
    // Tableau U : « 11 / 5,50 69,36 € 3,81 € 73,17 € ».
    const match = /^\s*(\d{1,2})\s*\/\s*(\d{1,2}(?:[.,]\d{1,2})?)\b/.exec(line);
    if (!match) continue;
    const rate = parseAmount(match[2]);
    if (rate !== null && rate > 0 && rate <= 30) {
      rates.set(match[1], rate);
    }
  }

  return rates;
}

const SECTION_MAP: Record<
  string,
  { label: string; category: Category | null }
> = {
  "FRUITS ET LEGUMES": { label: "Fruits et Légumes", category: "Alimentation" },
  BVP: {
    label: "Boulangerie / Viennoiserie / Pâtisserie",
    category: "Alimentation",
  },
  EPICERIE: { label: "Épicerie", category: "Alimentation" },
  "BEAUTE SANTE": { label: "Beauté & Santé", category: "Santé" },
  LIQUIDES: { label: "Liquides", category: "Alimentation" },
  ENTRETIEN: { label: "Entretien", category: "Logement" },
  CULTURE: { label: "Culture", category: "Loisirs" },
  "BRICOLAGE JARDINAGE AUT": {
    label: "Bricolage / Jardinage / Autre",
    category: "Logement",
  },
  "CREMERIE L S": { label: "Crémerie Libre-Service", category: "Alimentation" },
  "CHARC TRAIT SAUC SECS L": {
    label: "Charcuterie / Traiteur / Saucissons secs",
    category: "Alimentation",
  },
};

const QUANTITY_DETAIL_RE =
  /^\s*(?:(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*€?\s*\/\s*(kg|g|l|cl|ml)\s+(\d+(?:[.,]\d+)?)|(\d{1,3})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*€?\s+(\d+(?:[.,]\d+)?))/i;

const LABEL_REPLACEMENTS: [RegExp, string][] = [
  [/\bPAP\.?TOIL\.?/g, "Papier toilette"],
  [/\bDCHE&BN\b/g, "Douche & Bain"],
  [/\bDENT\.?/g, "Dentifrice"],
  [/\bBAD\b/g, "Brosse à dents"],
  [/\bBATONNETS OUATES\b/g, "Bâtonnets ouatés"],
  [/\bGEL LAV\.?/g, "Gel lavant"],
  [/\bGEL FIXATION BETON\b/g, "Gel fixation béton"],
  [/\bEMMENT\.?PAS\.?RAPE\b/g, "Emmental pasteurisé râpé"],
  [/\bPT SUISSE\b/g, "Petit-Suisse"],
  [/\bFROM\.?BLC NAT\.?/g, "Fromage blanc nature"],
  [/\bYRT A BOIRE\b/g, "Yaourt à boire"],
  [/\bMOZZA\.?PAST\.?/g, "Mozzarella pasteurisée"],
  [/\bK\. ?SCHOKOBONS\b/g, "Kinder Schoko-Bons"],
  [/\bTHON ENTI\.?LISTAO\b/g, "Thon entier Listao"],
  [/\bMAFALDINE NAPOLETANE BARI\.?/g, "Mafaldine Napoletane Barilla"],
  [/\bBOUILL\.?VOLAIL\.?DEGR\.?/g, "Bouillon volaille dégraissé"],
  [/\bLEVURE FRAICHE HIROND\.?CUBE\b/g, "Levure fraîche Hirondelle cube"],
  [/\bCHOU FLEUR\b/g, "Chou-fleur"],
  [/\bPROTEGE-DOCUMENTS\b/g, "Protège-documents"],
  [/\bJAMBON SEC SUPERIEUR\b/g, "Jambon sec supérieur"],
  [/\bDES DE JAMBON\b/g, "Dés de jambon"],
  [/\bFILM ETIRABLE\b/g, "Film étirable"],
  [/\bCISEAUX U ACIER INOX\b/g, "Ciseaux U acier inox"],
  [/\bPILE U MINI\b/g, "Pile U mini"],
  [/\bPOMME DE TERRE\b/g, "Pomme de terre"],
  [/\bENDIVE SACHET\b/g, "Endive sachet"],
  [/\bPAVE AU LIN\b/g, "Pavé au lin"],
  [/\bBAGUETTE LA CROUSTILLANTE\b/g, "Baguette La Croustillante"],
  [/\bBEURRE DOUX EXT\.?FIN\b/g, "Beurre doux extra-fin"],
  [/\bFROMAGE NATURE\b/g, "Fromage nature"],
  [/\bJAMBON DE PARIS\b/g, "Jambon de Paris"],
  [/\bPERRIER\b/g, "Perrier"],
  [/\bCL\/WH\b/g, "Classic/White"],
  [/\bPQ\b/g, "plaquette"],
  [/\bSACH\.?/g, "sachet"],
  [/\bFIL\.?U\b/g, "faisselle/filet U"],
  [/\bBLC\b/g, "blanc"],
  [/\b24RLX\b/g, "(24 rouleaux)"],
  [/\bBOITE\b/g, "boîte"],
  [/\bRECH\.?/g, "recharge"],
  [/\bMETRES\b/g, "mètres"],
  [/\b2EN1\b/g, "2 en 1"],
  [/\bASS\b/g, "assortis"],
  [/\b6TR150G\b/g, "6 tranches 150G"],
  [/\b6T 240G\b/g, "6 tranches 240G"],
  [/\bSAIS\.?\b/g, " "],
  [/\s+OD\b/g, " "],
  [/\bLPM\b/g, "Le Petit Marseillais"],
  [/PAMPL\/ORAN\.?/g, "Pamplemousse/Orange"],
  [/\bGREN&TILL\.?U\b/g, "grenade & tilleul U"],
  [/\bLOT 2 YAOURT A BOIRE\b/g, "Lot 2 Yaourts à boire"],
  [/\bPACK FAMILY SOUPLE\b/g, "Pack Family souple"],
  [/\bPOT\b/g, "pot"],
  [/\bCR2025\b/g, "CR2025"],
  [/\bZIP\b/g, "zip"],
];

const ACCENT_REPLACEMENTS: [RegExp, string][] = [
  [/\bPAVE\b/gi, "Pavé"],
  [/\bFRAICHE\b/gi, "fraîche"],
  [/\bEPICERIE\b/gi, "Épicerie"],
  [/\bBEAUTE\b/gi, "Beauté"],
  [/\bCREMERIE\b/gi, "Crémerie"],
  [/\bPECH\.?LIG\.?/gi, "pêche ligne"],
  [/\bSEC\b/gi, "sec"],
  [/\bSUPERIEUR\b/gi, "supérieur"],
  [/\bDES\b/gi, "Dés"],
  [/\bCR2025\b/gi, "CR2025"],
  [/\bCAFE\b/gi, "Café"],
];

function cleanItemLabel(value: string): string {
  return value
    .replace(/^\s*[*\-–—•·]+\s*/, "")
    .replace(/[€]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.:;,\-–—]+|[\s.:;,\-–—]+$/g, "")
    .trim();
}

function removeAmounts(value: string): string {
  return value.replace(AMOUNT_RE, " ");
}

function titleWords(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|[\s'’\-/])(\p{L})/gu,
      (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
    );
}

function formatItemLabel(value: string): string {
  let label = cleanItemLabel(value);
  if (!label) return "";

  for (const [pattern, replacement] of LABEL_REPLACEMENTS) {
    label = label.replace(pattern, replacement);
  }

  // Sépare les mots collés après remplacement (« DentifriceORIGINAL »).
  label = label
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Ll})(\d)/gu, "$1 $2");

  // Uniformise les unités collées aux nombres : 380G → 380 g.
  label = label.replace(
    /(\d)\s*(KG|G|ML|CL|CM|L)\b/gi,
    (_, digit: string, unit: string) => {
      const normalized = unit.toLowerCase();
      return `${digit} ${normalized === "l" ? "L" : normalized}`;
    },
  );

  // Deuxième passe : certains libellés ne deviennent reconnaissables qu'après
  // la séparation des mots (ex. « GEL LAV.GREN&TILL.U »).
  for (const [pattern, replacement] of LABEL_REPLACEMENTS) {
    label = label.replace(pattern, replacement);
  }

  // Casse de titre uniquement si le libellé est en majuscules (cas des tickets).
  if (label === label.toUpperCase()) {
    label = titleWords(label);
  }

  // Corrige les mots restés en majuscules dans un libellé déjà partiellement
  // remplacé (« POMME DE TERRE FILET » → « Pomme de terre Filet »).
  label = label.replace(/\b\p{Lu}{4,}\b/gu, (word) => {
    if (/\d/.test(word)) return word;
    if (word === "ZIP") return "zip";
    return titleWords(word);
  });

  for (const [pattern, replacement] of ACCENT_REPLACEMENTS) {
    label = label.replace(pattern, replacement);
  }

  return label
    .replace(/(?<=\p{L})U(\d+\/\d+)\b/gu, " U $1")
    .replace(/\bU(\d+\/\d+)\b/g, "U $1")
    .replace(/(?<!\d)\bX(\d+)\b/g, "×$1")
    .replace(/\b(\d+)\s*[xX]\s*(\d+)/g, "$1 × $2")
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Ll})(\d)/gu, "$1 $2")
    .replace(/\bA BOIRE\b/g, "à boire")
    .replace(/\bLot 2 Yaourt à boire\b/g, "Lot 2 Yaourts à boire")
    .replace(/\bFilet\b/g, "filet")
    .replace(/\bPlis\b/g, "plis")
    .replace(/\bFraise\b/g, "fraise")
    .replace(/\bYOP\b/g, "Yop")
    .replace(/(\d)\s*%/g, "$1 %")
    .replace(/%\s*MG\b/g, "% MG")
    .replace(/(?<=\p{L})\/(?=\p{L})/gu, " / ")
    .replace(/\s+([,.:;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseSectionHeader(
  value: string,
): { label: string; category: Category | null } {
  const key = normalizeText(value)
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const known = SECTION_MAP[key];
  if (known) return known;

  return {
    label: titleWords(value.replace(/[^a-zA-ZÀ-ÿ0-9'’\-/ ]+/g, " ").trim()),
    category: null,
  };
}

/**
 * Reconnaît les en-têtes de rayon de plusieurs enseignes :
 * « >>>> FRUITS ET LEGUMES », « *** EPICERIE *** », « --- BVP --- »,
 * « RAYON : CREMERIE ».
 */
function parseSectionLine(
  line: string,
): { label: string; category: Category | null } | null {
  const normalized = normalizeText(line);
  if (
    /\b(VOS|VOTRE|CARTE|REDUCTION|ECONOMIE|AVANTAGE|SOLDE|TOTAL|REMISE)\b/.test(
      normalized,
    )
  ) {
    return null;
  }

  const arrow = /^>{3,}\s*(.+)$/.exec(line);
  if (arrow) return parseSectionHeader(arrow[1]);

  const stars = /^\*{3,}\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9 &'’./-]{3,})\s*\*{3,}$/.exec(
    line,
  );
  if (stars) return parseSectionHeader(stars[1]);

  const dashes = /^[-=]{3,}\s*([A-ZÀ-Ÿ][A-ZÀ-Ÿ0-9 &'’./-]{3,})\s*[-=]{3,}$/.exec(
    line,
  );
  if (dashes) return parseSectionHeader(dashes[1]);

  const rayon = /^RAYON\s*[:\-]\s*(.+)$/i.exec(line);
  if (rayon) return parseSectionHeader(rayon[1]);

  return null;
}

function looksLikeProductLabel(line: string, normalized: string): boolean {
  const cleaned = cleanItemLabel(line);
  if (cleaned.length < 3) return false;
  if (!/[a-zA-ZÀ-ÿ]{2}/.test(cleaned)) return false;
  if (DATE_IN_LINE_RE.test(cleaned)) return false;
  if (NON_ITEM_START.test(normalized)) return false;
  if (ITEM_NOISE.test(normalized)) return false;
  if (STREET_NOISE.test(normalized)) return false;
  if (/^\d{5}\b/.test(cleaned)) return false;
  if (/\b(?:TEL|TELEPHONE|SIRET|SIREN|RCS|NAF|TVA|CARTE U|SOLDE|AVANTAGE|GAGNE)\b/.test(normalized)) {
    return false;
  }

  const letters = (cleaned.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  const digits = (cleaned.match(/\d/g) ?? []).length;
  if (digits > letters * 0.8 + 2) return false;

  return true;
}

function parseQuantityDetail(line: string): {
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount: number;
} | null {
  const match = QUANTITY_DETAIL_RE.exec(line);
  if (!match) return null;

  if (match[1] !== undefined) {
    const quantity = parseAmount(match[1]);
    const unitPrice = parseAmount(match[3]);
    const amount = parseAmount(match[5]);
    if (quantity === null || unitPrice === null || amount === null) return null;
    return {
      quantity: Math.round(quantity * 1000) / 1000,
      unit: match[2]?.toLowerCase(),
      unitPrice: roundCurrency(unitPrice),
      amount: roundCurrency(amount),
    };
  }

  const quantity = Number(match[6]);
  const unitPrice = parseAmount(match[7]);
  const amount = parseAmount(match[8]);
  if (!Number.isFinite(quantity) || unitPrice === null || amount === null) {
    return null;
  }
  return {
    quantity: Math.round(quantity * 1000) / 1000,
    unitPrice: roundCurrency(unitPrice),
    amount: roundCurrency(amount),
  };
}

function taxRateFromCode(
  code: string | undefined,
  rates: Map<string, number>,
): number | null {
  if (!code) return null;
  return rates.get(code) ?? null;
}

function parseQuantity(rawLabel: string): { quantity: number; label: string } {
  let quantity = 1;
  let label = rawLabel;

  const patterns = [
    // « 2 x 1,89 € » : un prix derrière le x. « 6X1L » ou « 12X60G » sont
    // des conditionnements, pas des quantités achetées.
    /\b(\d{1,3})\s*[xX×]\s*(?=\d+[,.]\d{2}\b)/,
    // « 2 X PAIN 1,20 2,40 » : le libellé suit immédiatement le x.
    /\b(\d{1,3})\s*[xX×]\s+(?=[a-zA-ZÀ-ÿ])/,
    /\b(?:QTE|QTY|QUANTITE)\s*[:.]?\s*(\d{1,3})\b/i,
    /\b(\d{1,3})\s*(?:PIECES?|PCS?|UNITES?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(label);
    if (!match) continue;
    quantity = Number(match[1]);
    label = `${label.slice(0, match.index)} ${label.slice(match.index + match[0].length)}`;
    break;
  }

  return { quantity, label };
}

function classifyItem(
  label: string,
  ticketCategory: Category,
  defaultCategory: Category,
  sectionCategory: Category | null = null,
): Category {
  if (sectionCategory) return sectionCategory;

  const normalized = normalizeText(label);
  for (const entry of ITEM_CATEGORY_RULES) {
    // Dans un restaurant, « CAFE » ou « SALADE » sont des plats, pas des
    // courses : on laisse la catégorie du ticket prendre le relais.
    if (entry.category === "Alimentation" && ticketCategory === "Restaurants") {
      continue;
    }
    if (entry.pattern.test(normalized)) return entry.category;
  }
  // Le contexte du ticket reste le meilleur indice : une pharmacie vend
  // rarement des articles « Divers ». La catégorie par défaut ne sert qu'en
  // dernier recours.
  if (ticketCategory !== "Divers") return ticketCategory;
  return defaultCategory;
}

function normalizeBoldLines(boldLines: string[] | undefined): string[] {
  if (!boldLines?.length) return [];
  return boldLines
    .map((line) => normalizeText(line).replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3);
}

function isBoldLine(
  rawLine: string,
  label: string,
  boldLines: string[],
): boolean {
  if (boldLines.length === 0) return false;
  const normalizedLine = normalizeText(rawLine).replace(/\s+/g, " ").trim();
  const normalizedLabel = normalizeText(label).replace(/\s+/g, " ").trim();
  if (!normalizedLabel) return false;

  return boldLines.some(
    (bold) =>
      bold === normalizedLine ||
      bold === normalizedLabel ||
      (normalizedLabel.length >= 4 && bold.includes(normalizedLabel)) ||
      (bold.length >= 4 && normalizedLine.includes(bold)),
  );
}

type PendingLabel = {
  label: string;
  bold: boolean;
  section?: string;
  sectionCategory: Category | null;
  taxRate: number | null;
  index: number;
};

function extractItems(
  rawLines: string[],
  total: number | null,
  ticketCategory: Category,
  defaultCategory: Category,
  boldLines: string[],
  excludeTotalIndex: number | null,
): {
  items: ReceiptItem[];
  ticketSavings: number;
  warnings: string[];
} {
  const collected: { item: ReceiptItem; index: number }[] = [];
  const warnings: string[] = [];
  let ticketSavings = 0;
  let currentSection: { label: string; category: Category | null } | null = null;
  let pendingLabel: PendingLabel | null = null;
  let loyaltyBlock = false;
  const taxCodeRates = detectTaxCodeRates(rawLines);

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const rawLine = rawLines[lineIndex];
    const line = rawLine.trim();
    if (!line) {
      pendingLabel = null;
      continue;
    }

    const normalized = normalizeText(line);

    // En-tête de rayon : « >>>> FRUITS ET LEGUMES », « *** EPICERIE *** »…
    const section = parseSectionLine(line);
    if (section) {
      currentSection = section;
      pendingLabel = null;
      loyaltyBlock = false;
      continue;
    }

    // Bloc de fidélité / solde Carte U : ce ne sont pas des achats.
    if (LOYALTY_HEADER.test(normalized)) {
      loyaltyBlock = true;
      pendingLabel = null;
      continue;
    }
    // Un nouveau bloc de paiement indique la fin d'un éventuel bloc fidélité
    // (utile si le ticket contient plusieurs transactions).
    if (
      loyaltyBlock &&
      /^(RESTE A PAYER|CARTE BANCAIRE|CB|ESPECES|ESPECES|CHEQUE|VIREMENT)\b/.test(
        normalized,
      )
    ) {
      loyaltyBlock = false;
    }
    if (loyaltyBlock) continue;

    // Tableau de TVA : « 11 / 5,50 69,36 € 3,81 € 73,17 € ».
    if (VAT_TABLE_LINE_RE.test(line)) {
      pendingLabel = null;
      continue;
    }
    if (TVA_PATTERN.test(normalized) || DATE_IN_LINE_RE.test(line)) {
      pendingLabel = null;
      continue;
    }

    const trailing = TRAILING_AMOUNT_RE.exec(line);
    if (!trailing || trailing.index === undefined) {
      if (looksLikeProductLabel(line, normalized)) {
        const pendingTaxMatch = /\s+(\d{1,2})\s*$/.exec(line);
        const pendingTaxRate = taxRateFromCode(
          pendingTaxMatch?.[1],
          taxCodeRates,
        );
        const rawPendingLabel = cleanItemLabel(
          line.replace(/\s+\d{1,2}\s*$/, ""),
        );
        if (rawPendingLabel) {
          const formatted = formatItemLabel(rawPendingLabel);
          pendingLabel = {
            label: formatted,
            bold: isBoldLine(line, formatted, boldLines),
            section: currentSection?.label,
            sectionCategory: currentSection?.category ?? null,
            taxRate: pendingTaxRate,
            index: lineIndex,
          };
        }
      } else {
        pendingLabel = null;
      }
      continue;
    }

    const rawAmount = parseAmount(trailing[1]);
    if (rawAmount === null) continue;
    const amount = roundCurrency(Math.abs(rawAmount));
    if (amount <= 0 || amount > 10_000) continue;

    const taxRate = taxRateFromCode(trailing[2], taxCodeRates);
    const isNegative = trailing[1].trim().startsWith("-");
    const quantityDetail = parseQuantityDetail(line);

    // Ligne de détail d'une quantité : « 2 x 1,89 € 3,78 € 11 » ou
    // « 0,862 kg x 2,45 €/kg 2,11 € ». Elle complète le libellé précédent.
    if (quantityDetail) {
      if (!pendingLabel) continue;

      const label = pendingLabel.label;
      const section = pendingLabel.section;
      const sectionCategory = pendingLabel.sectionCategory;
      const tvaRate = taxRate ?? pendingLabel.taxRate;
      const tva =
        tvaRate !== null
          ? roundCurrency(amount - amount / (1 + tvaRate / 100))
          : null;

      collected.push({
        index: pendingLabel.index,
        item: {
          label,
          category: classifyItem(
            label,
            ticketCategory,
            defaultCategory,
            sectionCategory,
          ),
          section,
          quantity: quantityDetail.quantity,
          unit: quantityDetail.unit,
          unitPrice: quantityDetail.unitPrice,
          amount: quantityDetail.amount,
          tva,
          tvaRate,
          savings: 0,
          bold: pendingLabel.bold,
          kind: "item",
        },
      });
      pendingLabel = null;
      continue;
    }

    pendingLabel = null;

    const rawLabel = line.slice(0, trailing.index);
    if (!/[a-zA-ZÀ-ÿ]/.test(rawLabel)) continue;

    const cleanedRawLabel = cleanItemLabel(rawLabel);
    const normalizedLabel = normalizeText(cleanedRawLabel);

    if (TICKET_SAVINGS.test(normalizedLabel)) {
      ticketSavings = Math.max(ticketSavings, amount);
      continue;
    }

    const isDiscount = isNegative || DISCOUNT_KEYWORD.test(normalizedLabel);
    if (!isDiscount) {
      if (NON_ITEM_START.test(normalizedLabel)) continue;
      if (ITEM_NOISE.test(normalizedLabel)) continue;
      if (STREET_NOISE.test(normalizedLabel)) continue;
      if (/\b(?:TEL|TELEPHONE|SIRET|SIREN|RCS|APE|NAF)\b/.test(normalizedLabel)) {
        continue;
      }
    }

    const quantityInfo = parseQuantity(cleanedRawLabel);
    let label = formatItemLabel(
      cleanItemLabel(removeAmounts(quantityInfo.label)),
    );

    if (label.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(label)) continue;
    if (label.length > 90) label = `${label.slice(0, 87).trim()}…`;

    if (!isDiscount) {
      if (NON_ITEM_START.test(normalizeText(label))) continue;
      if (ITEM_NOISE.test(normalizeText(label))) continue;
      if (STREET_NOISE.test(normalizeText(label))) continue;
    }

    const amounts = extractAmounts(line);
    let quantity = quantityInfo.quantity;
    let unitPrice: number | null = null;

    if (quantity > 1 && amounts.length >= 2) {
      const candidate = amounts[0];
      if (Math.abs(candidate * quantity - amount) <= 0.05) {
        unitPrice = roundCurrency(candidate);
      } else {
        unitPrice = roundCurrency(amount / quantity);
      }
    } else if (quantity > 1) {
      unitPrice = roundCurrency(amount / quantity);
    } else if (amounts.length >= 2) {
      const ratio = amount / amounts[0];
      const rounded = Math.round(ratio);
      if (
        rounded >= 2 &&
        rounded <= 20 &&
        Math.abs(ratio - rounded) <= 0.03
      ) {
        quantity = rounded;
        unitPrice = roundCurrency(amounts[0]);
      } else if (amounts[0] > amount) {
        unitPrice = roundCurrency(amounts[0]);
      }
    }

    if (!unitPrice) unitPrice = roundCurrency(amount / Math.max(1, quantity));

    const tvaMatch = [...line.matchAll(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/g)];
    const percentRate = tvaMatch.length
      ? parseAmount(tvaMatch[tvaMatch.length - 1][1])
      : null;
    const normalisedRate =
      taxRate ??
      (percentRate !== null && percentRate > 0 && percentRate <= 30
        ? percentRate
        : null);
    const tva =
      !isDiscount && normalisedRate !== null
        ? roundCurrency(amount - amount / (1 + normalisedRate / 100))
        : null;

    // Prix barré / remise sur la ligne : « PROMO 5,00 4,00 ».
    let savings = 0;
    if (isDiscount) {
      savings = amount;
    } else if (
      /\b(PROMO|REMISE|REDUCTION|OFFRE|AVANTAGE)\b/.test(normalizedLabel) &&
      amounts.length >= 2 &&
      amounts[0] > amount
    ) {
      savings = roundCurrency(amounts[0] - amount);
    }

    const sectionCategory = currentSection?.category ?? null;
    collected.push({
      index: lineIndex,
      item: {
        label,
        category: isDiscount
          ? ticketCategory !== "Divers"
            ? ticketCategory
            : defaultCategory
          : classifyItem(
              label,
              ticketCategory,
              defaultCategory,
              sectionCategory,
            ),
        section: isDiscount ? "Réductions" : currentSection?.label,
        quantity: isDiscount ? 1 : quantity,
        unit: undefined,
        unitPrice: isDiscount ? null : unitPrice,
        amount,
        tva,
        tvaRate: normalisedRate,
        savings,
        bold: isBoldLine(line, label, boldLines),
        kind: isDiscount ? "discount" : "item",
      },
    });
  }

  // La ligne qui a servi à trouver le total ne doit pas devenir un article :
  // c'est fréquent quand l'OCR lit « Torai ic » à la place de « TOTAL TTC ».
  let items = collected.map((entry) => entry.item);
  if (
    excludeTotalIndex !== null &&
    collected.some((entry) => entry.index !== excludeTotalIndex)
  ) {
    items = collected
      .filter((entry) => entry.index !== excludeTotalIndex)
      .map((entry) => entry.item);
  }

  if (items.length === 0) {
    warnings.push(
      "Le détail des articles n'a pas pu être lu. Vous pouvez le compléter à la main.",
    );
  } else if (total !== null) {
    const itemsTotal = roundCurrency(
      items.reduce(
        (sum, item) =>
          item.kind === "discount" ? sum - item.amount : sum + item.amount,
        0,
      ),
    );
    const difference = roundCurrency(total - itemsTotal);
    if (Math.abs(difference) >= 0.06) {
      warnings.push(
        `La somme des articles (${itemsTotal.toFixed(2).replace(".", ",")} €) diffère du total (${total.toFixed(2).replace(".", ",")} €). Vérifiez les lignes.`,
      );
    }
  }

  return {
    items: items.slice(0, 150),
    ticketSavings,
    warnings,
  };
}

function computeItemSavings(items: ReceiptItem[]): number {
  return roundCurrency(items.reduce((sum, item) => sum + item.savings, 0));
}

export type ParseReceiptOptions = {
  /** Catégorie choisie par l'utilisateur, utilisée si aucun indice n'est trouvé. */
  defaultCategory?: Category;
  /** Lignes détectées en gras dans le PDF ou par l'OCR. */
  boldLines?: string[];
};

export function parseReceipt(
  text: string,
  options: ParseReceiptOptions = {},
): ParsedReceipt {
  const rawLines = splitRawLines(text);

  const cleanedText = rawLines.join("\n");
  const normalized = normalizeText(cleanedText);

  const { date, found: dateFound } = findDate(rawLines);
  const merchantMatch = findMerchant(rawLines);
  const merchant = merchantMatch.merchant;
  const merchantFound = merchantMatch.found;
  const total = findTotal(rawLines);
  const amount = total.amount;
  const tva = findTva(rawLines, amount);
  const payment = findPayment(cleanedText);

  const category = findCategory(cleanedText, merchant, merchantMatch.category);
  const defaultCategory = options.defaultCategory ?? "Divers";
  const boldLines = normalizeBoldLines(options.boldLines);

  const itemResult = extractItems(
    rawLines,
    amount,
    category,
    defaultCategory,
    boldLines,
    total.index,
  );
  const savings = Math.max(
    computeItemSavings(itemResult.items),
    itemResult.ticketSavings,
  ) || 0;

  const warnings: string[] = [];
  if (normalized.length < 80) {
    warnings.push(
      "Le texte du ticket est peu lisible. Vérifiez chaque champ, ou reprenez la photo avec plus de lumière.",
    );
  }
  if (!dateFound) warnings.push("Date non détectée : vérifiez-la.");
  if (!merchantFound) warnings.push("Nom du magasin non détecté.");
  if (amount === null) warnings.push("Montant total non détecté.");
  else if (!total.certain) {
    warnings.push("Montant estimé : le total n'a pas été identifié avec certitude.");
  }
  warnings.push(...itemResult.warnings);

  return {
    date,
    dateFound,
    merchant,
    merchantFound,
    category,
    amount,
    tva,
    payment,
    items: itemResult.items,
    savings,
    ticketSavings: itemResult.ticketSavings,
    note: "",
    warnings,
    rawText: cleanedText.slice(0, 4000),
  };
}
