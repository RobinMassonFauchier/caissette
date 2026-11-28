import { google, type drive_v3, type sheets_v4 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";
import type { Category, Expense, ExpenseFingerprint, ReceiptDetails, ReceiptItem } from "./types";
import { isCategory } from "./catalog";
import {
  detailsToJson,
  normalizeDetails,
  parseDetailsJson,
  roundCurrency,
} from "./items";

export const SPREADSHEET_TITLE = "Dépenses — Caissette";
export const FOLDER_NAME = "Tickets de caisse — Caissette";

const TAB = "Dépenses";

type Field =
  | "date"
  | "merchant"
  | "category"
  | "amount"
  | "payment"
  | "note"
  | "receiptUrl"
  | "createdAt"
  | "updatedAt"
  | "savings"
  | "details";

/**
 * Colonnes logiques de la feuille. L'ordre physique est retrouvé par les
 * en-têtes : une feuille V1 (avec la colonne TVA globale) continue donc de
 * fonctionner, et les nouvelles colonnes sont ajoutées à droite sans
 * réécrire ni perdre les données existantes.
 */
const HEADERS: Record<Field, string> = {
  date: "Date",
  merchant: "Magasin",
  category: "Catégorie",
  amount: "Montant",
  payment: "Paiement",
  note: "Note",
  receiptUrl: "Ticket",
  createdAt: "Ajouté le",
  updatedAt: "Modifié le",
  savings: "Économies",
  details: "Articles",
};

const CANONICAL_ORDER: Field[] = [
  "date",
  "merchant",
  "category",
  "amount",
  "payment",
  "note",
  "receiptUrl",
  "createdAt",
  "updatedAt",
  "savings",
  "details",
];

const HEADER_LIST = CANONICAL_ORDER.map((field) => HEADERS[field]);

export type Workspace = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  folderId: string;
};

type SheetLayout = {
  header: string[];
  index: Record<Field, number>;
  length: number;
  /** Ancienne colonne TVA (V1), conservée mais masquée. */
  legacyTvaIndex: number | null;
};

export type ExpenseInput = {
  date: string;
  merchant: string;
  category: Category;
  amount: number;
  payment: string;
  note: string;
  receiptUrl: string;
  items: ReceiptItem[];
  tva: number | null;
  savings: number;
  ticketSavings: number;
  legacyTva: number | null;
};

type StoredExpense = Expense & {
  legacyTva: number | null;
  /** Ligne brute, utilisée pour préserver les colonnes ajoutées par l'utilisateur. */
  raw: unknown[];
};

export class SheetConflictError extends Error {
  current: Expense;

  constructor(current: Expense) {
    super("Ce ticket a été modifié depuis l'ouverture du formulaire.");
    this.name = "SheetConflictError";
    this.current = current;
  }
}

export class SheetNotFoundError extends Error {
  constructor() {
    super("Ce ticket est introuvable : il a peut-être été supprimé.");
    this.name = "SheetNotFoundError";
  }
}

/**
 * Cache mémoire : évite deux appels Drive à chaque page.
 * Le cache est perdu au redémarrage du serveur, ce qui n'est pas grave.
 */
const workspaceCache = new Map<
  string,
  { workspace: Workspace; expiresAt: number }
>();
const WORKSPACE_TTL = 15 * 60 * 1000;

const layoutCache = new Map<string, SheetLayout>();
const layoutInFlight = new Map<string, Promise<SheetLayout>>();

