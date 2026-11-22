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
    tva: number | null;
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
    name: "Taux de TVA sans pourcentage ne doit pas être pris pour un montant",
    text: `LIDL
Date 22/11/2026
TVA 20,00
TOTAL 42,18
CB`,
    expect: { merchant: "Lidl", amount: 42.18, tva: null },
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
