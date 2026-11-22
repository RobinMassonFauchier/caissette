import type { Category, ParsedReceipt, PaymentMethod } from "./types";
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

const AMOUNT_RE = /(-?\d{1,3}(?:[ .]\d{3})*[,.]\d{2})(?!\d)(?!\s*%)/g;

const TVA_PATTERN = /T\.?\s?V\.?\s?A\.?/;
const TVA_TOTAL_PATTERN =
  /(?:TOTAL|DONT|MONTANT|TAXE)\s*(?:DE\s*)?(?:LA\s*)?T\.?\s?V\.?\s?A\.?|T\.?\s?V\.?\s?A\.?\s*(?:TOTALE|TOTAL|AFFICHEE|DU TICKET)/;

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
    const dateHint = /\bDATE\b/.test(line) ? 4 : 0;

    // 2026-11-20
    for (const match of line.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
      const iso = toISO(Number(match[1]), Number(match[2]), Number(match[3]));
      if (iso) candidates.push({ date: iso, score: dateHint + 3, index });
    }

    // 20/11/2026, 20.11.26, 20-11-2026
    for (const match of line.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g)) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      let year = Number(match[3]);
      if (match[3].length === 2) year += year < 80 ? 2000 : 1900;
      const iso = toISO(year, month, day);
      if (iso) candidates.push({ date: iso, score: dateHint + 2, index });
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
      if (iso) candidates.push({ date: iso, score: dateHint + 3, index });
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
  /(TVA|H\.?T\b|SOUS[ -]?TOTAL|ARTICLES|REMISE|REDUCTION|ECONOMIE|FIDELITE|DONT|CARTE|ESPECES|RENDU|MONNAIE|CHEQUE|SOLDE|ANCIEN|AVANT|POINTS|NB\b|NOMBRE)/;

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

function findTotal(rawLines: string[]): { amount: number | null; certain: boolean } {
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
    return { amount: candidates[0].amount, certain: candidates[0].score >= 2 };
  }

  // Dernier recours : le plus gros montant du ticket (hors lignes de paiement).
  const fallback: number[] = [];
  rawLines.forEach((rawLine) => {
    const line = normalizeText(rawLine);
    if (TOTAL_EXCLUDED.test(line)) return;
    fallback.push(...extractAmounts(rawLine));
  });
  return {
    amount: fallback.length > 0 ? Math.max(...fallback) : null,
    certain: false,
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

/**
 * Un taux de TVA français dépasse rarement 30 %. Ce contrôle évite de
 * confondre un taux (« 20,00 ») avec un montant lorsque le % a sauté à l'OCR.
 */
function hasPlausibleTvaRate(amount: number, total: number | null): boolean {
  if (total === null) return true;
  const base = total - amount;
  if (base <= 0) return false;
  const impliedRate = (amount / base) * 100;
  return impliedRate >= 0.5 && impliedRate <= 30;
}

/**
 * La TVA est souvent présentée de trois façons :
 *   - une ligne de total : « TOTAL TVA 7,55 » ou « DONT TVA 7,55 » ;
 *   - un tableau par taux : « TVA 5,50% 0,52 » puis « TVA 20,00% 7,03 » ;
 *   - une seule ligne : « TVA 20,00% 7,03 ».
 * On privilégie le total explicite, puis on additionne les lignes du dernier
 * bloc de TVA (celui du bas du ticket), et on valide le résultat par rapport
 * au montant total pour éviter de confondre un taux avec un montant.
 */
function findTva(rawLines: string[], total: number | null): number | null {
  const lines = rawLines
    .map((rawLine, index) => ({ line: normalizeText(rawLine), index }))
    .filter(({ line }) => TVA_PATTERN.test(line));

  if (lines.length === 0) return null;

  // 1. Total de TVA explicitement indiqué.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const { line } = lines[i];
    if (!TVA_TOTAL_PATTERN.test(line)) continue;
    const amounts = extractAmounts(line);
    const amount = amounts[amounts.length - 1];
    if (
      amount !== undefined &&
      isValidTvaAmount(amount, total) &&
      hasPlausibleTvaRate(amount, total)
    ) {
      return roundCurrency(amount);
    }
  }

  // 2. Dernier bloc de lignes de TVA (souvent le tableau récapitulatif).
  const recent = lines.filter(({ index }) => index >= rawLines.length - 15);
  const pool = recent.length > 0 ? recent : lines;

  const groups: (typeof pool)[] = [];
  for (const entry of pool) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    if (current && previous && entry.index - previous.index <= 2) {
      current.push(entry);
    } else {
      groups.push([entry]);
    }
  }

  const lastGroup = groups[groups.length - 1] ?? [];
  const detailAmounts = lastGroup
    .map(({ line }) => {
      const amounts = extractAmounts(line);
      return amounts[amounts.length - 1];
    })
    .filter(
      (amount): amount is number =>
        amount !== undefined && isValidTvaAmount(amount, total),
    );

  if (detailAmounts.length === 1 && hasPlausibleTvaRate(detailAmounts[0], total)) {
    return roundCurrency(detailAmounts[0]);
  }

  if (detailAmounts.length > 1) {
    const sum = roundCurrency(
      detailAmounts.reduce((totalTva, amount) => totalTva + amount, 0),
    );
    if (
      isValidTvaAmount(sum, total) &&
      hasPlausibleTvaRate(sum, total)
    ) {
      return sum;
    }
  }

  // Un bloc de TVA existe mais son total est incohérent : mieux vaut ne rien
  // proposer qu'un montant partiel. L'utilisateur pourra le saisir lui-même.
  if (detailAmounts.length > 0) return null;

  // 3. Dernière ligne de TVA valable, même isolée.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const amounts = extractAmounts(lines[i].line);
    const amount = amounts[amounts.length - 1];
    if (
      amount !== undefined &&
      isValidTvaAmount(amount, total) &&
      hasPlausibleTvaRate(amount, total)
    ) {
      return roundCurrency(amount);
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
  { pattern: /\bSUPER U\b|\bHYPER U\b|\bU EXPRESS\b/, name: "Système U", category: "Alimentation" },
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

function findMerchant(rawLines: string[]): {
  merchant: string;
  found: boolean;
  category: Category | null;
} {
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
  if (/\bCHEQUE\b/.test(normalized)) return "Chèque";
  if (/\bVIREMENT\b/.test(normalized)) return "Virement";
  return "Carte bancaire";
}

export function parseReceipt(text: string): ParsedReceipt {
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

  return {
    date,
    dateFound,
    merchant,
    merchantFound,
    category,
    amount,
    tva,
    payment,
    note: "",
    warnings,
    rawText: cleanedText.slice(0, 4000),
  };
}