function clients(auth: OAuth2Client): { sheets: sheets_v4.Sheets; drive: drive_v3.Drive } {
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

function columnLetter(count: number): string {
  let value = count;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters || "A";
}

function headerKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<Field, string[]> = {
  date: ["DATE", "DATE ACHAT", "DATE DE L ACHAT", "DATE DU TICKET"],
  merchant: ["MAGASIN", "COMMERCE", "COMMERCANT", "ENSEIGNE", "NOM DU MAGASIN"],
  category: ["CATEGORIE", "CATEGORIE DEPENSE", "TYPE"],
  amount: ["MONTANT", "MONTANT TOTAL", "TOTAL", "PRIX"],
  payment: ["PAIEMENT", "MOYEN DE PAIEMENT", "MODE DE PAIEMENT"],
  note: ["NOTE", "NOTES", "COMMENTAIRE", "DESCRIPTION"],
  receiptUrl: ["TICKET", "JUSTIFICATIF", "LIEN TICKET", "FICHIER", "RECU"],
  createdAt: ["AJOUTE LE", "AJOUTE", "CREE LE", "DATE AJOUT", "HORODATAGE"],
  updatedAt: ["MODIFIE LE", "MODIFIE", "MISE A JOUR", "DERNIERE MODIFICATION"],
  savings: ["ECONOMIES", "ECONOMIE", "REMISES", "PROMOS", "REDUCTIONS"],
  details: ["ARTICLES", "DETAIL", "DETAILS", "DETAIL ARTICLES", "LIGNES"],
};

const LEGACY_TVA_ALIASES = ["TVA", "TVA TOTALE", "TVA DU TICKET", "MONTANT TVA"];

function resolveField(header: unknown): Field | "legacyTva" | null {
  const key = headerKey(header);
  if (!key) return null;
  for (const field of CANONICAL_ORDER) {
    if (HEADER_ALIASES[field].includes(key)) return field;
  }
  if (LEGACY_TVA_ALIASES.includes(key) || key.startsWith("TVA ")) {
    return "legacyTva";
  }
  return null;
}

function buildLayout(header: string[]): SheetLayout {
  const index = {} as Record<Field, number>;
  const seen = new Set<Field>();
  let legacyTvaIndex: number | null = null;

  header.forEach((value, column) => {
    const field = resolveField(value);
    if (field === "legacyTva") {
      if (legacyTvaIndex === null) legacyTvaIndex = column;
      return;
    }
    if (field && !seen.has(field)) {
      index[field] = column;
      seen.add(field);
    }
  });

  const length = Math.max(header.length, 1);
  return {
    header,
    index,
    length,
    legacyTvaIndex,
  };
}

async function hideLegacyTvaColumn(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  layout: SheetLayout,
): Promise<void> {
  if (layout.legacyTvaIndex === null) return;

  try {
    const sheetId = await getSheetId(sheets, spreadsheetId);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: layout.legacyTvaIndex,
                endIndex: layout.legacyTvaIndex + 1,
              },
              properties: { hiddenByUser: true },
              fields: "hiddenByUser",
            },
          },
        ],
      },
    });
  } catch (error) {
    // Masquer la colonne est cosmétique : ne bloque jamais l'application.
    console.error("Masquage de l'ancienne colonne TVA impossible :", error);
  }
}

async function applyColumnWidths(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  layout: SheetLayout,
): Promise<void> {
  try {
    const sheetId = await getSheetId(sheets, spreadsheetId);
    const widths: Partial<Record<Field, number>> = {
      date: 100,
      merchant: 220,
      category: 140,
      amount: 110,
      payment: 130,
      note: 220,
      receiptUrl: 70,
      createdAt: 150,
      updatedAt: 150,
      savings: 110,
      details: 280,
    };

    const requests: sheets_v4.Schema$Request[] = CANONICAL_ORDER.flatMap((field) => {
      const width = widths[field];
      if (!width) return [];
      return [
        {
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: "COLUMNS" as const,
              startIndex: layout.index[field],
              endIndex: layout.index[field] + 1,
            },
            properties: { pixelSize: width },
            fields: "pixelSize",
          },
        },
      ];
    });

    // Les nouvelles colonnes V2 méritent le même format que les anciennes.
    const currencyFormat = {
      userEnteredFormat: {
        numberFormat: { type: "CURRENCY", pattern: '#,##0.00 "€"' },
      },
      fields: "userEnteredFormat.numberFormat",
    };

    requests.push(
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 5000,
            startColumnIndex: layout.index.savings,
            endColumnIndex: layout.index.savings + 1,
          },
          ...currencyFormat,
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 5000,
            startColumnIndex: layout.index.updatedAt,
            endColumnIndex: layout.index.updatedAt + 1,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: "DATE_TIME",
                pattern: "dd/mm/yyyy hh:mm",
              },
            },
          },
          fields: "userEnteredFormat.numberFormat",
        },
      },
    );

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }
  } catch (error) {
    console.error("Mise en forme des colonnes impossible :", error);
  }
}

/**
 * Garantit la présence des colonnes V2 (Modifié le, Économies, Articles).
 * Les colonnes existantes ne sont jamais déplacées ni supprimées.
 */
