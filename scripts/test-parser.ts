import { parseReceipt } from "../src/lib/parse-receipt";

type Case = {
  name: string;
  text: string;
  expect: Partial<{
    date: string;
    merchant: string;
    category: string;
    amount: number;
    payment: string;
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
    expect: { date: "2026-11-20", merchant: "Carrefour", category: "Alimentation", amount: 42.18, payment: "Carte bancaire" },
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
];

let failures = 0;

for (const testCase of cases) {
  const result = parseReceipt(testCase.text);
  const problems: string[] = [];

  for (const [key, expected] of Object.entries(testCase.expect)) {
    const actual = result[key as keyof typeof result];
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
