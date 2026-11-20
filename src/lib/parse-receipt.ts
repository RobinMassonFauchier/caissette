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

function findTva(rawLines: string[]): number | null {
  const lines = rawLines
    .map(normalizeText)
    .filter((line) => /\bTVA\b/.test(line));

  if (lines.length === 0) return null;

  const summary = lines.filter((line) => /TOTAL TVA|DONT TVA/.test(line));
  const target = summary.length > 0 ? summary : lines;

  for (let i = target.length - 1; i >= 0; i -= 1) {
    const amounts = extractAmounts(target[i]);
    if (amounts.length > 0) return amounts[amounts.length - 1];
  }

  return null;
}

type Brand = {
  pattern: RegExp;
  name: string;
  category: Category;
};

const BRANDS: Brand[] = [
  { pattern: /\bCARREFOUR(?: MARKET| CITY| CONTACT| EXPRESS)?\b/, name: "Carrefour", category: "Alimentation" },
  { pattern: /\bE\.?\s?LECLERC\b|\bLECLERC\b/, name: "E.Leclerc", category: "Alimentation" },
  { pattern: /\bLIDL\b/, name: "Lidl", category: "Alimentation" },
  { pattern: /\bALDI\b/, name: "Aldi", category: "Alimentation" },
  { pattern: /\bAUCHAN\b/, name: "Auchan", category: "Alimentation" },
  { pattern: /\bINTERMARCHE\b/, name: "Intermarché", category: "Alimentation" },
  { pattern: /\bSUPER U\b|\bHYPER U\b|\bU EXPRESS\b/, name: "Système U", category: "Alimentation" },
  { pattern: /\bMONOPRIX\b/, name: "Monoprix", category: "Alimentation" },
  { pattern: /\bCASINO\b/, name: "Casino", category: "Alimentation" },
  { pattern: /\bFRANPRIX\b/, name: "Franprix", category: "Alimentation" },
  { pattern: /\bPICARD\b/, name: "Picard", category: "Alimentation" },
  { pattern: /\bBIOCOOP\b|\bNATURALIA\b/, name: "Biocoop", category: "Alimentation" },
  { pattern: /\bGRAND FRAIS\b/, name: "Grand Frais", category: "Alimentation" },
  { pattern: /\bMETRO\b/, name: "Metro", category: "Alimentation" },
  { pattern: /\bCOSTCO\b/, name: "Costco", category: "Alimentation" },

  { pattern: /\bMCDONALD'?S?\b|\bMCDO\b/, name: "McDonald's", category: "Restaurants" },
  { pattern: /\bBURGER KING\b/, name: "Burger King", category: "Restaurants" },
  { pattern: /\bKFC\b/, name: "KFC", category: "Restaurants" },
  { pattern: /\bSUBWAY\b/, name: "Subway", category: "Restaurants" },
  { pattern: /\bDOMINO'?S\b/, name: "Domino's Pizza", category: "Restaurants" },
  { pattern: /\bPIZZA HUT\b/, name: "Pizza Hut", category: "Restaurants" },
  { pattern: /\bSTARBUCKS\b/, name: "Starbucks", category: "Restaurants" },
  { pattern: /\bUBER EATS\b/, name: "Uber Eats", category: "Restaurants" },
  { pattern: /\bDELIVEROO\b/, name: "Deliveroo", category: "Restaurants" },
  { pattern: /\bPAUL\b/, name: "Paul", category: "Restaurants" },
  { pattern: /\bBRIOCHE DOREE\b/, name: "Brioche Dorée", category: "Restaurants" },

  { pattern: /\bUBER\b/, name: "Uber", category: "Transport" },
  { pattern: /\bBOLT\b/, name: "Bolt", category: "Transport" },
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
  { pattern: /\bACTION\b/, name: "Action", category: "Shopping" },
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
  { pattern: /\bCANAL\s?\+?\b/, name: "Canal+", category: "Abonnements" },
  { pattern: /\bPRIME VIDEO\b/, name: "Prime Video", category: "Abonnements" },
  { pattern: /\bSTEAM\b/, name: "Steam", category: "Loisirs" },

  { pattern: /\bEDF\b/, name: "EDF", category: "Logement" },
  { pattern: /\bENGIE\b/, name: "Engie", category: "Logement" },
  { pattern: /\bORANGE\b/, name: "Orange", category: "Logement" },
  { pattern: /\bSFR\b/, name: "SFR", category: "Logement" },
  { pattern: /\bBOUYGUES TELECOM\b/, name: "Bouygues Telecom", category: "Logement" },
  { pattern: /\bFREE\b/, name: "Free", category: "Logement" },
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
  /(TICKET|RECU|REÇU|MERCI|BIENVENUE|CAISSE|SIRET|TVA|TEL|TELEPHONE|WWW\.|HTTP|@|DATE|HEURE|CLIENT|FACTURE|COMMANDE|NUMERO|ADRESSE|MONTANT|TOTAL|CARTE|ESPECES|ESPÈCES|RENDU|MONNAIE|DUPLICATA|ORIGINAL|COPIE)/;

function cleanMerchantLine(line: string): string {
  return line
    .replace(/[*=~_|<>[\]{}]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—.:;]+|[\s\-–—.:;]+$/g, "")
    .trim();
}

function titleCase(value: string): string {
  const hasLowercase = /[a-zà-ÿ]/.test(value);
  if (hasLowercase) return value;
  return value
    .toLowerCase()
    .replace(/(^|[\s'’\-/])(\p{L})/gu, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

function findMerchant(rawLines: string[]): { merchant: string; found: boolean } {
  const normalizedFull = normalizeText(rawLines.slice(0, 25).join(" "));

  for (const brand of BRANDS) {
    if (brand.pattern.test(normalizedFull)) {
      return { merchant: brand.name, found: true };
    }
  }

  const candidates = rawLines
    .slice(0, 8)
    .map(cleanMerchantLine)
    .filter((line) => {
      if (line.length < 3 || line.length > 42) return false;
      if (!/[a-zA-ZÀ-ÿ]/.test(line)) return false;
      if (MERCHANT_NOISE.test(normalizeText(line))) return false;
      // Évite les lignes d'adresse / téléphone / codes.
      const digits = (line.match(/\d/g) || []).length;
      if (digits > line.length / 2) return false;
      return true;
    });

  if (candidates.length === 0) {
    return { merchant: "", found: false };
  }

  return { merchant: titleCase(candidates[0]), found: true };
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
  const rawLines = text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const cleanedText = rawLines.join("\n");
  const normalized = normalizeText(cleanedText);

  const { date, found: dateFound } = findDate(rawLines);
  const { merchant, found: merchantFound } = findMerchant(rawLines);
  const total = findTotal(rawLines);
  const amount = total.amount;
  const tva = findTva(rawLines);
  const payment = findPayment(cleanedText);

  const brand = BRANDS.find((item) => item.pattern.test(normalizeText(rawLines.slice(0, 25).join(" "))));
  const category = findCategory(cleanedText, merchant, brand ? brand.category : null);

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