async function loadSheetLayout(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<SheetLayout> {
  const cached = layoutCache.get(spreadsheetId);
  if (cached) return cached;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB}!A1:AZ1`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const header = (response.data.values?.[0] ?? []).map((value) =>
    String(value ?? "").trim(),
  );

  let layout = buildLayout(header);
  let changed = false;

  if (header.filter(Boolean).length === 0) {
    layout = buildLayout(HEADER_LIST);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB}!A1:${columnLetter(HEADER_LIST.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_LIST] },
    });
    changed = true;
  } else {
    const nextHeader = [...header];
    for (const field of CANONICAL_ORDER) {
      if (layout.index[field] !== undefined) continue;
      nextHeader.push(HEADERS[field]);
      layout.index[field] = nextHeader.length - 1;
      changed = true;
    }

    if (changed) {
      layout = buildLayout(nextHeader);
      // Comble les éventuels trous par des en-têtes vides.
      const padded = Array.from(
        { length: layout.length },
        (_, index) => nextHeader[index] ?? "",
      );
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${TAB}!A1:${columnLetter(layout.length)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [padded] },
      });
    }
  }

  layoutCache.set(spreadsheetId, layout);

  if (changed) {
    await Promise.all([
      hideLegacyTvaColumn(sheets, spreadsheetId, layout),
      applyColumnWidths(sheets, spreadsheetId, layout),
    ]);
  } else if (layout.legacyTvaIndex !== null) {
    // Le masquage n'est pas persistant dans le cache : on l'applique une fois
    // par démarrage, sans bloquer.
    void hideLegacyTvaColumn(sheets, spreadsheetId, layout);
  }

  return layout;
}

async function ensureSheetSchema(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<SheetLayout> {
  const cached = layoutCache.get(spreadsheetId);
  if (cached) return cached;

  const inFlight = layoutInFlight.get(spreadsheetId);
  if (inFlight) return inFlight;

  const task = loadSheetLayout(sheets, spreadsheetId)
    .catch((error) => {
      layoutCache.delete(spreadsheetId);
      throw error;
    })
    .finally(() => {
      layoutInFlight.delete(spreadsheetId);
    });

  layoutInFlight.set(spreadsheetId, task);
  return task;
}

async function ensureFolder(drive: drive_v3.Drive): Promise<string> {
  const found = await drive.files.list({
    q: `name = '${escapeQuery(FOLDER_NAME)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    spaces: "drive",
  });

  const existing = found.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  if (!created.data.id) {
    throw new Error("Impossible de créer le dossier Google Drive des tickets.");
  }
  return created.data.id;
}

/**
 * Retrouve (ou crée) le classeur Google Sheets et le dossier Drive de
 * l'utilisateur. Aucun identifiant n'est stocké côté serveur : tout est retrouvé
 * via l'API Drive à chaque démarrage de session.
 */
