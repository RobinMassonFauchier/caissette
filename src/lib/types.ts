export type Category =
  | "Alimentation"
  | "Restaurants"
  | "Transport"
  | "Carburant"
  | "Santé"
  | "Logement"
  | "Loisirs"
  | "Shopping"
  | "Abonnements"
  | "Divers";

export type PaymentMethod =
  | "Carte bancaire"
  | "Espèces"
  | "Chèque"
  | "Virement"
  | "Autre";

export interface Expense {
  /** Numéro de ligne dans la feuille Google (1 = en-tête). */
  row: number;
  date: string; // YYYY-MM-DD
  merchant: string;
  category: Category;
  amount: number;
  tva: number | null;
  payment: string;
  note: string;
  receiptUrl: string;
  createdAt: string; // ISO
}

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export type ExpensePayload = {
  date: string;
  merchant: string;
  category: Category;
  amount: number;
  tva: number | null;
  payment: string;
  note: string;
  receiptUrl: string;
};

export interface ParsedReceipt {
  date: string;
  dateFound: boolean;
  merchant: string;
  merchantFound: boolean;
  category: Category;
  amount: number | null;
  tva: number | null;
  payment: PaymentMethod;
  note: string;
  warnings: string[];
  rawText: string;
}

export interface ExtractedReceipt extends ParsedReceipt {
  fileUrl: string;
  fileName: string;
  source: "pdf" | "ocr";
}

export interface DriveImportResult extends ExtractedReceipt {
  fileId?: string;
}
