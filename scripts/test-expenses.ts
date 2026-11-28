import { parseExpenseInput, parseExpensePatch } from "../src/lib/validation";

let failures = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    failures += 1;
    console.log(`❌ ${name}`, detail ?? "");
  }
}

const item = {
  label: "PAIN",
  category: "Alimentation",
  quantity: 2,
  unitPrice: 2,
  amount: 4,
  tva: null,
  tvaRate: null,
  savings: 0,
  bold: true,
  kind: "item",
};

const discount = {
  label: "REMISE",
  category: "Alimentation",
  quantity: 1,
  unitPrice: null,
  amount: 1,
  tva: null,
  tvaRate: null,
  savings: 1,
  bold: false,
  kind: "discount",
};

const base = {
  date: "2026-11-20",
  merchant: "Carrefour",
  category: "Alimentation",
  amount: 10,
  payment: "Carte bancaire",
  note: "",
  receiptUrl: "",
};

const created = parseExpenseInput({ ...base, items: [item, discount] });
check("Création avec articles valide", created.ok, created);
if (created.ok) {
  check("Deux articles conservés", created.value.items.length === 2);
  check("Remise cumulée", created.value.savings === 1, created.value.savings);
  check("TVA calculée absente", created.value.tva === null, created.value.tva);
}

const withTicketTva = parseExpenseInput({
  ...base,
  items: [item],
  ticketTva: 1.67,
});
check(
  "TVA ticket utilisée si aucun article n'en porte",
  withTicketTva.ok && withTicketTva.value.tva === 1.67,
  withTicketTva,
);

const itemWithTva = {
  ...item,
  tva: 1.2,
  tvaRate: 20,
};
const withItemTva = parseExpenseInput({
  ...base,
  items: [itemWithTva],
  ticketTva: 5,
});
check(
  "TVA des articles prioritaire",
  withItemTva.ok && withItemTva.value.tva === 1.2,
  withItemTva,
);

const badTicketTva = parseExpenseInput({
  ...base,
  amount: 2,
  items: [item],
  ticketTva: 5,
});
check("TVA ticket > montant refusée", !badTicketTva.ok, badTicketTva);

const patch = parseExpensePatch({
  note: "Courses",
  items: [item, discount],
  ticketSavings: 2,
  expectedUpdatedAt: "",
  expectedOriginal: {
    date: "2026-11-20",
    merchant: "Carrefour",
    amount: 10,
    createdAt: "2026-11-20T10:00:00.000Z",
  },
});
check("Modification partielle valide", patch.ok, patch);
if (patch.ok) {
  check(
    "Économies = max(articles, remise ticket)",
    patch.value.patch.savings === 2,
    patch.value.patch.savings,
  );
  check(
    "Empreinte transmise",
    patch.value.expectedOriginal?.merchant === "Carrefour",
  );
}

const invalidItem = parseExpenseInput({
  ...base,
  items: [{ ...item, amount: 0 }],
});
check("Article à 0 € refusé", !invalidItem.ok, invalidItem);

const emptyPatch = parseExpensePatch({});
check("Patch vide refusé", !emptyPatch.ok, emptyPatch);

console.log(
  failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`,
);
process.exit(failures === 0 ? 0 : 1);