export async function ensureWorkspace(auth: OAuth2Client): Promise<Workspace> {
  const cacheKey = auth.credentials.refresh_token;
  const cached = cacheKey ? workspaceCache.get(cacheKey) : undefined;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.workspace;
  }

  const { sheets, drive } = clients(auth);
  const [folderId, found] = await Promise.all([
    ensureFolder(drive),
    drive.files.list({
      q: `name = '${escapeQuery(SPREADSHEET_TITLE)}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: "files(id, webViewLink)",
      pageSize: 1,
      spaces: "drive",
    }),
  ]);

  const existing = found.data.files?.[0];
  if (existing?.id) {
    const workspace: Workspace = {
      spreadsheetId: existing.id,
      spreadsheetUrl: existing.webViewLink || spreadsheetUrl(existing.id),
      folderId,
    };
    if (cacheKey) {
      workspaceCache.set(cacheKey, {
        workspace,
        expiresAt: Date.now() + WORKSPACE_TTL,
      });
    }
    return workspace;
  }

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: SPREADSHEET_TITLE,
        locale: "fr_FR",
        timeZone: "Europe/Paris",
      },
      sheets: [
        {
          properties: {
            title: TAB,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
    fields: "spreadsheetId,spreadsheetUrl,sheets.properties(sheetId,title)",
  });

  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Impossible de créer la feuille de calcul Google.");
  }

  const sheetId = created.data.sheets?.[0]?.properties?.sheetId ?? 0;
  const lastColumn = columnLetter(HEADER_LIST.length);

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB}!A1:${lastColumn}1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_LIST] },
    });

    const layout = buildLayout(HEADER_LIST);
    layout.index = Object.fromEntries(
      CANONICAL_ORDER.map((field, index) => [field, index]),
    ) as Record<Field, number>;
    layout.length = HEADER_LIST.length;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.098, green: 0.098, blue: 0.09 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                  verticalAlignment: "MIDDLE",
                },
              },
              fields:
                "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: "gridProperties.frozenRowCount",
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 5000,
                startColumnIndex: layout.index.date,
                endColumnIndex: layout.index.date + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" },
                },
              },
              fields: "userEnteredFormat.numberFormat",
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 5000,
                startColumnIndex: layout.index.amount,
                endColumnIndex: layout.index.amount + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: "CURRENCY", pattern: '#,##0.00 "€"' },
                },
              },
              fields: "userEnteredFormat.numberFormat",
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 5000,
                startColumnIndex: layout.index.savings,
                endColumnIndex: layout.index.savings + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: "CURRENCY", pattern: '#,##0.00 "€"' },
                },
              },
              fields: "userEnteredFormat.numberFormat",
            },
          },
        ],
      },
    });

    await applyColumnWidths(sheets, spreadsheetId, layout);
  } catch (error) {
    // La mise en forme est un bonus : on ne bloque pas l'application pour ça.
    console.error("Mise en forme de la feuille impossible :", error);
  }

  try {
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: "root",
      fields: "id",
    });
  } catch (error) {
    console.error("Déplacement de la feuille dans le dossier impossible :", error);
  }

  const workspace: Workspace = {
    spreadsheetId,
    spreadsheetUrl: created.data.spreadsheetUrl || spreadsheetUrl(spreadsheetId),
    folderId,
  };

  if (cacheKey) {
    workspaceCache.set(cacheKey, {
      workspace,
      expiresAt: Date.now() + WORKSPACE_TTL,
    });
  }

  return workspace;
}

function cellToIsoDate(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Numéro de série Google Sheets (epoch 1899-12-30).
    const millis = Math.round((value - 25569) * 86_400_000);
    return new Date(millis).toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (french) {
    return `${french[3]}-${french[2].padStart(2, "0")}-${french[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text.slice(0, 10))) return text.slice(0, 10);
  return "";
}

function cellToIsoDateTime(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = Math.round((value - 25569) * 86_400_000);
    return new Date(millis).toISOString();
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function cellNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/\s/g, "")
    .replace("€", "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? roundCurrency(parsed) : null;
}

function cellText(value: unknown): string {
  return String(value ?? "").trim();
}

function mapRow(
  row: unknown[],
  rowNumber: number,
  layout: SheetLayout,
): StoredExpense | null {
  const get = (field: Field) => row[layout.index[field]];

  const date = cellToIsoDate(get("date"));
  const merchant = cellText(get("merchant"));
  const amount = cellNumber(get("amount"));

  if (!date && !merchant && amount === null) return null;

  const rawCategory = cellText(get("category"));
  const legacyTva =
    layout.legacyTvaIndex !== null
      ? cellNumber(row[layout.legacyTvaIndex])
      : null;
  const details: ReceiptDetails = parseDetailsJson(
    cellText(get("details")),
    legacyTva,
  );
  const explicitSavings = cellNumber(get("savings")) ?? 0;

  return {
    row: rowNumber,
    date,
    merchant,
    category: (isCategory(rawCategory) ? rawCategory : "Divers") as Category,
    amount: amount ?? 0,
    tva: details.tva ?? legacyTva,
    payment: cellText(get("payment")) || "Carte bancaire",
    note: cellText(get("note")),
    receiptUrl: cellText(get("receiptUrl")),
    items: details.items,
    savings: Math.max(explicitSavings, details.savings),
    ticketSavings: details.ticketSavings ?? 0,
    createdAt: cellToIsoDateTime(get("createdAt")),
    updatedAt: cellToIsoDateTime(get("updatedAt")),
    legacyTva,
    raw: row,
  };
}

function mapRows(
  rows: unknown[][],
  startRow: number,
  layout: SheetLayout,
): StoredExpense[] {
  return rows
    .map((row, index) => mapRow(row, startRow + index, layout))
    .filter((expense): expense is StoredExpense => expense !== null);
}

export async function readExpenses(
  auth: OAuth2Client,
  spreadsheetId: string,
): Promise<Expense[]> {
  const { sheets } = clients(auth);
  const layout = await ensureSheetSchema(sheets, spreadsheetId);
  const lastColumn = columnLetter(layout.length);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB}!A2:${lastColumn}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  return mapRows(response.data.values ?? [], 2, layout).map(
    ({ raw: _raw, legacyTva: _legacyTva, ...expense }) => expense,
  );
}

async function readStoredExpense(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  layout: SheetLayout,
  row: number,
): Promise<StoredExpense | null> {
  const lastColumn = columnLetter(layout.length);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB}!A${row}:${lastColumn}${row}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const values = response.data.values?.[0];
  if (!values) return null;
  return mapRow(values, row, layout);
}

function canonicalWriteLength(layout: SheetLayout): number {
  const maxCanonical = Math.max(
    ...CANONICAL_ORDER.map((field) => layout.index[field]),
  );
  const maxLegacy = layout.legacyTvaIndex ?? -1;
  return Math.max(maxCanonical, maxLegacy) + 1;
}

function toRowValues(
  input: ExpenseInput,
  layout: SheetLayout,
  createdAt: string,
  updatedAt: string,
  existingRow?: unknown[],
): (string | number)[] {
  const writeLength = canonicalWriteLength(layout);
  const values: (string | number)[] = Array.from(
    { length: writeLength },
    (_, index) => {
      const previous = existingRow?.[index];
      return typeof previous === "string" || typeof previous === "number"
        ? previous
        : "";
    },
  );

  const set = (field: Field, value: string | number) => {
    const index = layout.index[field];
    if (index !== undefined) values[index] = value;
  };

  set("date", input.date);
  set("merchant", input.merchant);
  set("category", input.category);
  set("amount", input.amount);
  set("payment", input.payment);
  set("note", input.note);
  set("receiptUrl", input.receiptUrl);
  set("createdAt", createdAt);
  set("updatedAt", updatedAt);
  set("savings", input.savings);
  set(
    "details",
    detailsToJson({
      version: 1,
      items: input.items,
      tva: input.tva,
      savings: input.savings,
      ticketSavings: input.ticketSavings,
      legacyTva: input.legacyTva,
    }),
  );

  // Ancienne colonne TVA (V1) : on la tient à jour tant qu'elle existe, pour
  // que la valeur du JSON et celle de la colonne ne divergent jamais.
  if (layout.legacyTvaIndex !== null) {
    values[layout.legacyTvaIndex] = input.legacyTva ?? "";
  }

  return values;
}

export async function appendExpense(
  auth: OAuth2Client,
  spreadsheetId: string,
  input: ExpenseInput,
): Promise<{ row: number }> {
  const { sheets } = clients(auth);
  const layout = await ensureSheetSchema(sheets, spreadsheetId);
  const createdAt = new Date().toISOString();

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TAB}!A:${columnLetter(canonicalWriteLength(layout))}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [toRowValues(input, layout, createdAt, "")],
    },
  });

  const updatedRange = response.data.updates?.updatedRange ?? "";
  const match = /![A-Z]+(\d+):/.exec(updatedRange);
  return { row: match ? Number(match[1]) : 0 };
}

