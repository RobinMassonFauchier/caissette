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

export type ReceiptItemKind = "item" | "discount" | "fee";

/**
 * Un article lu sur un ticket. Les montants sont toujours positifs :
 * `amount` est le prix payé pour la ligne, `savings` la remise obtenue.
 * Une ligne de type « discount » représente une remise isolée (elle se
 * soustrait du total des articles).
 */
export interface ReceiptItem {
  label: string;
  category: Category;
  quantity: number;
  unitPrice: number | null;
  amount: number;
  tva: number | null;
  tvaRate: number | null;
  savings: number;
  bold: boolean;
  kind: ReceiptItemKind;
}

/** Détail structuré d'un ticket, stocké en JSON dans la feuille Google. */
export interface ReceiptDetails {
  version: 1;
  items: ReceiptItem[];
  /** TVA totale du ticket (calculée ou lue sur le ticket). */
  tva: number | null;
  /** Économies cumulées (promos, remises, coupons). */
  savings: number;
  /** Remise globale lue sur le ticket (hors remises déjà détaillées). */
  ticketSavings?: number;
  /** Ancienne TVA globale des tickets V1, conservée pour ne rien perdre. */
  legacyTva?: number | null;
  source?: "pdf" | "ocr";
}

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
  items: ReceiptItem[];
  savings: number;
  ticketSavings: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO, vide si jamais modifié
}

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/** Profil applicatif lié au compte Google, stocké dans le Drive de l'utilisateur. */
export interface UserProfile {
  sub: string;
  email: string;
  /** Nom affiché dans l'application (modifiable). */
  displayName: string;
  /** Nom fourni par Google au moment de la connexion. */
  googleName: string;
  picture?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export type ExpenseFingerprint = {
  date: string;
  merchant: string;
  amount: number;
  createdAt: string;
};

export type ExpensePayload = {
  date: string;
  merchant: string;
  category: Category;
  amount: number;
  payment: string;
  note: string;
  receiptUrl: string;
  items?: ReceiptItem[];
  /** TVA totale lue sur le ticket, conservée comme information (non éditable). */
  ticketTva?: number | null;
  /** Remise globale lue sur le ticket (hors lignes de remise détaillées). */
  ticketSavings?: number | null;
  /** Utilisé pour détecter une modification concurrente. */
  expectedUpdatedAt?: string;
  /** Identité de la ligne au moment de l'ouverture du formulaire. */
  expectedOriginal?: ExpenseFingerprint;
  /** Permet de forcer l'enregistrement malgré un conflit. */
  force?: boolean;
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
  items: ReceiptItem[];
  savings: number;
  ticketSavings: number;
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
