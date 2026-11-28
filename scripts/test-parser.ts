import { parseReceipt, type ParseReceiptOptions } from "../src/lib/parse-receipt";

type Case = {
  name: string;
  text: string;
  options?: ParseReceiptOptions;
  expect: Partial<{
    date: string;
    merchant: string;
    category: string;
    amount: number;
    payment: string;
    tva: number | null;
    savings: number;
    ticketSavings: number;
    itemCount: number;
    firstItem: string;
    firstCategory: string;
    firstQuantity: number;
    firstAmount: number;
    firstUnitPrice: number;
    firstBold: boolean;
  }>;
};

const cases: Case[] = [
  {
    name: "Carrefour CB",
    text: `CARREFOUR MARKET
12 RUE DE LA PAIX
75002 PARIS
TEL 01 23 45 67 89
Ticket n° 12345
Date 20/11/2026  Heure 12:34
PAIN 1,20
LAIT 2,45
DIVERS 38,53
TOTAL TTC 42,18
TVA 20,00% 7,03
CARTE BANCAIRE 42,18
MERCI DE VOTRE VISITE`,
    expect: { date: "2026-11-20", merchant: "Carrefour Market", category: "Alimentation", amount: 42.18, payment: "Carte bancaire", tva: 7.03 },
  },
  {
    name: "PDF sur une seule ligne",
    text: `CARREFOUR MARKET 12 RUE DE LA PAIX 75002 PARIS TEL 01 23 45 67 89 DATE 20/11/2026 TOTAL TTC 42,18 TVA 20,00% 7,03 CARTE BANCAIRE 42,18 MERCI DE VOTRE VISITE`,
    expect: { date: "2026-11-20", merchant: "Carrefour Market", amount: 42.18, tva: 7.03, payment: "Carte bancaire" },
  },
  {
    name: "TVA taux seul puis taux avec montant",
    text: `LIDL
Date 22/11/2026
TVA 20
TVA 20,00% 7,03
TOTAL 42,18
CB`,
    expect: { merchant: "Lidl", amount: 42.18, tva: 7.03 },
  },
  {
    name: "TVA multi-taux avec total explicite",
    text: `CARREFOUR MARKET
12 RUE DE LA PAIX
75002 PARIS
TVA 5,50% 0,52
TVA 20,00% 7,03
TOTAL TVA 7,55
TOTAL TTC 42,18
CARTE BANCAIRE 42,18`,
    expect: { merchant: "Carrefour Market", amount: 42.18, tva: 7.55 },
  },
  {
    name: "TVA multi-taux sans ligne de total",
    text: `LIDL
Date 21/11/2026
TVA 5,50% 0,52
TVA 20,00% 7,03
TOTAL 42,18
CB 42,18`,
    expect: { merchant: "Lidl", amount: 42.18, tva: 7.55 },
  },
  {
    name: "Taux de TVA seul recalculé à partir du total",
    text: `LIDL
Date 22/11/2026
TVA 20,00
TOTAL 42,18
CB`,
    expect: { merchant: "Lidl", amount: 42.18, tva: 7.03 },
  },
  {
    name: "TVA 20 sans décimales ni pourcentage",
    text: `LIDL
Date 22/11/2026
TVA 20
TOTAL 42,18
CB`,
    expect: { merchant: "Lidl", amount: 42.18, tva: 7.03 },
  },
  {
    name: "TVA sans signe pourcentage mais avec montant",
    text: `LIDL
Date 22/11/2026
TVA 20,00 7,03
TOTAL 42,18
CB`,
    expect: { merchant: "Lidl", amount: 42.18, tva: 7.03 },
  },
  {
    name: "TVA sur une seule ligne",
    text: `LE PETIT MARCHE
Date 22/11/2026
TOTAL 18,90
DONT TVA 3,15
CB`,
    expect: { merchant: "Le Petit Marche", amount: 18.9, tva: 3.15 },
  },
  {
    name: "Un mot de marque dans une ligne produit ne prend pas le dessus",
    text: `LE PETIT MARCHE
Date 09/11/2026
ACTION PROMO 2,00
TOTAL 18,90`,
    expect: { merchant: "Le Petit Marche", amount: 18.9 },
  },
  {
    name: "Magasin précédé d'une adresse",
    text: `12 RUE DE LA PAIX
75002 PARIS
TEL 01 23 45 67 89
LE PETIT MARCHE
Date 09/11/2026
TOTAL 18,90`,
    expect: { merchant: "Le Petit Marche", amount: 18.9, category: "Alimentation" },
  },
  {
    name: "Raison sociale à supprimer",
    text: `BOULANGERIE MARTIN SARL
12 AVENUE DE LA GARE
Date 10/11/2026
TOTAL 8,40`,
    expect: { merchant: "Boulangerie Martin", amount: 8.4, category: "Restaurants" },
  },
  {
    name: "SNCF texte",
    text: `SNCF CONNECT
Facture du 03 novembre 2026
Billet Paris - Lyon
TOTAL 68,00 EUR
Carte bancaire`,
    expect: { date: "2026-11-03", merchant: "SNCF", category: "Transport", amount: 68, payment: "Carte bancaire" },
  },
  {
    name: "Pharmacie espèces",
    text: `PHARMACIE DU CENTRE
DATE : 05/11/2026
MONTANT TOTAL 23,40
ESPECES 25,00
RENDU 1,60`,
    expect: { date: "2026-11-05", merchant: "Pharmacie", category: "Santé", amount: 23.4, payment: "Espèces" },
  },
  {
    name: "Remise et total articles",
    text: `LIDL
Date: 07/11/26
TOTAL ARTICLES 15,00
REMISE 2,50
TOTAL 12,50
CB 12,50`,
    expect: { date: "2026-11-07", merchant: "Lidl", category: "Alimentation", amount: 12.5 },
  },
  {
    name: "Station-service Carrefour",
    text: `CARREFOUR
STATION SERVICE
Date 08/11/2026
GASOIL 45,20 L
TOTAL 62,30
CB`,
    expect: { merchant: "Carrefour", category: "Carburant", amount: 62.3 },
  },
  {
    name: "Netflix",
    text: `NETFLIX.COM
Date 02/11/2026
ABONNEMENT MENSUEL
TOTAL 13,49
VISA`,
    expect: { merchant: "Netflix", category: "Abonnements", amount: 13.49 },
  },
  {
    name: "Magasin inconnu",
    text: `LE PETIT MARCHE
Date 09/11/2026
TOTAL 18,90`,
    expect: { merchant: "Le Petit Marche", amount: 18.9, category: "Alimentation" },
  },
  {
    name: "Détail des articles, quantités et remise",
    text: `CARREFOUR MARKET
Date 20/11/2026
2 X PAIN 1,20 2,40
LAIT 2,45
DIVERS 38,53
REMISE 2,50
TOTAL TTC 40,88
TVA 5,50% 0,52
TVA 20,00% 6,29
TOTAL TVA 6,81
CARTE BANCAIRE 40,88`,
    expect: {
      amount: 40.88,
      tva: 6.81,
      itemCount: 4,
      savings: 2.5,
      firstItem: "Pain",
      firstQuantity: 2,
      firstAmount: 2.4,
      firstUnitPrice: 1.2,
      firstCategory: "Alimentation",
    },
  },
  {
    name: "Article en gras détecté par le PDF",
    text: `CARREFOUR MARKET
Date 20/11/2026
PROMO CAFE 3,49
LAIT 2,45
TOTAL 5,94`,
    options: { boldLines: ["PROMO CAFE 3,49"] },
    expect: {
      firstItem: "Promo Café",
      firstBold: true,
      itemCount: 2,
    },
  },
  {
    name: "Catégorie d'article non alimentaire dans un supermarché",
    text: `CARREFOUR MARKET
Date 20/11/2026
LESSIVE 6,50
SHAMPOO 4,20
PAIN 1,20
TOTAL 11,90`,
    expect: {
      itemCount: 3,
      firstItem: "Lessive",
      firstCategory: "Logement",
    },
  },
  {
    name: "Catégorie par défaut pour un article inconnu",
    text: `LE PETIT MARCHE
Date 09/11/2026
PRODUIT MYSTERE 4,00
TOTAL 4,00`,
    options: { defaultCategory: "Divers" },
    expect: { itemCount: 1, firstCategory: "Alimentation" },
  },
  {
    name: "Économie globale sans détail",
    text: `LIDL
Date 07/11/2026
TOTAL 12,50
VOUS AVEZ ECONOMISE 3,20
CB 12,50`,
    expect: { amount: 12.5, savings: 3.2, ticketSavings: 3.2 },
  },
];

let failures = 0;

for (const testCase of cases) {
  const result = parseReceipt(testCase.text, testCase.options);
  const first = result.items[0];
  const actualValues: Record<string, unknown> = {
    ...result,
    savings: result.savings,
    itemCount: result.items.length,
    firstItem: first?.label,
    firstCategory: first?.category,
    firstQuantity: first?.quantity,
    firstAmount: first?.amount,
    firstUnitPrice: first?.unitPrice ?? undefined,
    firstBold: first?.bold,
  };
  const problems: string[] = [];

  for (const [key, expected] of Object.entries(testCase.expect)) {
    const actual = actualValues[key];
    if (actual !== expected) {
      problems.push(`${key}: attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
    }
  }

  if (problems.length > 0) {
    failures += 1;
    console.log(`❌ ${testCase.name}`);
    for (const problem of problems) console.log(`   - ${problem}`);
  } else {
    console.log(`✅ ${testCase.name}`);
  }
}

console.log(failures === 0 ? "\nTous les cas passent." : `\n${failures} cas en échec.`);
process.exit(failures === 0 ? 0 : 1);