export async function appendExpenses(
  auth: OAuth2Client,
  spreadsheetId: string,
  inputs: ExpenseInput[],
): Promise<{ rows: number[] }> {
  if (inputs.length === 0) return { rows: [] };

  const { sheets } = clients(auth);
  const layout = await ensureSheetSchema(sheets, spreadsheetId);
  const createdAt = new Date().toISOString();

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TAB}!A:${columnLetter(canonicalWriteLength(layout))}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: inputs.map((input) =>
        toRowValues(input, layout, createdAt, ""),
      ),
    },
  });

  const updatedRange = response.data.updates?.updatedRange ?? "";
  const match = /![A-Z]+(\d+):/.exec(updatedRange);
  const start = match ? Number(match[1]) : 0;
  return {
    rows: inputs.map((_, index) => (start > 0 ? start + index : 0)),
  };
}

export type ExpensePatch = Partial<ExpenseInput>;

/**
 * Modification partielle et sûre :
 * - les champs absents du patch gardent leur valeur dans la feuille ;
 * - la date de création et les articles ne sont jamais écrasés par erreur ;
 * - si le ticket a été modifié entre-temps, une erreur de conflit est levée
 *   (sauf avec `force`), pour ne pas perdre une modification manuelle.
 */
export async function updateExpense(
  auth: OAuth2Client,
  spreadsheetId: string,
  row: number,
  patch: ExpensePatch,
  options: {
    expectedUpdatedAt?: string;
    expectedOriginal?: ExpenseFingerprint;
    force?: boolean;
  } = {},
): Promise<Expense> {
  const { sheets } = clients(auth);
  const layout = await ensureSheetSchema(sheets, spreadsheetId);
  const current = await readStoredExpense(sheets, spreadsheetId, layout, row);

  if (!current) {
    throw new SheetNotFoundError();
  }

  // Si la ligne a été déplacée (suppression d'une ligne au-dessus) ou modifiée,
  // l'empreinte ne correspond plus : on refuse d'écrire sur le mauvais ticket.
  if (
    !options.force &&
    options.expectedOriginal &&
    (current.date !== options.expectedOriginal.date ||
      current.merchant !== options.expectedOriginal.merchant ||
      Math.abs(current.amount - options.expectedOriginal.amount) > 0.001 ||
      (options.expectedOriginal.createdAt !== "" &&
        current.createdAt !== "" &&
        current.createdAt !== options.expectedOriginal.createdAt))
  ) {
    throw new SheetConflictError(current);
  }

  if (
    !options.force &&
    options.expectedUpdatedAt !== undefined &&
    options.expectedUpdatedAt !== current.updatedAt
  ) {
    throw new SheetConflictError(current);
  }

  const items = patch.items ?? current.items;
  const itemsWerePatched = patch.items !== undefined;
  const ticketSavings = patch.ticketSavings ?? current.ticketSavings;
  const merged: ExpenseInput = {
    date: patch.date ?? current.date,
    merchant: patch.merchant ?? current.merchant,
    category: patch.category ?? current.category,
    amount: patch.amount ?? current.amount,
    payment: patch.payment ?? current.payment,
    note: patch.note ?? current.note,
    receiptUrl: patch.receiptUrl ?? current.receiptUrl,
    items,
    tva: itemsWerePatched
      ? patch.tva ?? (items.length === 0 ? null : current.tva)
      : patch.tva ?? current.tva,
    savings: itemsWerePatched
      ? Math.max(patch.savings ?? 0, ticketSavings)
      : patch.savings ?? current.savings,
    ticketSavings,
    legacyTva: patch.legacyTva ?? current.legacyTva,
  };

  const updatedAt = new Date().toISOString();
  if (merged.tva !== null && (merged.tva < 0 || merged.tva >= merged.amount)) {
    // Un ancien ticket dont le montant a été baissé peut avoir une TVA héritée
    // devenue incohérente : on la retire plutôt que de bloquer la modification.
    merged.tva = null;
    merged.legacyTva = null;
  }
  if (merged.savings > merged.amount) merged.savings = merged.amount;
  if (merged.ticketSavings > merged.amount) {
    merged.ticketSavings = merged.amount;
  }
  merged.savings = Math.max(merged.savings, merged.ticketSavings);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A${row}:${columnLetter(canonicalWriteLength(layout))}${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        toRowValues(
          merged,
          layout,
          current.createdAt || new Date().toISOString(),
          updatedAt,
          current.raw,
        ),
      ],
    },
  });

  const { raw: _raw, legacyTva: _legacyTva, ...currentExpense } = current;
  const { legacyTva: _mergedLegacy, ...mergedExpense } = merged;

  return {
    ...currentExpense,
    ...mergedExpense,
    updatedAt,
  };
}

