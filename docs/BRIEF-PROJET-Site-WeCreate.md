# BRIEF PROJET — Site web WeCreate (portfolio + e-commerce)
**Destinataire : Claude Code** · Version 1.0 · Août 2026
**Client : WeCreate — Abakar Adoum** · Calavi Tankpè, Bénin

---

## 0. TL;DR (résumé exécutif)
Construire le site web de **WeCreate**, agence de production vidéo cinématographique (Bénin). Le site a **deux fonctions** :
1. **Portfolio** — montrer les travaux réalisés (vidéos Entreprises / Immobilier / Mariage).
2. **Boutique e-commerce** — vendre des produits numériques (ebooks, LUTs/presets) et des packs de services.

- **Design** : noir & blanc pur, cinématographique, minimaliste (voir §4).
- **Site multi-pages** : Accueil · Portfolio · Services · Boutique · À propos · Contact.
- **Paiement** : l'agrégateur **FedaPay** (Mobile Money MTN/Moov + cartes, devise **XOF / FCFA**). C'est la solution de paiement à intégrer — **pas Stripe, pas PayPal**.
- **Livraison numérique automatique** des ebooks/LUTs après paiement confirmé (lien de téléchargement / email).

---

## 1. CONTEXTE
WeCreate est une agence de production vidéo basée à Abomey-Calavi (Calavi Tankpè), Bénin. Positionnement : **« Premium • Cinématographique • Différent »**. Promesse : *« On ne capture pas des images. On fabrique des œuvres qui font vendre. »*

L'activité repose sur trois niches :
- **Entreprises** — abonnements mensuels de production vidéo (cœur du business, revenu récurrent).
- **Immobilier** — vidéos de biens en location courte durée (volume).
- **Mariage** — films de mariage premium (gros tickets).

