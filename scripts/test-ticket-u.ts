import fs from "node:fs";
import path from "node:path";
import { parseReceipt } from "../src/lib/parse-receipt";
import type { ReceiptItem } from "../src/lib/types";

let failures = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    failures += 1;
    console.log(`❌ ${name}`, detail ?? "");
  }
}

function findItem(items: ReceiptItem[], label: string): ReceiptItem | undefined {
  return items.find((item) =>
    item.label.toLowerCase().includes(label.toLowerCase()),
  );
}

const text = fs.readFileSync(
  path.join(__dirname, "fixtures", "ticket-u-2026-01-07.txt"),
  "utf8",
);
const result = parseReceipt(text);
const items = result.items.filter((item) => item.kind === "item");
const discounts = result.items.filter((item) => item.kind === "discount");
const itemsSum =
  Math.round(
    result.items.reduce(
      (sum, item) =>
        item.kind === "discount" ? sum - item.amount : sum + item.amount,
      0,
    ) * 100,
  ) / 100;

check("Date de transaction", result.date === "2026-01-07", result.date);
check(
  "Magasin Magasin U Rognonas",
  result.merchant === "Magasin U Rognonas",
  result.merchant,
);
check("Total payé", result.amount === 102.35, result.amount);
check("TVA totale", result.tva === 9.3, result.tva);
const itemTvaSum =
  Math.round(
    result.items.reduce((sum, item) => sum + (item.tva ?? 0), 0) * 100,
  ) / 100;
check("TVA cumulée des articles", itemTvaSum === 9.3, itemTvaSum);
check("Économies", result.savings === 3.75, result.savings);
check("Aucun avertissement", result.warnings.length === 0, result.warnings);
check("35 articles achetés", items.length === 35, items.length);
check("3 lignes de remise", discounts.length === 3, discounts.length);
check("Somme des articles = total payé", itemsSum === 102.35, itemsSum);

const fenouil = findItem(items, "fenouil");
check(
  "Fenouil pesé 0,862 kg à 2,45 €/kg = 2,11 €",
  Boolean(
    fenouil &&
      fenouil.quantity === 0.862 &&
      fenouil.unit === "kg" &&
      fenouil.unitPrice === 2.45 &&
      fenouil.amount === 2.11,
  ),
  fenouil,
);

const endive = findItem(items, "endive");
check(
  "Endive 2 × 1,89 € = 3,78 €",
  Boolean(
    endive &&
      endive.quantity === 2 &&
      endive.unitPrice === 1.89 &&
      endive.amount === 3.78,
  ),
  endive,
);

const beurre = findItem(items, "beurre doux");
check(
  "Beurre 4 × 2,45 € = 9,80 €",
  Boolean(
    beurre &&
      beurre.quantity === 4 &&
      beurre.unitPrice === 2.45 &&
      beurre.amount === 9.8,
  ),
  beurre,
);

const petitSuisse = findItem(items, "petit-suisse");
check(
  "Petit-Suisse conditionnement 12 × 60 g, prix 2,45 €",
  Boolean(
    petitSuisse &&
      petitSuisse.quantity === 1 &&
      petitSuisse.amount === 2.45 &&
      /12 × 60 g/.test(petitSuisse.label),
  ),
  petitSuisse,
);

const dentifrice = findItem(items, "dentifrice");
check(
  "Dentifrice Original Parodontax présent",
  Boolean(dentifrice && dentifrice.amount === 5.38),
  dentifrice,
);

check(
  "Aucune ligne de solde Carte U dans les articles",
  !result.items.some((item) =>
    /solde|gagnes|carte u|nouveau solde/i.test(item.label),
  ),
  result.items.map((item) => item.label),
);

check(
  "Aucune ligne de points Carte U dans les articles",
  !result.items.some((item) =>
    /papier toilette u x24|mozzarella u 125g/i.test(item.label),
  ),
  result.items.map((item) => item.label),
);

check(
  "Sections de rayon conservées",
  result.items.some((item) => item.section === "Fruits et Légumes") &&
    result.items.some((item) => item.section === "Beauté & Santé") &&
    result.items.some((item) => item.section === "Crémerie Libre-Service"),
  result.items.map((item) => item.section),
);

console.log(
  failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`,
);
process.exit(failures === 0 ? 0 : 1);
