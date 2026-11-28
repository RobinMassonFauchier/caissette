# Caissette — Description complète de l'outil

> **Document de référence vivant.**
> Il doit être mis à jour **dans la même intervention** que toute modification fonctionnelle, visuelle, technique, de sécurité, de configuration ou de limite de l'outil.
> Voir la section « Maintenance de ce document » en fin de fichier.

| Information | Valeur |
| --- | --- |
| Nom du produit | **Caissette** |
| Nom technique du paquet | `tickets-de-caisse` |
| Version du paquet | `0.1.0` |
| Dernière mise à jour de ce document | **23 novembre 2026** |
| Version décrite | **Caissette V2** (détail des articles, profil, économies) |
| Application en ligne | <https://caissette.onrender.com> |
| Dépôt | <https://github.com/RobinMassonFauchier/caissette> |
| Langue de l'interface | Français |
| Nature | Application web privée à usage familial |

---

## 1. En bref

**Caissette** est un gestionnaire de dépenses familial. L'utilisateur envoie un ticket de caisse — photo, PDF du magasin ou fichier déjà présent dans son Google Drive — et l'application :

1. lit le ticket (texte natif du PDF ou OCR local) ;
2. en extrait la **date**, le **magasin**, le **montant**, le **détail des articles** (nom, quantité, prix, TVA, catégorie, mise en avant), les **économies** et le **moyen de paiement** ;
3. classe chaque article dans sa catégorie, avec la catégorie du ticket puis la catégorie par défaut en repli ;
4. propose ces informations dans une fenêtre de vérification modifiable ;
5. ajoute la dépense et son détail dans **le Google Sheet personnel de l'utilisateur** ;
6. archive le justificatif original dans **le Google Drive personnel de l'utilisateur** ;
7. met à jour le tableau de bord, les statistiques, les économies et le suivi de budget.

Chaque compte Google dispose de sa propre feuille, de son propre dossier et de son propre profil. L'application ne possède **ni base de données ni stockage de fichiers sur son serveur**.

---

## 2. Problème résolu et promesse

### 2.1 Problème

Tenir un budget familial à partir de tickets de caisse impose normalement de recopier à la main, ticket après ticket : date, commerce, montant, catégorie. C'est fastidieux, source d'erreurs et rarement tenu dans la durée.

### 2.2 Promesse

- **Zéro ressaisie** dans le cas nominal : les champs sont pré-remplis.
- **Zéro dépendance** à un tableur propriétaire imposé : les données vont dans un Google Sheet que l'utilisateur possède déjà.
- **Zéro stockage serveur** : pas de base de données, pas de fichiers hébergés par l'application.
- **Zéro friction** : pas d'application mobile à installer, pas d'abonnement, pas de carte bancaire.
- **Toujours corrigeable** : aucun ticket n'est enregistré sans validation humaine, et tout reste modifiable ensuite.

---

## 3. Principes de conception

1. **Local-first pour les données** : feuille de calcul et justificatifs appartiennent à l'utilisateur, dans son Drive.
2. **OCR sans service tiers** : Tesseract.js tourne sur la machine qui exécute l'application ; aucune image n'est envoyée à une IA externe.
3. **Portée Google minimale** : uniquement `drive.file`, considérée comme non sensible par Google, plus l'identité (`openid`, `email`, `profile`). Aucun accès global aux feuilles de calcul, au reste du Drive, à Gmail ou aux contacts.
4. **Humain dans la boucle** : l'extraction est heuristique et volontairement imparfaite ; l'utilisateur relit et corrige avant enregistrement.
5. **Aucune donnée serveur** : le serveur agit comme un mandataire technique entre le navigateur, Google Sheets, Google Drive et Tesseract.
6. **Accessibilité et mobile d'abord** : navigation mobile dédiée, zones tactiles confortables, contrastes, clavier, lecteurs d'écran.
7. **Simplicité d'exploitation** : une seule application Next.js, déployable sur un PC ou sur un hébergement gratuit.

---

## 4. Publics et parcours types

### 4.1 Publics

- **Membre de la famille** : consulte ses dépenses, ajoute des tickets, règle son budget.
- **Administrateur** : gère les identifiants OAuth Google, la liste `ALLOWED_EMAILS`, le déploiement et les mises à jour.
- **Utilisateur non autorisé** : peut voir la page d'accueil, mais ne peut pas se connecter si son adresse n'est pas dans `ALLOWED_EMAILS`.

### 4.2 Parcours type « premier ticket »

1. L'utilisateur ouvre le site et clique sur **Continuer avec Google**.
2. Il autorise l'application (identité + `drive.file`).
3. Au premier chargement du tableau de bord, Caissette crée automatiquement :
   - le classeur **« Dépenses — Caissette »** ;
   - le dossier **« Tickets de caisse — Caissette »** ;
   - le profil privé **« profil-caissette-<empreinte>.json »**.
4. Il photographie un ticket ou dépose un PDF.
5. La fenêtre de vérification s'ouvre avec les champs pré-remplis, le détail des articles et, si nécessaire, des avertissements jaunes.
6. Il corrige, vérifie les catégories des articles, enregistre.
7. La ligne et son détail JSON sont ajoutés au Sheet, le tableau de bord se met à jour et le justificatif est archivé dans le dossier Drive.

### 4.3 Parcours type « ajout manuel »

1. Bouton **Ajouter** dans la liste des tickets.
2. Saisie de la date, du magasin, du montant, de la catégorie, du moyen de paiement et d'une note.
3. Ajout facultatif d'articles et de remises via l'éditeur de détail.
4. Enregistrement : la ligne rejoint le Sheet sans justificatif.

### 4.4 Parcours type « import Drive groupé »

1. Bouton **Importer depuis Google Drive**.
2. Sélection de 1 à 5 fichiers via Google Picker.
3. Lecture séquentielle des fichiers, avec progression.
4. Fenêtre récapitulative : cases à cocher, champs modifiables, total et économies sélectionnés.
5. Import groupé et rafraîchissement du tableau.

---

## 5. Vue d'ensemble de l'architecture

### 5.1 Pile technique

| Couche | Technologie |
| --- | --- |
| Framework | Next.js 15.5.29 (App Router), React 19.3.1 |
| Langage | TypeScript 5.9.3 |
| Styles | Tailwind CSS 4.3.5 |
| Runtime | Node.js **24 ou plus** (exigé par `unpdf`) |
| Authentification | OAuth 2.0 Google + `iron-session` 9.1.0 |
| Google APIs | `googleapis` 190.0.0 (Sheets v4, Drive v3) |
| PDF | `unpdf` 2.2.1 |
| OCR | `tesseract.js` 7.0.0 (langue `fra`) |
| Traitement d'image | `sharp` 0.35.5 |
| UI | `lucide-react`, `sonner` (toasts), `clsx`, `tailwind-merge` |
| Tests utilitaires | `tsx` |

### 5.2 Flux de données

```text
Navigateur
  │  fichier (photo/PDF)
  ▼
POST /api/extract
  │  ├─ PDF  → unpdf (texte + polices pour le gras)
  │  └─ image → sharp (prétraitement) → Tesseract.js (OCR fra + blocs)
  ▼
parse-receipt.ts (heuristiques françaises + articles + économies)
  ▼
Réponse JSON : champs + articles + avertissements + texte brut + URL du justificatif
  ▼
Fenêtre de vérification (React, détail des articles éditable)
  ▼
POST /api/expenses  (ou /api/expenses/bulk)
  ▼
Google Sheets API → feuille « Dépenses — Caissette » (dont colonne Articles JSON)
Google Drive API  → dossier « Tickets de caisse — Caissette » (tickets + profil)
```

### 5.3 Caractéristiques d'exécution

- Routes serveur en runtime **Node.js**, `dynamic = "force-dynamic"`.
- Routes d'extraction limitées à **60 secondes** (`maxDuration = 60`) sur l'hébergement compatible.
- `sharp`, `tesseract.js` et `unpdf` sont exclus du bundle Next.js (`serverExternalPackages`) car ils utilisent des binaires ou workers natifs.
- Caches mémoire, perdus au redémarrage :
  - espace de travail (feuille + dossier) : **15 minutes**, clé = refresh token ;
  - jeton d'accès Google : jusqu'à son expiration (avec marge de 60 s) ;
  - identifiant d'onglet Google Sheets : illimité tant que le serveur tourne.

---

## 6. Modèle de données et stockage

### 6.1 Google Sheet

- **Titre** : `Dépenses — Caissette`
- **Onglet** : `Dépenses`
- **Langue** : `fr_FR`
- **Fuseau** : `Europe/Paris`
- **En-tête figée** : ligne 1
- **Colonnes** : le schéma V2 est appliqué par en-têtes. Une feuille V1 existante est conservée : les colonnes manquantes sont ajoutées à droite, l'ancienne colonne **TVA** est masquée et ses valeurs restent prises en compte (elles rejoignent le JSON `Articles` à la prochaine modification de la ligne).