const sheetIdCache = new Map<string, number>();

async function getSheetId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<number> {
  const cached = sheetIdCache.get(spreadsheetId);
  if (cached !== undefined) return cached;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const sheetId = meta.data.sheets?.find(
    (sheet) => sheet.properties?.title === TAB,
  )?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Onglet « ${TAB} » introuvable dans la feuille Google.`);
  }

  sheetIdCache.set(spreadsheetId, sheetId);
  return sheetId;
}

export async function deleteExpense(
  auth: OAuth2Client,
  spreadsheetId: string,
  row: number,
): Promise<void> {
  const { sheets } = clients(auth);
  const sheetId = await getSheetId(sheets, spreadsheetId);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: Math.max(0, row - 1),
              endIndex: Math.max(1, row),
            },
          },
        },
      ],
    },
  });
}

export async function uploadReceipt(
  auth: OAuth2Client,
  folderId: string,
  file: { buffer: Buffer; mimeType: string; name: string },
): Promise<string> {
  const { drive } = clients(auth);
  const response = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimeType,
      body: Readable.from(file.buffer),
    },
    fields: "id, webViewLink",
  });

  if (response.data.webViewLink) return response.data.webViewLink;
  if (response.data.id) {
    return `https://drive.google.com/file/d/${response.data.id}/view`;
  }
  return "";
}