En parallèle, WeCreate a produit des **contenus numériques** (ebooks/guides, LUTs d'étalonnage) qu'elle veut vendre en ligne. Le site doit donc réunir la **vitrine/portfolio** et une **boutique transactionnelle**.

**Contact / identité de contact du site :**
- WhatsApp : +229 01 67 36 67 26
- Email : wecreate08@gmail.com
- Instagram / TikTok : @wecreate.bj
- Localisation : Calavi Tankpè, Bénin

---

## 2. OBJECTIFS DU SITE
1. Présenter WeCreate comme une agence **premium et crédible** (design cinéma, portfolio soigné).
2. **Générer des leads** pour les services (devis/appels via WhatsApp + formulaire).
3. **Vendre en ligne** des produits numériques avec paiement immédiat et **livraison automatique**.
4. Permettre la **réservation/acompte en ligne** des packs de services via FedaPay.
5. Être **rapide, responsive (mobile-first)** et **optimisé pour le contexte béninois** (Mobile Money, connexions mobiles, français).

---

## 3. PÉRIMÈTRE — PAGES ATTENDUES
Navigation fixe : **Logo · Accueil · Portfolio · Services · Boutique · À propos · Contact** + bouton « Réserver un appel » (WhatsApp) + **icône panier** avec compteur.

1. **Accueil** — hero cinéma, positionnement, 3 univers, extrait portfolio, aperçu boutique, preuve/chiffres, CTA.
2. **Portfolio** — grille de projets filtrable (Tous / Entreprises / Immobilier / Mariage), lightbox vidéo, fiche projet (client, type, livrables).
3. **Services** — les 3 niches et leurs packs avec pricing détaillé (voir §7), tableau comparatif entreprises, add-ons, CTA devis.
4. **Boutique** — catalogue e-commerce filtrable (Ebooks & Guides · LUTs & Presets · Packs Services), fiches produit, panier, checkout FedaPay.
5. **À propos** — histoire, philosophie, méthode, équipement, zone d'intervention.
6. **Contact** — formulaire, coordonnées, réseaux, process « Comment démarrer ».
7. **Pages transactionnelles** — panier, checkout, page de **confirmation de paiement** (retour FedaPay), page **échec/annulation**, page/email de **livraison du produit** (liens de téléchargement).
8. **Pages légales** — CGV, mentions légales, politique de confidentialité (contenu placeholder à remplir).

---

## 4. IDENTITÉ DE MARQUE & DESIGN
> Un prompt de design détaillé existe déjà (`Prompt-Site-WeCreate.md`). Résumé des règles à respecter :

- **Palette : NOIR & BLANC PUR.** Noir profond (#0A0A0A / #000), blanc pur (#FFF), échelle de gris (#111, #1A1A1A, #333, #777, #BBB, #EEE). **Aucune couleur d'accent** — la couleur ne vient que des vignettes vidéo/photo.
- **Typographie :** titres en **Playfair Display** (serif, grand, italique pour les accents) ; corps/UI/prix en **Inter** (sans-serif). Micro-labels en Inter majuscules, letter-spacing large.
- **Logo :** mot-symbole « WECREATE » + icône « W » géométrique anguleuse. Versions blanche (fond noir) et noire (fond blanc) — fichiers SVG fournis dans `Identité visuelle/logo/`.
- **Polices fournies** dans `Identité visuelle/fonts/` (Inter + Playfair Display, TTF + woff2) — les self-hoster (ne pas dépendre uniquement de Google Fonts en prod).
- **Ambiance :** éditorial, cinématographique, beaucoup d'espace négatif, letterbox subtil, reveal au scroll, hover qui agrandit/lance les vignettes. Sombre par défaut ; sections boutique/infos peuvent passer en fond clair pour rythmer.
- **Ton des textes :** français, premium, direct, orienté résultat. Réutiliser : « Premium • Cinématographique • Différent ».

---

## 5. STACK TECHNIQUE RECOMMANDÉE
Le site a besoin d'un **backend** (les clés secrètes FedaPay ne doivent JAMAIS être exposées côté client, et il faut un endpoint webhook). Recommandation :

- **Framework : Next.js (App Router) + React + TypeScript.** Front rendu + **API routes** pour la logique FedaPay (création de transaction, webhook, génération des liens de téléchargement).
- **Styles : Tailwind CSS** (avec tokens noir/blanc/gris) ou CSS modules — au choix, mais garder un design system cohérent. Polices self-hostées.
- **Catalogue produits :** fichier de données versionné (`/data/products.ts` ou JSON) — pas besoin de CMS lourd au départ. Prévoir une structure permettant une future migration vers un CMS/DB.
- **Commandes / paiements :** table `orders` + `order_items`. Base légère (SQLite/Postgres via Prisma, ou table hébergée type Supabase). Minimum : persister les commandes et leur statut pour la livraison et le webhook.
- **Emails transactionnels :** service type Resend/Nodemailer (SMTP) pour envoyer les liens de téléchargement et confirmations.
- **Stockage des fichiers produits (PDF ebooks, .cube LUTs) :** stockage privé (S3/Supabase Storage/Bunny) avec **liens de téléchargement signés à durée limitée** — ne jamais servir les fichiers en accès public direct.
- **Déploiement :** Vercel (ou équivalent). Variables d'environnement pour les secrets.
- **i18n :** français par défaut (prévoir l'architecture pour ajouter l'anglais plus tard, non prioritaire).

> Si une stack plus simple est préférée (Astro + endpoints serverless, ou Node/Express + front statique), c'est acceptable **à condition** de conserver : backend pour FedaPay, webhook, livraison sécurisée des fichiers.

---

## 6. CATALOGUE E-COMMERCE (articles qui peuplent la boutique)
Trois familles. **Prix en FCFA (XOF).**
⚠️ Les prix des produits numériques (ebooks, LUTs) sont des **propositions à valider par WeCreate** (marqués « à valider »). Les prix des packs de services sont fermes (issus de l'offre commerciale). Structurer le catalogue pour que les prix soient facilement modifiables dans les données.

### 6.1 — EBOOKS & GUIDES (produit numérique, livraison = PDF téléchargeable)
| SKU | Titre | Description courte | Prix (à valider) | Livrable |
|---|---|---|---|---|
| EBK-01 | **Color Grading Signature** | La méthode d'étalonnage cinéma signature WeCreate (DaVinci Resolve) : roues, courbes, teal/orange, peaux, LUTs. | 15 000 F | PDF |
| EBK-02 | **Signature Cinéma** | Le guide complet de la vidéo cinématographique : intention, découpage, lumière, mouvement, montage. | 15 000 F | PDF |
| EBK-03 | **Le Manuel du Créateur Mobile** | Tourner en qualité pro avec un smartphone : réglages, cadrage, lumière, stabilisation, export. | 10 000 F | PDF |

### 6.2 — LUTs & PRESETS (produit numérique, livraison = fichiers .cube/.zip)
| SKU | Titre | Description courte | Prix (à valider) | Livrable |
|---|---|---|---|---|
| LUT-01 | **Pack LUT Signature WeCreate** | Le pack d'étalonnage signature (plusieurs LUTs cinéma prêtes à l'emploi). | 20 000 F | .zip (.cube) |
| LUT-02 | **Teal & Orange Cinéma** | La teinte cinéma classique, contraste peaux/ambiances. | 12 000 F | .zip (.cube) |
| LUT-03 | **Ambiances — Nostalgie / Luxe / Froid** | 3 ambiances signatures pour vlogs et pubs. | 12 000 F | .zip (.cube) |

> Les visuels de couverture des ebooks/LUTs pourront venir des PDF existants (`Nani - graphiste/ebook/...`). Utiliser des placeholders propres en attendant.

### 6.3 — PACKS SERVICES (réservation / acompte en ligne)
Achetables en ligne via un **paiement d'acompte** selon les conditions (voir §7 pour les inclus détaillés). Bouton « Réserver ».
- **Entreprises :** Pack Présence · Pack Croissance · Pack Domination.
- **Immobilier :** Pack Visite Premium · Pack Gestionnaire Pro · Pack Gestionnaire Empire.
- **Mariage :** Pack Souvenir · Pack Élégance · Pack Héritage · Wedding Film Signature.

### 6.4 — ADD-ONS (options, vendables avec un pack)
- Drone (entreprise/immobilier) : **50 000 F / vidéo** ; Drone mariage 1 cérémonie : **100 000 F** ; multi-cérémonies : **200 000 F**.
- Fichiers sources / rushes RAW : **50 000 F / projet**.
- Pack photos séance dédiée (immobilier) : **50 000 F**. Tournage ambiance soir : **30 000 F**. Voix off FR pro : **25 000 F**. Version horizontale 16:9 : **20 000 F**. Livraison express 48h : **30 000 F**.
- Séance Fashion Robe seule : **250 000 F**. Vidéo challenge/transition TikTok couple : **150 000 F**. Teaser 30s supplémentaire : **100 000 F**.

---

## 7. PLANS DE PAIEMENT / PRICING DES SERVICES (contenu connu, ferme)

### 7.1 — ENTREPRISES (abonnements mensuels)
| Pack | Prix | Engagement | Inclus (essentiel) |
|---|---|---|---|
| **Présence** | **350 000 F / mois** | 3 mois | 4 vidéos verticales cinéma 30-60s, étalonnage signature, musique licence, 1 cycle de retouches, 2 demi-journées de tournage, livraison 5 j, stockage rushes 3 mois. |
| **Croissance** | **650 000 F / mois** | 6 mois | 8 vidéos, 3 photos HD, 2 cycles retouches, 2 variantes/mois + **1 vidéo pub cinéma 60-90s / trimestre** (concept + voix off/casting), 4 demi-journées tournage, brief 1h, bilan trimestriel, stockage 6 mois. |
| **Domination** | **1 200 000 F / mois** | 12 mois | 12 vidéos (vertical+horizontal), 10 photos HD, 4 variantes/mois + **1 vidéo pub cinéma 90-120s / trimestre** (multilingue possible) + **2 couvertures événementielles / an**, délais express (3 j / 7 j), WhatsApp prioritaire, bilan annuel 3h, stockage 12 mois. |

Comparatif complet à afficher (vidéos/mois, photos, cycles retouches, variantes, délais, briefs, stockage, reports).

### 7.2 — IMMOBILIER
| Pack | Prix | Type | Inclus (essentiel) |
|---|---|---|---|
| **Visite Premium** | **120 000 F** | à l'unité | 1 vidéo verticale 60-90s (9:16), étalonnage cinéma, musique, 1 cycle retouches, tournage 2-3h (Sony ZV-E1), livraison 5 j. |
| **Gestionnaire Pro** | **320 000 F / mois** | abo (3 mois) | 3 vidéos, **drone inclus**, 3 photos HD/bien, 2 cycles retouches, délai 4 j. |
| **Gestionnaire Empire** | **600 000 F / mois** | abo (6 mois) | 6 vidéos, drone inclus, 5 photos HD/bien, 3 cycles retouches, 1 express 48h/mois, conseil trimestriel, délai 3 j. |

### 7.3 — MARIAGE
| Pack | Prix | Inclus (essentiel) |
|---|---|---|
| **Souvenir** | **400 000 F** | 1 récap cinéma 3-5 min (16:9) + version verticale + teaser 30s + 5 photos HD, étalonnage cinéma. |
| **Élégance** | **750 000 F** | Souvenir + séance Fashion Robe 3h + vidéo fashion 60-90s + version horizontale + 5 photos éditoriales + direction artistique. |
| **Héritage** | **1 200 000 F** | 3 cérémonies : récap global 6-8 min + 3 récaps individuels + fashion + 5 verticales + 4 teasers + 15 photos HD, 2e cameraman au religieux. |
| **Wedding Film Signature** | **2 000 000 F** | Œuvre narrative 10-15 min + highlight + récaps + 6 verticales + 5 teasers + 25 photos éditoriales + Wedding Reveal Screening privé. *(À activer en 2027 — peut être affiché « Sur demande ».)* |

### 7.4 — RÈGLES DE PAIEMENT (à appliquer pour l'acompte en ligne)
| Type de prestation | Acompte en ligne | Solde |
|---|---|---|
| Vidéo à l'unité (immobilier, fashion seule) | **50 %** à la réservation | 50 % à la livraison |
| Abonnement mensuel (entreprises, gestionnaires) | **100 %** du 1er mois (à la signature) | mensuel d'avance ensuite |
| Mariage (tous packs) | **70 %** à la réservation (date bloquée) | 30 % à la livraison |

- Moyens de paiement locaux : **Virement BIIC, Mobile Money, Espèces** (hors ligne) — **et FedaPay** pour l'acompte en ligne.
- TVA : non applicable.
- Le site calcule et affiche clairement le **montant de l'acompte** à payer en ligne vs le solde restant dû.
- Pour les produits numériques (ebooks/LUTs) : **paiement 100 % en ligne**, livraison immédiate.

---

## 8. INTÉGRATION PAIEMENT — FEDAPAY (obligatoire)
**FedaPay est l'agrégateur de paiement retenu pour tout le site.** (Docs : https://docs.fedapay.com)

### 8.1 — Principes
- **Devise : XOF (FCFA).**
- **Méthodes supportées :** Mobile Money **MTN Bénin** et **Moov Bénin**, plus **cartes bancaires** — FedaPay gère la sélection du moyen de paiement.
- **Deux environnements :** **sandbox** (test) et **live** (production). Développer et tester en sandbox d'abord.
- **Clés API :** une clé **publique** (front, pour Checkout.js) et une clé **secrète** (serveur uniquement). Formats distincts sandbox/live. **La clé secrète ne doit jamais être committée ni exposée au client.**
- Deux modes d'intégration possibles — choisir **Checkout.js (widget)** en priorité pour la simplicité, avec fallback **lien de paiement / redirection hébergée** :
  1. **Checkout.js** (widget officiel FedaPay chargé côté front) : bouton de paiement → ouvre la modale FedaPay → l'utilisateur paie → callback.
  2. **API serveur + redirection** : le backend crée la transaction et génère un **token/URL de paiement**, on redirige le client vers la page hébergée FedaPay.

### 8.2 — Flux de commande à implémenter
1. Client ajoute des articles au **panier** (produits numériques et/ou acomptes de packs).
2. **Checkout** : formulaire (nom, email, téléphone — requis pour Mobile Money). Le backend crée une **commande** (`orders`) avec statut `pending` et calcule le montant total (produits = 100 % ; services = acompte selon §7.4).
3. Le backend crée une **transaction FedaPay** (via SDK serveur, clé secrète) : montant, devise `XOF`, description, `customer` (email/téléphone), et une **URL de callback/retour** + référence de commande.
4. Le client paie (Checkout.js ou redirection).
5. **Webhook FedaPay** → endpoint backend `/api/fedapay/webhook` : vérifier la **signature**, lire l'événement (transaction **approuvée** / échouée). **La confirmation de commande se fait via le webhook, PAS via le retour navigateur** (le retour front sert seulement à l'affichage).
6. Sur transaction **approuvée** : passer la commande à `paid`, déclencher la **livraison** :
   - Produits numériques → générer des **liens de téléchargement signés** (durée limitée) + **email** avec les liens.
   - Packs services → email de confirmation d'acompte + notification à WeCreate (WhatsApp/email) pour planifier.
7. Pages de retour : **succès**, **échec/annulation**, avec réconciliation du statut réel via le backend.

### 8.3 — Sécurité & robustesse
- Recalculer les montants **côté serveur** (ne jamais faire confiance au prix envoyé par le client).
- **Idempotence** sur le webhook (un même événement peut arriver plusieurs fois).
- Journaliser les transactions et statuts.
- Vérifier la signature/authenticité du webhook.
- Ne servir les fichiers produits qu'après paiement confirmé, via liens signés expirants.

### 8.4 — Variables d'environnement (exemple)
```
FEDAPAY_ENV=sandbox            # sandbox | live
FEDAPAY_PUBLIC_KEY=pk_...      # front (Checkout.js)
FEDAPAY_SECRET_KEY=sk_...      # serveur uniquement
FEDAPAY_WEBHOOK_SECRET=whsec_...
FEDAPAY_CURRENCY=XOF
SITE_URL=https://...           # pour callbacks
# Email / stockage
EMAIL_API_KEY=...
STORAGE_BUCKET=...
```
> Utiliser le **SDK serveur officiel FedaPay** correspondant à la stack (Node.js/PHP/Python/Ruby) et le **Checkout.js** officiel côté front. Vérifier les noms de packages, endpoints, formats de clés et signatures de webhook directement dans la doc officielle (https://docs.fedapay.com) au moment de l'implémentation — ne pas coder « de mémoire ».

---

## 9. MODÈLE DE DONNÉES (minimum)
- **Product** : `id`, `sku`, `type` (`ebook` | `lut` | `service`), `title`, `slug`, `description`, `price`, `currency` (`XOF`), `cover`, `fileKey` (pour numériques), `depositRule` (pour services : `50` | `70` | `100`), `active`.
- **Order** : `id`, `reference`, `customer` (nom, email, téléphone), `items[]`, `subtotal`, `amountDue` (ce qui est payé en ligne), `status` (`pending`|`paid`|`failed`|`cancelled`), `fedapayTransactionId`, `createdAt`.
- **OrderItem** : `productId`, `sku`, `title`, `unitPrice`, `qty`, `lineType` (`full`|`deposit`).
- **DownloadGrant** : `orderId`, `productId`, `signedUrl`/`token`, `expiresAt`, `downloadsCount`.

---

## 10. PARCOURS UTILISATEUR CLÉS
- **Achat ebook/LUT :** Boutique → fiche produit → panier → checkout → FedaPay → webhook `approved` → email + page de téléchargement → fichier livré.
- **Réservation pack service :** Services/Boutique → « Réserver » → checkout (acompte calculé) → FedaPay → confirmation acompte + prise de contact WeCreate.
- **Lead service (sans paiement) :** Services → « Demander un devis » → WhatsApp/formulaire.

---

## 11. EXIGENCES NON-FONCTIONNELLES
- **Responsive mobile-first**, performances élevées (images/vidéos optimisées, lazy-load), pensé pour connexions mobiles béninoises.
- **SEO** : métadonnées, Open Graph, titres sémantiques, sitemap. Français.
- **Accessibilité** : contrastes, focus visibles, alt, navigation clavier.
- **Sécurité** : secrets hors du repo, validation serveur, HTTPS, liens de téléchargement expirants.
- **Sans localStorage/sessionStorage pour les artefacts front de démo** ; en prod Next.js, l'état panier peut être en cookie/session serveur ou contexte React.
- **Code commenté et modulaire**, données (catalogue, prix, textes) centralisées et faciles à modifier.

---

## 12. LIVRABLES ATTENDUS
1. Code source complet du site (repo structuré, README d'installation + configuration des variables d'env).
2. Les 6 pages principales + pages transactionnelles + pages légales (placeholders).
3. Intégration **FedaPay complète** en sandbox (création transaction, Checkout.js/redirection, webhook, livraison numérique).
4. Catalogue peuplé avec les articles du §6 et pricing du §7 (données modifiables).
5. Composants réutilisables (carte produit, carte pricing, panier, header/footer, lightbox portfolio).
6. Documentation : comment passer de **sandbox → live**, comment ajouter un produit, comment remplacer médias/logos/polices.

---

## 13. PHASAGE SUGGÉRÉ
1. **Setup** : projet, design system noir/blanc, polices self-hostées, header/footer, navigation.
2. **Pages vitrine** : Accueil, Portfolio (placeholders), Services (pricing), À propos, Contact.
3. **Boutique** : catalogue + fiches produit + panier.
4. **Paiement** : intégration FedaPay sandbox (transaction, webhook, statuts).
5. **Livraison** : liens signés + emails + pages succès/échec.
6. **Finitions** : SEO, accessibilité, responsive, docs, passage en live.

---

## 14. HYPOTHÈSES & QUESTIONS OUVERTES (à confirmer avec WeCreate)
- **Prix des ebooks/LUTs** : valeurs du §6 à valider (proposées).
- **Wedding Film Signature** : afficher « Sur demande » (activation 2027) plutôt que vente directe ?
- **Acompte en ligne des packs services** : confirmer qu'on encaisse bien l'acompte en ligne (vs simple demande de réservation).
- **Emails transactionnels** : quel expéditeur/domaine ? (sinon utiliser wecreate08@gmail.com via SMTP en attendant).
- **Hébergement des fichiers produits** : où stocker les PDF/LUTs de façon privée ?
- **Contenu portfolio réel** : fournir les vraies vidéos/vignettes + intitulés clients (placeholders en attendant).
- **Comptes FedaPay** : fournir les clés sandbox puis live + configurer l'URL de webhook.

---

### Ressources fournies dans le dossier projet
- `Prompt-Site-WeCreate.md` — prompt de design détaillé.
- `Identité visuelle/logo/` — logos SVG (noir/blanc + icônes).
- `Identité visuelle/fonts/` — Inter + Playfair Display (TTF + woff2).
- `Nani - graphiste/Offre Commerciale WeCreate.md` — offre complète (source des prix).
- `Nani - graphiste/ebook/` — ebooks existants (Color Grading, Signature Cinéma, Manuel du Créateur Mobile) pour visuels/contenus produit.

*Fin du brief — v1.0.*
