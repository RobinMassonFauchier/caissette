import { parseReceipt } from "../src/lib/parse-receipt";
import type { ParsedReceipt } from "../src/lib/types";

let failures = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    failures += 1;
    console.log(`❌ ${name}`, detail ?? "");
  }
}

function itemSum(result: ParsedReceipt): number {
  return (
    Math.round(
      result.items.reduce(
        (sum, item) =>
          item.kind === "discount" ? sum - item.amount : sum + item.amount,
        0,
      ) * 100,
    ) / 100
  );
}

function itemCount(result: ParsedReceipt): number {
  return result.items.filter((item) => item.kind !== "discount").length;
}

function findItem(result: ParsedReceipt, label: string) {
  return result.items.find((item) =>
    item.label.toLowerCase().includes(label.toLowerCase()),
  );
}

/* 1. Carrefour : ticket classique avec lignes simples. */
const carrefour = parseReceipt(`CARREFOUR MARKET
12 RUE DE LA PAIX
75002 PARIS
Date 20/11/2026
PAIN 1,20
LAIT 2,45
TOTAL TTC 3,65
TVA 5,50% 0,19
CARTE BANCAIRE 3,65`);
check(
  "Carrefour : total, TVA et 2 articles",
  carrefour.amount === 3.65 &&
    carrefour.tva === 0.19 &&
    itemCount(carrefour) === 2,
  carrefour,
);
check(
  "Carrefour : somme des articles = total",
  itemSum(carrefour) === 3.65,
  itemSum(carrefour),
);

/* 2. Lidl : quantité, remise, total net. */
const lidl = parseReceipt(`LIDL
Date 21/11/2026
2 x YAOURT NATURE 0,85 1,70
POMMES 2,19
REMISE 1,00
TOTAL 2,89
TVA 5,50% 0,15
CB 2,89`);
check(
  "Lidl : 2 articles + 1 remise, total net",
  itemCount(lidl) === 2 &&
    lidl.items.filter((item) => item.kind === "discount").length === 1 &&
    lidl.amount === 2.89 &&
    lidl.savings === 1,
  lidl,
);
check("Lidl : somme des articles = total", itemSum(lidl) === 2.89, itemSum(lidl));

/* 3. E.Leclerc : TOTAL A PAYER. */
const leclerc = parseReceipt(`E.LECLERC
Date 22/11/2026
PATES 1,45
SAUCE TOMATE 2,10
TOTAL A PAYER 3,55
TVA 5,50% 0,19
CARTE 3,55`);
check(
  "E.Leclerc : total à payer",
  leclerc.amount === 3.55 && itemCount(leclerc) === 2,
  leclerc,
);

/* 4. Restaurant : catégorie et TVA 10 %. */
const restaurant = parseReceipt(`LE BISTROT
Date 23/11/2026
MENU DU JOUR 18,50
CAFE 2,50
TOTAL 21,00
TVA 10,00% 1,91
CB 21,00`);
check(
  "Restaurant : catégorie Restaurants, total et TVA",
  restaurant.category === "Restaurants" &&
    restaurant.amount === 21 &&
    restaurant.tva === 1.91 &&
    itemCount(restaurant) === 2,
  restaurant,
);

/* 5. Pharmacie : catégorie Santé. */
const pharmacie = parseReceipt(`PHARMACIE DU CENTRE
DATE : 24/11/2026
DOLIPRANE 2,18
VITAMINE C 4,50
TOTAL 6,68
TVA 5,50% 0,35
CARTE 6,68`);
check(
  "Pharmacie : catégorie Santé",
  pharmacie.category === "Santé" &&
    pharmacie.amount === 6.68 &&
    itemCount(pharmacie) === 2,
  pharmacie,
);

/* 6. Facture en ligne Amazon. */
const amazon = parseReceipt(`AMAZON
Facture du 25 novembre 2026
LIVRE 12,99
TOTAL TTC 12,99
TVA 5,50% 0,68
CARTE BANCAIRE 12,99`);
check(
  "Amazon : date, catégorie Shopping, total",
  amazon.date === "2026-11-25" &&
    amazon.category === "Shopping" &&
    amazon.amount === 12.99 &&
    itemCount(amazon) === 1,
  amazon,
);