| Ordre indicatif | Libellé | Contenu |
| --- | --- | --- |
| 1 | Date | Date de la dépense (AAAA-MM-JJ en interne, affichage `jj/mm/aaaa`) |
| 2 | Magasin | Nom du commerce, 120 caractères maximum |
| 3 | Catégorie | Une des 10 catégories |
| 4 | Montant | Montant TTC en euros |
| 5 | Paiement | Carte bancaire, Espèces, Chèque, Virement, Autre |
| 6 | Note | Texte libre, 500 caractères maximum |
| 7 | Ticket | Lien HTTPS vers le justificatif dans Drive |
| 8 | Ajouté le | Horodatage ISO de création de la ligne |
| 9 | Modifié le | Horodatage ISO de la dernière modification (vide si jamais modifié) |
| 10 | Économies | Total des remises/promos du ticket en euros |
| 11 | Articles (JSON) | Détail structuré : `items[]`, TVA totale, économies, TVA héritée éventuelle |

- Une feuille V1 conserve physiquement sa colonne `TVA` (masquée) ; elle n'est plus écrite par l'application. La TVA est désormais portée par chaque article et/ou par le total calculé du ticket.
- Chaque article contient : libellé, catégorie, rayon (`section`), quantité, unité (`kg`, `g`, `l`, `ml`), prix unitaire, montant, TVA, taux de TVA, économie, indicateur « en avant » et type (`item` ou `discount`).
- Limite de stockage : 50 000 caractères par cellule Google Sheets, ce qui permet d'encoder le détail complet d'environ 150 articles par ticket.
- Mise en forme créée automatiquement :
  - en-tête sur fond sombre, texte blanc, gras, aligné verticalement au milieu ;
  - largeurs de colonnes prédéfinies ;
  - dates au format `dd/mm/yyyy` ;
  - montants, TVA et économies au format monétaire `#,##0.00 "€"` ;
  - colonnes « Ajouté le » et « Modifié le » au format `dd/mm/yyyy hh:mm`.
- La mise en forme est **best effort** : une erreur de formatage n'empêche pas l'utilisation.
- Le classeur est déplacé dans le dossier `Tickets de caisse — Caissette` après création (best effort également).
- Si le classeur existe déjà, il est retrouvé via l'API Drive, sans stockage d'identifiant côté serveur.

### 6.2 Dossier Drive

- **Nom** : `Tickets de caisse — Caissette`
- Contient les justificatifs originaux, le fichier de paramètres et le profil de l'utilisateur.
- Nom d'archive d'un ticket :
  `AAAA-MM-JJ_magasin_xxxxx.extension`
  - magasin nettoyé (accents retirés, caractères non alphanumériques remplacés) ;
  - `xxxxx` = 5 caractères aléatoires ;
  - extension déduite du nom ou du type MIME (`pdf`, `jpg`, `png`, `webp`, `gif`, `tiff`, `avif`, `heic`).

### 6.3 Fichiers de paramètres et de profil

#### Paramètres (`parametres-caissette.json`)

- **Emplacement** : dossier Drive `Tickets de caisse — Caissette`
- **Contenu normalisé** :
  - `monthlyBudget` : nombre positif ou `null` (arrondi à 2 décimales, plafonné à 10 000 000) ;
  - `defaultCategory` : catégorie valide ;
  - `driveImportEnabled` : booléen ;
  - `gmailEnabled` : **toujours `false`** (forcé) ;
  - `updatedAt` : date ISO de dernière écriture.
- Valeurs par défaut : pas de budget, catégorie `Alimentation`, import Drive activé, Gmail désactivé.

#### Profil (`profil-caissette-<empreinte>.json`)

- Un fichier par compte Google, dans le même dossier privé.
- Le nom utilise l'empreinte SHA-256 tronquée du `sub` Google : ni e-mail, ni mot de passe, ni jeton.
- Contenu : `sub`, `email`, `displayName` modifiable, `googleName`, `picture`, `createdAt`, `updatedAt`, `lastSeenAt`.
- Le profil est relu à chaque chargement ; s'il manque, il est créé automatiquement.
- Il est lié au compte Google : un autre compte ne peut pas lire le fichier (même Drive partagé, nom différent et portée `drive.file`).

### 6.4 Session

- Cookie `caissette_session`, chiffré par `iron-session`.
- Durée de vie : **30 jours**.
- Options : `httpOnly`, `sameSite=lax`, `secure` automatiquement si `APP_URL` commence par `https://`.
- Contenu : profil Google minimal (`sub`, `email`, `name`, `picture`) et **refresh token Google**.
- Aucune base de données : le refresh token n'existe que dans ce cookie chiffré.

### 6.5 Ce qui n'est pas stocké

- Aucun fichier de ticket sur le serveur.
- Aucune ligne de dépense en base.
- Aucun identifiant de feuille ou de dossier en base.
- Aucun journal persistant des actions utilisateur.

---

## 7. Fonctionnalités détaillées

### 7.1 Connexion et comptes Google

- Page d'accueil avec bouton **Continuer avec Google** si la configuration est complète.
- Si `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET` manque : message de configuration requise et connexion désactivée.
- Flux OAuth :
  - `access_type=offline`, `prompt=consent` pour obtenir un refresh token durable ;
  - paramètre `state` aléatoire (UUID) stocké dans un cookie `httpOnly` `caissette_oauth_state` valable **10 minutes** ;
  - vérification stricte du `state` au retour ;
  - récupération du profil via l'API Google `oauth2.userinfo`.
