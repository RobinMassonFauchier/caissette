import { google, type drive_v3, type sheets_v4 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { Category, Expense } from "./types";
import { isCategory } from "./catalog";

export const SPREADSHEET_TITLE = "Dépenses — Caissette";
export const FOLDER_NAME = "Tickets de caisse — Caissette";

const TAB = "Dépenses";
const LAST_COLUMN = "I";
const HEADER = [
  "Date",
  "Magasin",
  "Catégorie",
  "Montant",
  "TVA",
  "Paiement",
  "Note",
  "Ticket",
  "Ajouté le",
];

export type Workspace = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  folderId: string;
};

export type ExpenseInput = {
  date: string;
  merchant: string;
  category: Category;
  amount: number;
  tva: number | null;
  payment: string;
  note: string;
  receiptUrl: string;
};

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
  const { sheets, drive } = clients(auth);
  const folderId = await ensureFolder(drive);

  const found = await drive.files.list({
    q: `name = '${escapeQuery(SPREADSHEET_TITLE)}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id, webViewLink)",
    pageSize: 1,
    spaces: "drive",
  });

  const existing = found.data.files?.[0];
  if (existing?.id) {
    return {
      spreadsheetId: existing.id,
      spreadsheetUrl: existing.webViewLink || spreadsheetUrl(existing.id),
      folderId,
    };
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

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB}!A1:${LAST_COLUMN}1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });

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
          ...[
            { index: 0, width: 100 }, // Date
            { index: 1, width: 220 }, // Magasin
            { index: 2, width: 140 }, // Catégorie
            { index: 3, width: 110 }, // Montant
            { index: 4, width: 90 }, // TVA
            { index: 5, width: 130 }, // Paiement
            { index: 6, width: 220 }, // Note
            { index: 7, width: 70 }, // Ticket
            { index: 8, width: 150 }, // Ajouté le
          ].map((column) => ({
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: "COLUMNS" as const,
                startIndex: column.index,
                endIndex: column.index + 1,
              },
              properties: { pixelSize: column.width },
              fields: "pixelSize",
            },
          })),
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 5000,
                startColumnIndex: 0,
                endColumnIndex: 1,
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
                startColumnIndex: 3,
                endColumnIndex: 5,
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
                startColumnIndex: 8,
                endColumnIndex: 9,
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
        ],
      },
    });
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

  return {
    spreadsheetId,
    spreadsheetUrl: created.data.spreadsheetUrl || spreadsheetUrl(spreadsheetId),
    folderId,
  };
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
  return Number.isFinite(parsed) ? parsed : null;
}

function cellText(value: unknown): string {
  return String(value ?? "").trim();
}

function mapRow(row: unknown[], rowNumber: number): Expense | null {
  const date = cellToIsoDate(row[0]);
  const merchant = cellText(row[1]);
  const amount = cellNumber(row[3]);

  if (!date && !merchant && amount === null) return null;

  const rawCategory = cellText(row[2]);

  return {
    row: rowNumber,
    date,
    merchant,
    category: (isCategory(rawCategory) ? rawCategory : "Divers") as Category,
    amount: amount ?? 0,
    tva: cellNumber(row[4]),
    payment: cellText(row[5]) || "Carte bancaire",
    note: cellText(row[6]),
    receiptUrl: cellText(row[7]),
    createdAt: cellToIsoDateTime(row[8]),
  };
}

export async function readExpenses(
  auth: OAuth2Client,
  spreadsheetId: string,
): Promise<Expense[]> {
  const { sheets } = clients(auth);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB}!A2:${LAST_COLUMN}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });

  const rows = response.data.values ?? [];
  return rows
    .map((row, index) => mapRow(row, index + 2))
    .filter((expense): expense is Expense => expense !== null);
}

function toRowValues(input: ExpenseInput): (string | number)[] {
  return [
    input.date,
    input.merchant,
    input.category,
    input.amount,
    input.tva ?? "",
    input.payment,
    input.note,
    input.receiptUrl,
  ];
}

export async function appendExpense(
  auth: OAuth2Client,
  spreadsheetId: string,
  input: ExpenseInput,
): Promise<{ row: number }> {
  const { sheets } = clients(auth);
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TAB}!A:${LAST_COLUMN}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[...toRowValues(input), new Date().toISOString()]],
    },
  });

  const updatedRange = response.data.updates?.updatedRange ?? "";
  const match = /![A-Z]+(\d+):/.exec(updatedRange);
  return { row: match ? Number(match[1]) : 0 };
}

export async function updateExpense(
  auth: OAuth2Client,
  spreadsheetId: string,
  row: number,
  input: ExpenseInput,
): Promise<void> {
  const { sheets } = clients(auth);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A${row}:H${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [toRowValues(input)] },
  });
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
      body: file.buffer,
    },
    fields: "id, webViewLink",
  });

  if (response.data.webViewLink) return response.data.webViewLink;
  if (response.data.id) {
    return `https://drive.google.com/file/d/${response.data.id}/view`;
  }
  return "";
}