/* 7. Station-service. */
const carburant = parseReceipt(`TOTALENERGIES
Date 26/11/2026
GASOIL 45,20 L 62,30
TOTAL 62,30
TVA 20,00% 10,38
CB 62,30`);
check(
  "Station-service : catégorie Carburant",
  carburant.category === "Carburant" &&
    carburant.amount === 62.3 &&
    carburant.tva === 10.38,
  carburant,
);

/* 8. En-têtes de rayon génériques et produit pesé. */
const marche = parseReceipt(`SUPERMARCHE
Date 27/11/2026
*** FRUITS ***
POMME 2,50
BANANE
1,234 kg x 1,80 €/kg 2,22
--- EPICERIE ---
RIZ 3,10
TOTAL 7,82
TVA 5,50% 0,41
CB 7,82`);
const banane = findItem(marche, "banane");
check(
  "Rayons génériques : 3 articles, section Fruits et Épicerie",
  itemCount(marche) === 3 &&
    marche.items.some((item) => item.section === "Fruits") &&
    marche.items.some((item) => item.section === "Épicerie"),
  marche.items.map((item) => ({ label: item.label, section: item.section })),
);
check(
  "Produit pesé générique : 1,234 kg × 1,80 €/kg = 2,22 €",
  Boolean(
    banane &&
      banane.quantity === 1.234 &&
      banane.unit === "kg" &&
      banane.unitPrice === 1.8 &&
      banane.amount === 2.22,
  ),
  banane,
);

/* 9. Bloc fidélité générique. */
const fidelite = parseReceipt(`CARREFOUR
Date 28/11/2026
PAIN 1,20
TOTAL 1,20
CARTE 1,20
VOS POINTS FIDELITE
100 POINTS
SOLDE 250 POINTS`);
check(
  "Bloc fidélité générique ignoré",
  itemCount(fidelite) === 1 &&
    !fidelite.items.some((item) => /points|solde/i.test(item.label)),
  fidelite.items,
);

/* 10. Ticket sans détail : le total reste exploitable. */
const sncf = parseReceipt(`SNCF
Facture du 03 novembre 2026
TOTAL 68,00 EUR
Carte bancaire`);
check(
  "Ticket sans détail : total conservé + avertissement",
  sncf.amount === 68 &&
    sncf.items.length === 0 &&
    sncf.warnings.some((warning) => /détail des articles/i.test(warning)),
  sncf,
);

/* 11. Remise globale sans double comptage. */
const remise = parseReceipt(`LIDL
Date 29/11/2026
ARTICLE A 5,00
ARTICLE B 3,00
REMISE 1,00
TOTAL REDUCTIONS 1,00
TOTAL 7,00
CB 7,00`);
check(
  "Remise globale : 2 articles + 1 remise, pas de double comptage",
  itemCount(remise) === 2 &&
    remise.items.filter((item) => item.kind === "discount").length === 1 &&
    remise.savings === 1 &&
    remise.amount === 7,
  remise,
);

/* 12. Codes 11/13 sans tableau de TVA : on ne les convertit pas en taux. */
const sansTable = parseReceipt(`MAGASIN X
Date 01/12/2026
PRODUIT 4,45 € 11
AUTRE 7,79 € 13
TOTAL 12,24
CB 12,24`);
check(
  "Codes 11/13 sans tableau : libellés nettoyés, pas de TVA inventée",
  itemCount(sansTable) === 2 &&
    sansTable.items.every((item) => item.tva === null) &&
    sansTable.items.every((item) => !/\b(11|13)\b/.test(item.label)),
  sansTable.items,
);

console.log(
  failures === 0 ? "\nTous les magasins testés passent." : `\n${failures} cas en échec.`,
);
process.exit(failures === 0 ? 0 : 1);