- Portées demandées :
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/drive.file`
- Restriction facultative par `ALLOWED_EMAILS` :
  - liste d'adresses séparées par des virgules ;
  - comparaison insensible à la casse ;
  - liste vide = tout compte Google autorisé.
- Redirection après succès vers `/app`.
- Déjà connecté : la page d'accueil redirige automatiquement vers `/app`.
- Déconnexion : destruction de la session et retour à l'accueil (`/api/auth/logout`).

### 7.2 Création automatique de l'espace de travail

Au premier accès authentifié, ou après suppression des fichiers par l'utilisateur :

1. Recherche (ou création) du dossier `Tickets de caisse — Caissette`.
2. Recherche (ou création) du classeur `Dépenses — Caissette`.
3. Création de l'onglet `Dépenses`, de l'en-tête et de la mise en forme.
4. Déplacement du classeur dans le dossier.
5. Création du profil `profil-caissette-<empreinte>.json`.
6. Au premier lancement de la V2, ajout non destructif des colonnes `Modifié le`, `Économies` et `Articles`, puis masquage de l'ancienne colonne `TVA`.

L'opération est idempotente : les fichiers existants sont réutilisés, les colonnes déjà présentes ne sont pas dupliquées.

### 7.3 Ajout d'un ticket — quatre méthodes

#### A. Prendre une photo

- Champ fichier dédié avec `capture="environment"` : sur téléphone, ouverture directe de l'appareil photo arrière.
- Accepte `image/*`.

#### B. Choisir un fichier

- Sélecteur acceptant `application/pdf` et `image/*`.
- Formats effectivement reconnus : PDF, JPG/JPEG, PNG, WebP, GIF, TIFF, AVIF, HEIC/HEIF.
- Taille maximale : **15 Mo**.

#### C. Glisser-déposer

- Sur ordinateur, dépôt d'un fichier dans la zone dédiée.
- Mise en évidence visuelle pendant le survol.

#### D. Import depuis Google Drive

- Voir la section 7.15.

#### E. Saisie manuelle

- Bouton **Ajouter** dans la liste : formulaire vierge pré-rempli avec la date du jour, la catégorie par défaut et « Carte bancaire ».

### 7.4 Compression et envoi des photos

- Compression **dans le navigateur** avant envoi, uniquement pour JPEG, PNG et WebP.
- Dimension maximale du plus grand côté : **2 200 px**.
- Ré-encodage JPEG qualité **0,88**.
- Si l'image est déjà sous 2 200 px et sous 2,5 Mo, elle est envoyée telle quelle.
- Si le fichier compressé est plus lourd que l'original, l'original est conservé.
- Les formats non décodables par le navigateur (HEIC, par exemple) sont envoyés sans transformation.
- Objectif : accélérer l'envoi et l'OCR sur connexion mobile.
- Validation côté client : fichier non vide, taille ≤ 15 Mo, format supporté.
- Validation côté serveur identique, avec messages d'erreur explicites.
- Interface d'attente en deux phases : « Envoi du ticket… » puis « Lecture du ticket… » après 1,4 s.

### 7.5 Extraction du texte

#### PDF textuels

- Extraction via `unpdf`, pages fusionnées.
- Si le texte exploitable contient moins de **40 caractères non blancs**, le PDF est considéré comme scanné : erreur `scanned_pdf` invitant à envoyer une photo ou à saisir la dépense manuellement.
- Aucun OCR n'est effectué sur un PDF scanné.

#### Photos et images

1. **Prétraitement `sharp`** :
   - rotation selon l'EXIF ;
   - conversion en niveaux de gris ;
   - normalisation du contraste ;
   - redimensionnement à 1 600 px de large si l'image est plus petite, à 3 000 px si elle est plus grande (kernel Lanczos 3) ;
   - netteté (`sigma 0.8`) ;
   - export PNG.
2. **OCR Tesseract.js** :
   - langue `fra` ;
   - moteur LSTM uniquement ;
   - mode de segmentation `SINGLE_BLOCK` (plus fiable sur les tickets) ;
   - espaces inter-mots préservés ;
   - DPI déclaré : 300.
- Modèle OCR téléchargé au premier usage puis mis en cache :
  - dossier `OCR_CACHE_DIR` s'il est défini ;
  - sinon dossier temporaire système `caissette-tesseract`.
- Un seul worker Tesseract est réutilisé ; les requêtes sont **mises en file d'attente** pour éviter les accès concurrents.
- Si le texte OCR contient moins de **10 caractères non blancs**, erreur `ocr_empty`.
- En cas d'échec réseau lors du premier téléchargement du modèle, message dédié (503) expliquant que la connexion Internet est nécessaire au premier ticket.

### 7.6 Analyse heuristique du ticket

Le module `parse-receipt.ts` transforme le texte brut en champs structurés. Il est volontairement heuristique et prévu pour des tickets français.

#### Normalisation

- Suppression des accents ;
- passage en majuscules ;
- remplacement des espaces insécables ;
- découpage des lignes trop longues (> 60 caractères), notamment les PDF renvoyant tout le ticket sur une seule ligne, avec recoupement autour de mots-clés : `TOTAL`, `SOUS-TOTAL`, `TVA`, `DONT TVA`, `DATE`, `HEURE`, `CARTE`, `ESPECES`, `CB`, `MERCI`, `RENDU`, `MONNAIE`, `SIRET`, `TEL`.

#### Date

Formats reconnus :

- `2026-11-20`, `2026/11/20`, `2026.11.20` ;
- `20/11/2026`, `20.11.26`, `20-11-2026`, avec année sur 2 ou 4 chiffres ;
- `20 NOVEMBRE 2026` (mois français en toutes lettres).

Système de score :

- bonus +4 si la ligne contient `DATE` ;
- format ISO : +3 ;
- format numérique jour/mois/année : +2 ;
- mois en lettres : +3 ;
- priorité au meilleur score, puis à la première occurrence ;
- les dates futures sont écartées si au moins une date passée existe ;
- si aucune date n'est trouvée : date du jour proposée et avertissement.

#### Montant total

- Recherche sur les lignes contenant un mot-clé de total :
  - `NET A PAYER` : score 5 ;
  - `TOTAL TTC`, `TOTAL A PAYER`, `A PAYER` : score 4 ;
  - `MONTANT TOTAL`, `TOTAL EUR`, `TOTAL EURO` : score 3 ;
  - `TOTAL` : score 2 ;
  - `MONTANT` : score 1.
- Lignes exclues : TVA, HT, sous-total, articles, remise, réduction, économie, fidélité, dont, carte, espèces, rendu, monnaie, chèque, solde, ancien, avant, points, nombre.
- Le montant retenu est généralement le **dernier nombre** de la ligne.
- Priorité au meilleur score, puis à la ligne la plus basse du ticket.
- Si aucun candidat : le plus gros montant du ticket est proposé, avec avertissement « montant estimé ».
- Le total est considéré « certain » si son score est au moins 2.

#### TVA (correctif V2)

Le taux et le montant sont désormais lus séparément, ce qui corrige la confusion historique entre « TVA 20,00 » (taux) et « 20,00 € » (montant).

1. **Total explicite** : ligne contenant `TOTAL TVA`, `DONT TVA`, `MONTANT TVA`, `TAXE TVA`, `TVA TOTALE`, `TVA INCLUSE`, etc. Le dernier montant valide de la ligne est retenu.
2. **Ligne avec taux et montant** : `TVA 20,00% 7,03`, `TVA 5,50 % 0,52`. Le taux est retiré avant l'extraction du montant.
3. **Taux sans symbole** : `TVA 20,00 7,03` → taux 20, montant 7,03.
4. **Taux seul** : `TVA 20,00` → taux 20, montant recalculé `total × 20 / 120` (7,03 pour 42,18 €).
5. **Tableau multi-taux** : dernier bloc de lignes TVA du bas de ticket, addition des montants (`5,50 % + 20 %`).
6. **Dernière ligne valide** en repli.

Contrôles de cohérence :

- TVA strictement positive, inférieure au total TTC et à 50 000 ;
- taux implicite plausible entre 0,5 % et 30 % ;
- taux courants (5, 5,5, 10, 20) traités comme des taux, pas comme des montants ;
- si un taux seul est présent mais que le total est inconnu, **aucune TVA** n'est proposée ;
- si un bloc de TVA est incohérent, aucune TVA partielle n'est proposée.

#### Détail des articles

- Chaque ligne du ticket contenant un montant final est analysée.
- **Lignes multi-lignes** : un libellé seul (`BAGUETTE LA CROUSTILLANTE`, `BEURRE DOUX…`, `FENOUIL`) est conservé puis complété par la ligne suivante (`2 x 0,85 €`, `4 x 2,45 €`, `0,862 kg x 2,45 €/kg`). Cela évite les faux articles « x € » ou « kg x €/kg ».
- Quantités reconnues : `2 x PAIN 1,20 2,40`, `QTE 2 …`, `3 PIÈCES …` ; les conditionnements `6X1L`, `12X60G`, `2X75G` ne sont pas pris pour des quantités achetées.
- **Produits pesés** : `0,862 kg x 2,45 €/kg 2,11 €` → quantité 0,862, unité `kg`, prix unitaire 2,45 €, montant 2,11 €.
- Prix unitaire = montant / quantité, ou premier montant quand `prix × quantité ≈ total`.
- **Rayons** : les en-têtes `>>>> FRUITS ET LEGUMES`, `BVP`, `EPICERIE`, `BEAUTE SANTE`, `CREMERIE`, `CHARC.TRAIT…` sont mappés vers un libellé lisible et une catégorie, puis conservés dans `section` pour l'affichage groupé.
- **Codes TVA** : les codes 11 et 13 en fin de ligne (Magasin U) sont convertis en 5,5 % et 20 % **seulement si le ticket contient le tableau de TVA correspondant** (`11 / 5,50 …`). Sans ce tableau, les codes sont retirés du libellé mais aucun taux n'est inventé.
- La ligne de total, les lignes de TVA, de paiement, d'adresse, de téléphone et d'en-tête sont exclues.
- **Blocs de fidélité** : après `VOS AVANTAGES`, `VOS POINTS FIDELITE`, `VOTRE SOLDE`, `CAGNOTTE`, `VOS € CARTE U GAGNES`…, les points gagnés, l'ancien solde et le nouveau solde sont ignorés et ne deviennent ni articles ni remises. Un nouveau bloc de paiement réactive la lecture.
- **En-têtes de rayon génériques** : `>>>>`, `*** RAYON ***`, `--- RAYON ---` et `RAYON : …` sont reconnus, pas seulement le format U.
- Si l'OCR déforme le mot `TOTAL` (ex. `Torai ic`), la ligne retenue pour le total est écartée du détail.
- **Catégorie de l'article** : rayon du ticket en priorité, puis mots-clés du libellé, puis catégorie du ticket, puis catégorie par défaut.
- **Mise en avant** : police grasse détectée dans le PDF (`fontFamily`), nom de police OCR quand Tesseract le fournit, et lignes nettement plus hautes que la médiane. L'utilisateur peut cocher/décocher « en avant ».
- **Remises** : lignes `REMISE`, `RÉDUCTION`, `COUPON`, `AVANTAGE`, `SOLDE`, montants négatifs et prix barrés (`PROMO 5,00 4,00`) sont enregistrés comme lignes de type `discount` et cumulés dans `Économies`.
- **Remise globale** : `VOUS AVEZ ÉCONOMISÉ 3,20`, `TOTAL REDUCTIONS`, `TOTAL ÉCONOMIES`, `DONT REMISE` est conservée comme remise de ticket, sans double comptage avec les lignes détaillées.
- Un avertissement signale un écart entre la somme des articles et le total.
- Limite : 150 articles analysés par ticket, 90 caractères par libellé.

#### Magasin

1. Recherche d'une enseigne connue dans les **12 premières lignes** :
   - test de deux lignes consécutives pour reconnaître une enseigne coupée (`CARREFOUR` puis `MARKET`) ;
   - certaines marques ambiguës ne sont cherchées que dans les 5 premières lignes et sur une ligne courte, sans montant ni plus de 3 mots (`CASINO`, `METRO`, `SPAR`, `MATCH`, `ACTION`, `UBER`, `PAUL`, `ORANGE`, etc.).
2. Enseignes reconnues, par catégorie :
   - **Alimentation** : Carrefour et ses variantes, E.Leclerc, Lidl, Aldi, Auchan, Intermarché, Système U (Super U, Hyper U, U Express), Monoprix, Casino, Franprix, Picard, Biocoop/Naturalia, Grand Frais, Metro, Costco, Cora, Maximarché, Netto, Spar, Vival, Match.
   - **Restaurants** : McDonald's, Burger King, KFC, Subway, Domino's Pizza, Pizza Hut, Starbucks, Uber Eats, Deliveroo, Paul, Brioche Dorée.
   - **Transport** : Uber, Bolt, BlaBlaCar, SNCF/Ouigo/TGV, RATP/Navigo.
   - **Carburant** : TotalEnergies, Esso, Shell, Avia.
   - **Santé** : Pharmacie, Opticien/Optical 2000.
   - **Shopping** : Amazon, Fnac, Darty, Ikea, Leroy Merlin, Castorama, Brico Dépôt, Decathlon, Action, Gifi, Kiabi, Zara, H&M, Cultura, Sephora, Galeries Lafayette.
   - **Abonnements** : Netflix, Spotify, Disney+, Canal+, Prime Video.
   - **Loisirs** : Steam.
   - **Logement** : EDF, Engie, Orange, SFR, Bouygues Telecom, Free.
3. Si aucune enseigne connue : nettoyage des lignes candidates :
   - suppression des mentions de ticket, reçu, caisse, SIRET, téléphone, site web, e-mail, date, total, paiement, etc. ;
   - rejet des adresses (rue, avenue, boulevard, centre commercial, etc.) ;
   - rejet des lignes trop numériques, des téléphones et des montants ;
   - suppression des suffixes juridiques (`SARL`, `SAS`, `EURL`, `SCI`, `SNC`, `RCS`, `SIRET`, `SIREN`, `APE`, `NAF`) et des numéros de fin de ligne ;
   - passage en casse de titre si la ligne est entièrement en majuscules.
4. Score des candidats :
   - position haute dans le ticket ;
   - bonus pour la première ligne ;
   - bonus si entièrement en majuscules ;
   - bonus si longueur ≥ 6 ;
   - bonus si plusieurs mots ;
   - malus si présence de chiffres.
5. Si rien ne convient : champ vide et avertissement « Nom du magasin non détecté ».

#### Catégorie

Ordre de priorité :

1. **Carburant** si le texte contient `GASOIL`, `ESSENCE`, `SP95`, `SP98`, `E10`, `E85`, `GPL`, `CARBURANT` (priorité sur la marque, par exemple une station-service Carrefour).
2. Catégorie associée à une enseigne connue.
3. Mots-clés par catégorie, dans cet ordre :
   - Carburant ;
   - Abonnements (`ABONNEMENT`, `FORFAIT`, `NETFLIX`, `SPOTIFY`, `DISNEY`, `CANAL`, `PRIME VIDEO`) ;
   - Transport (`SNCF`, `RATP`, `TGV`, `OUIGO`, `TER`, `BUS`, `METRO`, `TRAM`, `PEAGE`, `AUTOROUTE`, `PARKING`, `NAVIGO`, `BILLET`) ;
   - Restaurants (`RESTAURANT`, `BRASSERIE`, `BISTRO`, `SNACK`, `PIZZERIA`, `SUSHI`, `TACOS`, `CAFE`, `BOULANGERIE`) ;
   - Alimentation (`SUPERMARCHE`, `SUPERETTE`, `EPICERIE`, `MARCHE`, `ALIMENTATION`, `BOUCHERIE`, `PRIMEUR`, `FROMAGERIE`, `PATISSERIE`) ;
   - Santé (`PHARMACIE`, `MEDECIN`, `DENTISTE`, `CLINIQUE`, `HOPITAL`, `OPTICIEN`, `LABORATOIRE`, `MUTUELLE`) ;
   - Logement (`LOYER`, `ELECTRICITE`, `GAZ`, `EAU`, `INTERNET`, `ASSURANCE HABITATION`, `CHAUFFAGE`) ;
   - Loisirs (`CINEMA`, `UGC`, `PATHE`, `GAUMONT`, `MUSEE`, `THEATRE`, `FITNESS`, `PISCINE`, `LOISIR`, `JEUX`) ;
   - Shopping (`VETEMENT`, `CHAUSSURES`, `MEUBLE`, `BRICOLAGE`, `JOUET`, `LIBRAIRIE`).
4. Sinon : `Divers`.

#### Moyen de paiement

- `CARTE BANCAIRE`, `PAIEMENT CARTE`, `CARTE CB`, `CB`, `VISA`, `MASTERCARD`, `CONTACTLESS`, `SANS CONTACT` → **Carte bancaire**.
- `ESPECES`, `LIQUIDE`, `CASH` → **Espèces**.
- `CHEQUE` → **Chèque**.
- `VIREMENT` → **Virement**.
- Par défaut : **Carte bancaire**.

#### Avertissements affichés

- Texte du ticket trop court (< 80 caractères normalisés) : lisibilité douteuse.
- Date non détectée.
- Nom du magasin non détecté.
- Montant total non détecté.
- Montant estimé, total non identifié avec certitude.
- Détail des articles non lu.
- Écart entre la somme des articles et le total du ticket.
- Échec d'archivage du ticket dans Google Drive (message Google traduit).
- Le texte brut lu (4 000 caractères maximum) est conservé pour consultation.

### 7.7 Fenêtre de vérification du ticket

- Ouverture automatique après extraction.
- Champs pré-remplis : date, montant, magasin, catégorie, moyen de paiement, note.
- **Détail des articles** :
  - liste éditable (libellé, quantité, prix unitaire, montant, catégorie, « en avant ») ;
  - regroupement par rayon du ticket (`Fruits et Légumes`, `BVP`, `Beauté & Santé`, `Réductions`…) ;
  - quantités décimales pour les produits pesés (`0,862 kg × 2,45 €/kg`) ;
  - bouton **Article** et bouton **Remise** ;
  - total des articles, économies et TVA ;
  - contrôle de cohérence avec le total du ticket (écart signalé en ambre) ;
  - les libellés en gras sur le ticket sont affichés en gras et le bouton `B` est actif.
- La TVA n'est plus un champ global : elle est calculée à partir des articles (ou reprise du ticket) et affichée en lecture seule.
- Lien **Voir le ticket original** si le justificatif a été archivé.
- Bandeau vert « Ticket lu automatiquement » si aucune incertitude.
- Bandeau jaune « À vérifier » listant les avertissements.
- Section repliable **Texte lu sur le ticket** montrant le texte OCR/PDF brut.
- Validation :
  - date obligatoire ;
  - magasin obligatoire (120 caractères maximum) ;
  - montant strictement positif, arrondi à 2 décimales ;
  - catégorie choisie dans la liste ;
  - moyen de paiement dans la liste (ou valeur existante conservée) ;
  - note limitée à 500 caractères ;
  - articles : libellé obligatoire, montant positif, quantité entre 0,001 et 999 (poids accepté), section et unité facultatives, 150 articles maximum.
- Bouton d'enregistrement avec état de chargement, bouton Annuler, fermeture par `Échap`, clic sur le fond ou croix.
- En mode modification, les mêmes champs sont éditables ; le lien du ticket, la date d'ajout et les articles non modifiés sont conservés.

### 7.8 Archivage du justificatif

- Effectué côté serveur pendant `/api/extract`, **best effort**.
- Le fichier original est envoyé dans le dossier `Tickets de caisse — Caissette`.
- Nom nettoyé et horodaté par la date du ticket, le magasin et un suffixe aléatoire.
- URL retournée : `webViewLink` Google Drive, ou lien direct `https://drive.google.com/file/d/ID/view`.
- En cas d'échec, l'extraction reste utilisable : seule une URL vide est enregistrée et un avertissement est ajouté.

### 7.9 Ajout, modification et suppression de dépenses

- **Ajout** : `POST /api/expenses`, insertion en fin de feuille avec `INSERT_ROWS`, date d'ajout serveur. Le détail des articles et les économies sont enregistrés dans la même ligne.
- **Modification** : `PATCH /api/expenses/{ligne}`, **mise à jour partielle** :
  - seuls les champs envoyés sont réécrits ;
  - la date d'ajout, la TVA héritée et les articles non modifiés sont préservés ;
  - `Modifié le` est mis à jour ;
  - une **empreinte** (date, magasin, montant, date d'ajout) et `Modifié le` détectent les modifications concurrentes ou un décalage de lignes ;
  - en cas de conflit, l'API répond `409` avec la version courante ; l'interface propose **Recharger** ou **Garder mes modifications** (réécriture forcée).
- **Suppression** : `DELETE /api/expenses/{ligne}`, suppression physique de la ligne dans l'onglet.
- Numéros de ligne acceptés : entiers de **2 à 100 000** (la ligne 1 est l'en-tête).
- Confirmation obligatoire avant suppression, avec rappel que le justificatif original reste dans Drive.
- Toast de succès et rafraîchissement des données après chaque opération.
- Si l'enregistrement réussit mais que le rafraîchissement échoue, un toast spécifique le signale.

### 7.10 Liste des tickets (tableau)

- Affichage des dépenses du mois sélectionné (« Tous les mois » possible).
- Tri par date décroissante par défaut, avec choix : plus anciens, montant croissant/décroissant, plus d'économies.
- Recherche libre insensible à la casse sur :
  - magasin ;
  - catégorie ;
  - moyen de paiement ;
  - note ;
  - date ;
  - montant et économies formatés ;
  - **libellés des articles**.
- Filtres avancés (panneau repliable) :
  - catégorie ;
  - **moyen de paiement** ;
  - **magasin** (liste des magasins connus + saisie libre) ;
  - **prix minimum / maximum** ;
  - **tickets avec économies uniquement** ;
  - tri ;
  - bouton **Réinitialiser** et compteur de filtres actifs.
- Compteur de dépenses affichées, total des économies filtrées.
- Total des lignes filtrées en pied de tableau, avec badge d'économies.
- Badges par ligne : catégorie, nombre d'articles, économies, trombone du justificatif.
- **Desktop** : tableau avec colonnes Date, Magasin, Catégorie, Paiement, Montant, Actions.
- **Mobile** : cartes avec magasin, date, catégorie, nombre d'articles, économies, note éventuelle, montant, moyen de paiement et boutons Ticket / Modifier / Supprimer.
- Icône trombone pour ouvrir le justificatif.
- État vide contextuel :
  - aucun ticket pour ce mois ;
  - aucun résultat pour les filtres, avec bouton **Effacer les filtres** ;
  - bouton d'ajout manuel.
- Bouton **Ajouter** toujours accessible dans l'en-tête de la liste.

### 7.11 Navigation par mois et période

- Mois courant sélectionné par défaut.
- Bouton mois précédent.
- Bouton mois suivant, désactivé au-delà du mois courant.
- Bouton **Mois en cours** visible si un autre mois est sélectionné.
- Bouton **Tous les mois** pour désactiver le filtre temporel.
- Le libellé du mois est affiché en français et en majuscule initiale.
- La saisie d'un ticket bascule automatiquement l'affichage sur le mois de sa date.

### 7.12 Tableau de bord

- Salutation personnalisée avec le prénom du profil (modifiable dans les paramètres).
- Lien direct vers le guide **Comment ça marche ?**.
- Bandeau d'accueil si aucune dépense :
  - « Bienvenue » ;
  - promesse en une phrase ;
  - bouton d'ajout du premier ticket ;
  - lien vers le guide ;
  - trois étapes illustrées : photographier, vérifier, ranger.
- Cinq indicateurs pour la période :
  - **Total** et nombre de tickets ;
  - **Dépense moyenne** par ticket ;
  - **Nombre de tickets** et total cumulé ;
  - **Top catégorie** et part du total en pourcentage ;
  - **Promos / économies** : montant cumulé, pourcentage du total et nombre de tickets avec remise.
- Carte **Promos & économies** dans la colonne latérale : montant, taux, nombre de tickets avec remise, barre de progression.
- Carte **Budget** (si un budget est défini et si un mois précis est affiché) :
  - dépensé / budget ;
  - barre de progression ;
  - couleur verte, ambre à partir de 80 %, rouge à partir de 100 % ;
  - reste à dépenser ou montant du dépassement ;
  - lien vers les paramètres.
- Carte d'invitation à définir un budget si aucun budget n'existe.
- **Répartition par catégorie** :
  - montants triés décroissants ;
  - pourcentage du total ;
  - barre proportionnelle à la catégorie la plus élevée ;
  - total de la période.
- Carte de conseils de scan : ticket à plat, cadrage complet, éviter reflets et plis.
- Rappel que la feuille et les justificatifs restent dans Google Drive.
- Pied de page : « OCR local · aucune donnée revendue ».
- Gestion des erreurs de chargement avec bouton **Se reconnecter**.

### 7.13 Statistiques

Page annuelle avec sélecteur d'année (année courante par défaut, pas d'année future).

- **Indicateurs** :
  - total de l'année et nombre de tickets ;
  - moyenne mensuelle (divisée par le nombre de mois écoulés pour l'année en cours, par 12 pour une année passée) ;
  - plus grosse dépense et magasin associé ;
  - **promos / économies** : total, taux et nombre de tickets avec remise ;
  - magasin favori, total et nombre de tickets.
- **Évolution mensuelle** :
  - 12 barres, de janvier à décembre ;
  - mois courant mis en évidence ;
  - valeur visible au survol ;
  - équivalent textuel pour lecteurs d'écran.
- **Répartition par catégorie** :
  - graphique en anneau construit en `conic-gradient` ;
  - total au centre ;
  - légende des 6 premières catégories ;
  - couleurs dédiées par catégorie.
- **Moyens de paiement** :
  - montant et part de chaque moyen ;
  - barre de progression accessible (`role="progressbar"`) ;
  - icônes selon le moyen.
- **Jours de la semaine** :
  - dépenses du lundi au dimanche ;
  - barres relatives au jour le plus dépensier ;
  - équivalent textuel pour lecteurs d'écran.
- **Promos & économies globales** :
  - total annuel et part des dépenses ;
  - 12 barres d'économies mensuelles ;
  - classement des magasins qui font le plus économiser ;
  - état vide expliquant comment ajouter une remise.
- **Budget du mois en cours** :
  - montant dépensé / budget ;
  - barre colorée selon le seuil ;
  - reste ou dépassement ;
  - lien pour définir un budget si absent.
- **Évolution vs mois précédent** :
  - compare le dernier mois renseigné de l'année avec le mois précédent ;
  - pourcentage d'augmentation ou de diminution ;
  - icône et couleur adaptées ;
  - message si aucun mois précédent comparable.
- **Top magasins** : 6 commerces les plus dépensiers, avec montant et barre relative.
- **Top catégorie** : nom, pourcentage du total, montant, barre.
- État vide dédié si aucune dépense pour l'année.

### 7.14 Paramètres

- **Mon profil** :
  - avatar Google (ou initiales) ;
  - nom affiché modifiable (2 à 60 caractères) ;
  - e-mail et date de création du profil ;
  - bouton **Enregistrer** dédié ;
  - stockage dans `profil-caissette-<empreinte>.json` dans le dossier Drive privé ;
  - explication sur l'empreinte du compte Google et l'absence d'e-mail dans le nom de fichier.
- **Budget mensuel** :
  - champ texte acceptant virgule ou point ;
  - vide = pas de budget ;
  - validation : nombre strictement positif ;
  - arrondi à 2 décimales.
- **Catégorie par défaut** : proposée lors d'un ajout manuel.
- **Import Google Drive** : interrupteur d'activation/désactivation du bouton d'import sur le tableau de bord.
- **Gmail** : affiché « Non activé », interrupteur désactivé, explication : autorisation restreinte par Google, vérification obligatoire, avertissement de sécurité, donc volontairement exclu.
- **Vos données** :
  - bouton **Ouvrir le Google Sheet** ;
  - bouton **Ouvrir le dossier des tickets** ;
  - rappel qu'aucune donnée n'est stockée sur le serveur.
- **Compte** :
  - avatar ou initiales du profil ;
  - nom affiché (modifiable dans « Mon profil ») ;
  - adresse e-mail ;
  - badge « Compte Google connecté » ;
  - bouton de déconnexion.
- **Aide** : lien vers le guide intégré.
- **Confidentialité** : lien vers la politique de confidentialité.
- **Gestion des modifications non enregistrées** :
  - détection des changements ;
  - indicateur « Modifications non enregistrées » ;
  - avertissement natif du navigateur en cas de fermeture ;
  - bouton d'enregistrement désactivé si rien n'a changé ou en cas d'erreur de chargement ;
  - barre d'enregistrement collante sur mobile ;
  - toast de succès et mise à jour immédiate du contexte.

### 7.15 Import depuis Google Drive

- Bouton visible uniquement si `driveImportEnabled` est activé.
- Utilise **Google Picker** :
  - chargement de `https://apis.google.com/js/api.js` puis du module `picker` ;
  - jeton d'accès Google obtenu via `/api/google-token` ;
  - clé API navigateur via `/api/drive/config` ;
  - identifiant d'application via `GOOGLE_PROJECT_NUMBER` (valeur de repli intégrée : `93860449537`).
- Filtres du sélecteur : PDF, JPEG, PNG, WebP ; dossiers exclus.
- Sélection multiple activée.
- Maximum **5 fichiers** par sélection :
  - si l'utilisateur en choisit davantage, seuls les 5 premiers sont importés et un toast le prévient.
- Import **séquentiel** avec progression « Lecture 2/5… ».
- Chaque fichier est lu via `/api/drive/import` :
  - métadonnées Drive ;
  - contrôle du type et de la taille (15 Mo maximum) ;
  - lecture du contenu ;
  - PDF texte ou OCR ;
  - analyse heuristique ;
  - URL du fichier Drive.
- Les fichiers en échec déclenchent un toast individuel ; les réussites ouvrent la fenêtre d'import groupé.
- **Fenêtre d'import groupé** :
  - une carte par ticket avec nom de fichier et lien d'ouverture ;
  - case à cocher par ticket ; les tickets sans magasin ou sans montant sont décochés par défaut ;
  - champs modifiables : date, magasin, montant, catégorie ;
  - TVA, moyen de paiement et URL de justificatif conservés depuis l'extraction ;
  - avertissements par ticket ;
  - bouton Tout sélectionner / Tout décocher ;
  - compteur de tickets sélectionnés et total ;
  - validation des champs avant envoi ;
  - import via `POST /api/expenses/bulk` ;
  - maximum serveur : **20 lignes par requête** (l'interface en envoie au plus 5) ;
  - rafraîchissement du tableau après import.
- Si la clé `GOOGLE_PICKER_API_KEY` manque : message explicite, le reste de l'application continue de fonctionner.

### 7.16 Actualisation des données

- Chargement initial côté serveur au rendu de l'espace `/app`.
- Rafraîchissement côté client :
  - retour sur l'onglet / focus de la fenêtre ;
  - changement de visibilité vers « visible » ;
  - toutes les **2 minutes** tant que l'onglet est visible.
- Limitation à un rafraîchissement toutes les **15 secondes**.
- Un seul appel simultané grâce à une promesse partagée.
- Objectif : refléter les modifications faites directement dans le Google Sheet.
- Après ajout, modification, suppression ou import : rafraîchissement immédiat.

### 7.17 Guide intégré (`/app/aide`)

- Introduction et boutons d'action.
- Démarrage en 3 étapes.
- Les 4 façons d'ajouter un ticket : photo, fichier, Drive, saisie manuelle.
- Définitions des chiffres :
  - Total ;
  - Ticket moyen ;
  - Top catégorie ;
  - Budget mensuel ;
  - Statistiques.
- Où sont les données : Google Sheet et dossier Drive.
- Installation sur téléphone :
  - Android/Chrome : menu puis « Ajouter à l'écran d'accueil » ;
  - iPhone/Safari : Partager puis « Sur l'écran d'accueil ».
- FAQ :
  - gratuité ;
  - absence de compte ou d'installation ;
  - usage à plusieurs ;
  - ticket mal lu ;
  - modification/suppression ;
  - emplacement des données ;
  - lenteur du premier chargement ;
  - refus de connexion Google.
- Appel à l'action final.

### 7.18 Page d'accueil publique

- Présentation de la promesse et du fonctionnement.
- Aperçu visuel simulé du tableau de bord.
- Bouton **Continuer avec Google** si la configuration est complète.
- Messages d'erreur OAuth traduits :
  - `config` : configuration incomplète ;
  - `forbidden` : compte non autorisé ;
  - `access_denied` : connexion annulée ;
  - `auth_failed` : échec de connexion ;
  - `invalid_state` : session de connexion expirée ;
  - `missing_code` : connexion incomplète ;
  - `no_refresh_token` : pas d'accès durable accordé ;
  - `profile` : profil Google illisible.
- Sections : comment ça marche, avantages, FAQ.
- Liens : connexion et politique de confidentialité.
- Arguments : gratuit, sans installation, sans carte bancaire, données dans le Drive.

### 7.19 Politique de confidentialité

Page publique `/confidentialite` détaillant :

- public visé ;
- données traitées ;
- stockage dans le Drive de l'utilisateur ;
- OCR local sur la machine exécutant l'application ;
- portées Google et absence d'accès sensible ;
- conservation et suppression ;
- absence de partage, de publicité et de suivi ;
- contact de l'administrateur ;
- date de dernière mise à jour.

### 7.20 Expérience mobile et PWA

- Manifeste web :
  - nom complet et nom court ;
  - démarrage sur `/app` ;
  - mode `standalone` ;
  - orientation portrait ;
  - couleurs de thème et de fond ;
  - icônes 192 et 512 px.
- Ajout possible à l'écran d'accueil Android et iOS, sans téléchargement d'application.
- Navigation mobile fixe en bas d'écran avec 4 entrées libellées :
  - Dépenses ;
  - Statistiques ;
  - Paramètres ;
  - Aide.
- Navigation desktop en haut, dans une barre segmentée.
- En-tête collant avec logo, bouton **Ouvrir le Sheet**, avatar, nom, e-mail et déconnexion.
- Zones tactiles d'au moins 44 px sur les actions importantes.
- Gestion de l'encoche iPhone via `env(safe-area-inset-bottom)`.
- Champs à 16 px sur mobile pour éviter le zoom automatique de Safari.

### 7.21 Accessibilité

- Lien d'évitement **Aller au contenu principal**.
- Contour de focus visible et homogène sur tous les éléments interactifs.
- Fenêtres modales :
  - `role="dialog"`, `aria-modal="true"` ;
  - titre et description associés ;
  - piège de focus ;
  - fermeture par `Échap` ;
  - restauration du focus à la fermeture ;
  - blocage du défilement de l'arrière-plan.
- Menus déroulants personnalisés :
  - `role="listbox"` / `role="option"` ;
  - navigation par flèches, Entrée, Espace, Échap ;
  - positionnement adaptatif au-dessus ou en dessous ;
  - repositionnement au défilement et au redimensionnement.
- Tableaux avec `caption` réservé aux lecteurs d'écran.
- Graphiques avec équivalents textuels `sr-only`.
- Barres de progression avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Boutons avec `aria-label` explicite.
- Textes agrandis sur les actions importantes.
- Contraste conforme WCAG AA grâce à un vert assombri.
- Respect de `prefers-reduced-motion`.
- Zoom autorisé jusqu'à 5×.
- `lang="fr"` sur le document.

### 7.22 Retours utilisateur et gestion des erreurs

- Notifications toast (Sonner) en haut au centre :
  - ticket lu ;
  - ticket enregistré ;
  - dépense mise à jour ;
  - dépense supprimée ;
  - import groupé ;
  - paramètres enregistrés ;
  - profil enregistré ;
  - conflit de modification détecté ;
  - erreurs d'import, de lecture, de connexion.
- Messages d'erreur en ligne dans les formulaires et la zone d'upload.
- Traduction des erreurs Google en langage utilisateur :
  - autorisation expirée ou révoquée → se reconnecter ;
  - accès refusé → vérifier l'activation des API Sheets et Drive ;
  - trop de requêtes → réessayer plus tard ;
  - feuille introuvable → se reconnecter pour la recréer ;
  - quota dépassé ;
  - message brut de l'API en dernier recours.
- Page d'erreur globale avec bouton **Réessayer** et lien vers l'accueil.
- Page 404 personnalisée.

---

## 8. API interne

| Méthode | Route | Rôle | Entrée | Réponse / limites |
| --- | --- | --- | --- | --- |
| GET | `/api/auth/login` | Démarrer OAuth Google | — | Redirection Google ; cookie `state` 10 min |
| GET | `/api/auth/callback` | Finaliser OAuth | `code`, `state` | Cookie de session puis redirection `/app` |
| GET | `/api/auth/logout` | Déconnexion | — | Session détruite, redirection `/` |
| POST | `/api/extract` | Lire et archiver un ticket | `multipart/form-data`, champ `file` | Champs extraits + URL Drive ; 15 Mo ; 60 s |
| GET | `/api/workspace` | Recharger toutes les données | — | `expenses`, `settings`, `profile`, `sheetUrl`, `folderId` ; `no-store` |
| POST | `/api/expenses` | Ajouter une dépense | JSON `ExpensePayload` (avec `items`) | `{ ok, row }` |
| PATCH | `/api/expenses/{row}` | Modifier partiellement une dépense | JSON partiel + `expectedUpdatedAt` + `expectedOriginal` + `force` | `{ ok, expense }` ; `409` avec `current` en cas de conflit |
| DELETE | `/api/expenses/{row}` | Supprimer une dépense | — | `{ ok: true }` ; ligne 2–100 000 |
| POST | `/api/expenses/bulk` | Ajouter plusieurs dépenses | `{ expenses: [...] }` | `{ ok, rows }` ; 20 maximum |
| GET | `/api/profile` | Lire le profil | — | `{ profile }` ; `no-store` |
| PATCH | `/api/profile` | Modifier le nom affiché | `{ displayName }` | `{ ok, profile }` |
| PATCH | `/api/settings` | Enregistrer les paramètres | JSON partiel | Paramètres normalisés |
| GET | `/api/google-token` | Fournir un jeton d'accès Google au navigateur | — | `{ accessToken }` ; `no-store` |
| GET | `/api/drive/config` | Fournir la configuration Google Picker | — | `{ apiKey, appId }` ; `no-store` |
| POST | `/api/drive/import` | Lire un fichier Drive | `{ fileId }` | Champs extraits + URL ; 15 Mo ; 60 s |

### 8.1 Codes d'erreur HTTP utilisés

| Code | Signification |
| --- | --- |
| 400 | Données ou fichier invalide |
| 401 | Session absente ou expirée |
| 404 | Ticket introuvable : la ligne a été supprimée ou déplacée |
| 409 | Conflit de modification : le ticket a changé entre-temps (`code: "conflict"`, `current`) |
| 413 | Fichier trop volumineux (> 15 Mo) |
| 415 | Format non pris en charge |
| 422 | Fichier illisible : PDF scanné (`scanned_pdf`) ou OCR vide (`ocr_empty`) |
| 502 | Erreur Google ou fichier Drive inaccessible |
| 503 | Modèle OCR non téléchargeable faute de connexion |

### 8.2 Validation d'une dépense

- `date` : format strict `AAAA-MM-JJ` et date réelle.
- `merchant` : non vide, 120 caractères maximum.
- `category` : parmi les 10 catégories connues.
- `amount` : nombre > 0 et ≤ 1 000 000, arrondi à 2 décimales.
- `items` : tableau facultatif, 150 éléments maximum. Chaque article : `label` non vide (120 caractères), `category` valide, `section`/`unit` facultatifs, `quantity` entre 0,001 et 999 (poids décimal accepté), `amount` > 0, `unitPrice`/`tva`/`tvaRate`/`savings` cohérents, `bold` booléen, `kind` `item` ou `discount`.
- `ticketTva` : facultatif, entre 0 et le montant (TVA globale lue sur le ticket, non éditable).
- `ticketSavings` : facultatif, entre 0 et le montant (remise globale lue sur le ticket).
- `payment` : texte, valeur par défaut « Carte bancaire », 40 caractères maximum.
- `note` : 500 caractères maximum.
- `receiptUrl` : vide ou URL commençant par `https://`.
- En modification, `expectedUpdatedAt` et `expectedOriginal` permettent la détection de conflit ; `force: true` réapplique la saisie.

---

## 9. Sécurité et vie privée

### 9.1 Portées Google

- `openid`, `email`, `profile` : identité.
- `https://www.googleapis.com/auth/drive.file` : accès **uniquement aux fichiers créés ou ouverts par l'application**.
- Aucune portée `spreadsheets` globale : c'est ce qui évite l'écran Google « application non validée » et la limitation à 7 jours des autorisations sensibles.
- L'application ne peut pas voir le reste du Drive, les e-mails, les contacts ou les autres feuilles de calcul.

### 9.2 Session et jetons

- Cookie chiffré, `httpOnly`, `sameSite=lax`, `secure` en HTTPS.
- Refresh token Google uniquement dans ce cookie.
- Jeton d'accès Google gardé en mémoire serveur, jamais exposé sauf au navigateur via `/api/google-token` pour Google Picker (nécessaire au fonctionnement du sélecteur).
- `state` OAuth aléatoire et à usage unique.
- Déconnexion : suppression du cookie.
- Révocation complète possible sur <https://myaccount.google.com/permissions>.

### 9.3 Données

- Feuille, justificatifs et profil dans le Drive de l'utilisateur.
- Aucune base de données.
- Aucun stockage de fichiers côté serveur.
- Aucune revente, publicité ou outil de suivi.
- Journaux serveur limités aux erreurs techniques (`console.error`).
- Le profil est nommé d'après l'empreinte du `sub` Google : ne contient ni e-mail dans son nom, ni jeton, ni mot de passe.
- Chaque compte Google obtient sa propre feuille ; la portée `drive.file` empêche l'application de lire les fichiers d'un autre compte.

### 9.4 En-têtes HTTP de sécurité

- `X-Frame-Options: DENY` (pas d'intégration en iframe).
- `X-Content-Type-Options: nosniff`.
- `X-DNS-Prefetch-Control: on`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- `poweredByHeader: false`.

### 9.5 Contrôle d'accès

- `ALLOWED_EMAILS` : liste blanche d'adresses Google.
- Si la liste est vide, tout compte Google peut se connecter (l'URL doit être connue).
- L'application est privée et n'est pas indexée (`robots: index: false, follow: false`).

---

## 10. Limites et quotas

### 10.1 Fichiers et imports

- Taille maximale par fichier : **15 Mo**.
- Formats : PDF, JPG/JPEG, PNG, WebP, GIF, TIFF, AVIF, HEIC/HEIF.
- Import Drive : **5 fichiers maximum par sélection**.
- Import groupé API : **20 lignes maximum par requête**.
- OCR séquentiel : un seul worker, donc les photos sont traitées les unes après les autres.
- Pas d'OCR sur les PDF scannés.

### 10.2 Google

- Google Sheets : limite d'environ **10 millions de cellules** par classeur, soit environ **1,1 million de lignes** avec 9 colonnes.
- Google Drive gratuit : **15 Go** partagés entre Gmail, Drive et Photos.
- Quotas API Google standard ; erreurs 429 et quotas traduits en messages utilisateur.

### 10.3 Hébergement Render (offre gratuite)

- 512 Mo de RAM.
- 0,1 CPU.
- Mise en veille après **15 minutes** d'inactivité.
- Premier accès après veille : jusqu'à environ une minute.
- 750 heures d'instance par mois.
- 5 Go de bande passante par mois.
- OCR : environ **20 à 60 secondes par photo**, contre quelques secondes en local.
- Workflow GitHub Actions `keep-alive.yml` : ping de `/confidentialite` toutes les 10 minutes pour limiter la mise en veille.

### 10.4 Limites fonctionnelles assumées

- Une feuille et un dossier par compte Google ; pas de budget partagé entre comptes.
- Pas d'import de relevés bancaires.
- Pas de détection automatique de dépenses récurrentes.
- Gmail non activé (autorisation restreinte par Google).
- Détection heuristique : tickets abîmés ou enseignes inconnues → correction manuelle.
- Pas de catégories personnalisées : liste fixe de 10 catégories.
- Pas de multi-devises : tout est en euros.
- Pas de pièces jointes multiples dans un même ticket.
- Pas de mode hors ligne : connexion Internet nécessaire.
- Pas de synchronisation temps réel : rafraîchissement au focus et toutes les 2 minutes.

---

## 11. Exploitation et déploiement

### 11.1 Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Oui | Identifiant OAuth « Application Web » |
| `GOOGLE_CLIENT_SECRET` | Oui | Secret OAuth |
| `SESSION_SECRET` | Oui | Chiffrement du cookie, **32 caractères minimum** |
| `APP_URL` | Oui | URL publique exacte, sans slash final |
| `ALLOWED_EMAILS` | Non | Liste blanche d'adresses séparées par des virgules |
| `GOOGLE_PICKER_API_KEY` | Non | Clé API navigateur pour Google Picker |
| `GOOGLE_PROJECT_NUMBER` | Non | Numéro de projet Google Cloud (repli : `93860449537`) |
| `OCR_CACHE_DIR` | Non | Dossier de cache du modèle Tesseract |
| `NODE_VERSION` | Selon hébergeur | Version Node attendue, `24.20.0` sur Render |

Génération du secret de session :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 11.2 Configuration Google Cloud

1. Créer un projet.
2. Activer **Google Sheets API** et **Google Drive API**.
3. Activer **Google Picker API** pour l'import Drive.
4. Créer des identifiants OAuth de type **Application Web**.
5. Déclarer les URI de redirection :
   - `http://localhost:3000/api/auth/callback` ;
   - `http://localhost:3001/api/auth/callback` si le port 3000 est occupé ;
   - l'URL HTTPS de production.
6. Portées : `openid`, `email`, `profile`, `drive.file`.
7. Créer une clé API navigateur pour Picker et la restreindre à Drive API, Picker API et aux domaines autorisés.

> Le fichier `credentials.json` présent à la racine n'est **pas utilisé**. Un compte de service ne peut pas créer de fichier dans le Drive d'un utilisateur ; il faut des identifiants OAuth « Application Web ». Ce fichier ne doit jamais être partagé ni versionné.

### 11.3 Exécution locale

```bash
npm install
npm run dev
```

- Par défaut : <http://localhost:3000>.
- Port 3001 : `npm run dev -- -p 3001` ou `npm start -- -p 3001`, avec `APP_URL` et l'URI Google adaptés.

### 11.4 Production locale

```bash
npm run build
npm start
```

Démarrage automatique sous Windows possible via le Planificateur de tâches :

- déclencheur « À l'ouverture de session » ;
- programme `C:\Program Files\nodejs\npm.cmd` ;
- arguments `start` ;
- dossier de démarrage : racine du projet.

### 11.5 Render

- `render.yaml` décrit un service web Node, plan gratuit, région Francfort.
- Build : `npm ci && npm run build`.
- Start : `npm start`.
- Health check : `/confidentialite`.
- `autoDeploy: true` dans le fichier ; le README précise qu'un dépôt Git public peut nécessiter un **Manual Deploy → Deploy latest commit**.
- Secrets configurés dans Render → Environment, jamais dans le dépôt.
- Mise à jour : `git push origin master`, puis déploiement.

### 11.6 Accès privé

- **Tailscale** : `tailscale serve --bg 3000`, puis utiliser l'URL HTTPS Tailscale comme `APP_URL` et URI OAuth.
- **Cloudflare Tunnel** : `cloudflared tunnel --url http://localhost:3000`, puis déclarer l'URL HTTPS.
- **Domaine + reverse proxy** : Caddy ou nginx avec certificat HTTPS.
- Dans tous les cas, `APP_URL` doit correspondre **exactement** à l'URI déclarée dans Google Console.

---

## 12. Tests et scripts utilitaires

| Commande | Rôle |
| --- | --- |
| `npm run test:parser` | 23 cas de tickets français : dates, totaux, TVA multi-taux, articles, quantités, remises, économies, gras, enseignes, PDF sur une ligne |
| `npm run test:expenses` | Validation des dépenses : articles, TVA de ticket, économies, patch partiel, empreinte de conflit |
| `npm run test:ticket-u` | Ticket Magasin U complet : 35 articles, poids, rayons, réductions, codes TVA et exclusion des soldes Carte U |
| `npm run test:stores` | Panel multi-enseignes : Carrefour, Lidl, E.Leclerc, restaurant, pharmacie, Amazon, carburant, rayons génériques, fidélité, codes TVA sans tableau |
| `npm run test:pdf` | Construit un PDF minimal, extrait son texte et affiche l'analyse |
| `npm run test:ocr` | Génère une image de ticket, la prétraite, lance Tesseract et affiche le résultat |

Les tests sont des scripts autonomes avec `tsx`, sans framework de test et sans appel à Google. Ils s'arrêtent avec un code non nul en cas d'échec (`test:parser`, `test:expenses`, `test:ticket-u`, `test:stores`) ou terminent le processus (`test:ocr`).

---

## 13. Structure du code

```text
src/
├─ app/
│  ├─ page.tsx                    # accueil public / redirection si connecté
│  ├─ layout.tsx                  # layout racine, toasts, lien d'évitement
│  ├─ manifest.ts                 # manifeste PWA
│  ├─ robots.ts                   # indexation désactivée
│  ├─ error.tsx                   # erreur globale
│  ├─ not-found.tsx               # page 404
│  ├─ confidentialite/page.tsx    # politique de confidentialité
│  ├─ app/
│  │  ├─ layout.tsx               # espace authentifié, chargement serveur
│  │  ├─ page.tsx                 # tableau de bord
│  │  ├─ stats/page.tsx           # statistiques
│  │  ├─ settings/page.tsx        # paramètres
│  │  └─ aide/page.tsx            # guide intégré
│  └─ api/
│     ├─ auth/...                 # login, callback, logout
│     ├─ extract/route.ts         # upload + PDF/OCR + analyse + archivage
│     ├─ profile/route.ts         # lecture / mise à jour du profil
│     ├─ expenses/...             # ajout, modification partielle, suppression, bulk
│     ├─ workspace/route.ts       # rechargement global
│     ├─ settings/route.ts        # paramètres
│     ├─ google-token/route.ts    # jeton pour Picker
│     └─ drive/...                # config Picker + import Drive
├─ components/
│  ├─ landing/                    # page publique
│  ├─ dashboard/                  # tableau de bord, upload, table, dialogues, conflit
│  ├─ stats/                      # page statistiques
│  ├─ settings/                   # page paramètres + profil
│  ├─ app/                        # en-tête, navigation, contexte global
│  ├─ ui/                         # modale, menus, éditeur d'articles, paiements
│  ├─ Logo.tsx
│  └─ GoogleIcon.tsx
└─ lib/
   ├─ google.ts                   # OAuth, portées, cache de jeton
   ├─ session.ts                  # cookie iron-session, URL, e-mails autorisés
   ├─ sheet.ts                    # Sheets + Drive, schéma V2, lignes, conflits, upload
   ├─ items.ts                    # normalisation/calculs des articles et économies
   ├─ profile.ts                  # profil JSON lié au compte Google
   ├─ settings.ts                 # fichier JSON de paramètres
   ├─ ocr.ts                      # Tesseract, prétraitement, PDF, détection du gras
   ├─ parse-receipt.ts            # heuristiques tickets français + articles
   ├─ validation.ts               # validation des dépenses et patchs
   ├─ catalog.ts                  # catégories, paiements, couleurs
   ├─ format.ts                   # formats euro/date, mois, parsing montant
   ├─ types.ts                    # types partagés
   ├─ google-errors.ts            # traduction des erreurs Google
   └─ utils.ts                    # fusion de classes CSS
```

Autres éléments notables :

- `scripts/` : tests utilitaires.
- `.github/workflows/keep-alive.yml` : maintien en éveil de Render.
- `docs/` : captures d'écran et ce document.
- `.env.example` : modèle de configuration.
- `render.yaml` : infrastructure Render.
- `next.config.ts` : paquets serveur externes et en-têtes de sécurité.

---

## 14. Ce que l'outil ne fait pas

- Il ne remplace pas une comptabilité professionnelle.
- Il ne lit pas les relevés bancaires.
- Il ne se connecte pas à Gmail.
- Il ne fait pas d'OCR sur les PDF scannés.
- Il ne gère pas plusieurs devises.
- Il ne partage pas un budget entre plusieurs comptes Google.
- Il ne crée pas de catégories personnalisées.
- Il ne garantit pas une extraction parfaite : l'analyse est heuristique.
- Il ne fonctionne pas hors ligne.
- Il ne conserve aucun historique côté serveur.

---

## 15. Journal des modifications de ce document

| Date | Version décrite | Modification |
| --- | --- | --- |
| 23/11/2026 | `dafac6a` — v0.1.0 | **Création initiale** : description complète de l'application, de l'architecture, des fonctionnalités, de l'API, de la sécurité, des limites et de l'exploitation. |

---

## 16. Maintenance de ce document

### 16.1 Règle

Toute intervention qui modifie l'outil doit mettre à jour ce document **dans la même livraison**. Cela inclut, sans s'y limiter :

- ajout, suppression ou modification d'une fonctionnalité ;
- changement d'un libellé, d'un bouton, d'un écran ou d'un parcours ;
- modification d'une règle de validation, d'une limite ou d'un quota ;
- ajout ou suppression d'une route API ;
- modification du modèle de données, des colonnes du Sheet ou du fichier de paramètres ;
- changement de portée Google, de mécanisme de sécurité ou de stockage ;
- ajout, renommage ou suppression d'une variable d'environnement ;
- changement de dépendance majeure, de version de Node ou de mode de déploiement ;
- correction d'un bug qui change le comportement observable.

### 16.2 Checklist

1. Mettre à jour la date et la version décrite en tête du document.
2. Ajuster les sections fonctionnelles concernées.
3. Mettre à jour le tableau des routes API si nécessaire.
4. Mettre à jour les limites et quotas si nécessaire.
5. Mettre à jour la structure du code si des fichiers sont ajoutés ou déplacés.
6. Ajouter une ligne dans le journal des modifications.
7. Relire la section « Ce que l'outil ne fait pas » pour retirer ce qui est désormais implémenté.
8. Vérifier que le README et ce document ne se contredisent pas.

### 16.3 Emplacement

Ce document est la référence fonctionnelle principale :
`docs/DESCRIPTION-OUTIL.md`.

Il complète le `README.md`, qui reste la référence d'installation et de dépannage.
