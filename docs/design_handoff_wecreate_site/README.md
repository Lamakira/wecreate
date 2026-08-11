# Handoff: Site WeCreate — agence de production vidéo cinématographique

## Overview
Site vitrine + boutique pour **WeCreate**, agence de production vidéo cinématographique basée à Abomey-Calavi (Calavi Tankpè), Bénin. Positionnement : « Premium • Cinématographique • Différent ». Promesse : « On ne capture pas des images. On fabrique des œuvres qui font vendre. »

Le site comporte 6 pages publiques (Accueil, Portfolio, Services, Boutique, À propos, Contact), une page produit détaillée, un panier latéral, une lightbox projet, plus deux pages annexes : une revue responsive et une salle de projection 3D (three.js).

Devise : **FCFA (F)**. Langue : **français**. Contact : WhatsApp +229 01 67 36 67 26 · wecreate08@gmail.com · Instagram & TikTok @wecreate.bj.

## Validated transaction direction

The Digital Product transaction journey uses the **split transaction ticket** direction selected on 11 August 2026: a black order ticket preserves WeCreate's cinematic identity while a white working surface carries checkout, payment verification, recovery, receipt, and Order Access. On narrow screens, the ticket collapses to the order total and Order Snapshot duration so the current transaction state remains visible in the first viewport.

The full throwaway comparison and review record are preserved on branch `prototype/digital-transactions`; production code must recreate the selected structure rather than promote the prototype HTML directly.

## About the Design Files
Les fichiers de ce bundle sont des **références de design réalisées en HTML** — des prototypes qui montrent l'apparence et le comportement attendus, **pas du code de production à copier tel quel**. Le travail consiste à **recréer ces designs dans l'environnement existant du codebase cible** (React, Vue, Next, Astro, SwiftUI, natif…) en suivant ses conventions, ses composants et ses librairies. S'il n'existe pas encore d'environnement, choisir le framework le plus adapté (une stack statique type Astro/Next + Tailwind convient très bien à ce site) et y implémenter les designs.

Particularités techniques du prototype à ne PAS reproduire littéralement :
- Les styles sont écrits **inline** (contrainte de l'outil de prototypage). Dans le codebase, utiliser la solution de styling en place (CSS modules, Tailwind, styled-components…).
- La navigation entre les 6 pages est un **state React unique** (`page`) dans un seul fichier. En production, ce sont **6 routes distinctes** (`/`, `/portfolio`, `/services`, `/boutique`, `/boutique/[slug]`, `/a-propos`, `/contact`).
- Le panier est en **mémoire JS seulement** (aucun localStorage, contrainte du prototype). En production : persistance + vrai checkout (voir « État & données »).

## Fidelity
**High-fidelity (hifi).** Couleurs, typographies, échelles d'espacement, contenus et interactions sont définitifs. Le rendu doit être recréé au pixel près, avec les composants du codebase cible. Seuls les **médias sont des placeholders** (dégradés gris avec libellé monospace et bon ratio) : ils sont à remplacer par les vraies vidéos/photos, en conservant strictement les ratios indiqués.

---

## Design Tokens

### Couleurs — noir & blanc strict, aucune couleur d'accent
Le contraste noir/blanc **est** l'identité. La seule couleur autorisée viendra des vignettes vidéo/photo.

| Token | Valeur | Usage |
|---|---|---|
| `black` | `#0A0A0A` | fond par défaut du site (pages sombres) |
| `black-pure` | `#000000` | letterbox du hero, fond du footer, bandeau marquee |
| `surface` | `#0F0F0F` | fond des cartes sur fond sombre, champs de formulaire |
| `surface-2` | `#111111` | fond de survol des boutons fantômes |
| `line-dark` | `#1A1A1A` | bordures et séparateurs sur fond sombre |
| `border` | `#333333` | bordure des boutons secondaires, champs, cadres |
| `muted` | `#555555` | méta tertiaire, mentions footer |
| `muted-2` | `#777777` | micro-labels, texte secondaire |
| `text-soft` | `#BBBBBB` | corps de texte sur fond sombre |
| `line-light` | `#EEEEEE` | séparateurs sur fond blanc |
| `white` | `#FFFFFF` | texte sur fond sombre, fond des sections claires |

Gris des placeholders média : dégradés entre `#1A1A1A`, `#3A3A3A`, `#0F0F0F` (fond sombre) et `#EEE`, `#BBB`, `#DDD` (fond clair).

### Typographie
- **Titres — Playfair Display** (Google Fonts), poids 500, `letter-spacing: -0.02em`, `line-height: 0.98–1.06`. Italique (`font-style: italic`) sur un mot-clé par titre, en accent.
- **Corps / UI / prix — Inter** (Google Fonts), poids 300 / 400 / 500 / 600 / 700.
- **Micro-labels** : Inter, `font-size: 10px`, `font-weight: 500`, `letter-spacing: 0.26–0.34em`, `text-transform: uppercase`, couleur `#777`.
- **Libellés de placeholder** : `ui-monospace, monospace`, 10–11px, `letter-spacing: .18em`, `#777`.

Échelle (toutes fluides en `clamp()`) :

| Rôle | Valeur |
|---|---|
| H1 hero accueil | `clamp(40px, 8.4vw, 124px)` / line-height .98 |
| H1 pages intérieures | `clamp(38px, 7.2vw, 104px)` / line-height 1 |
| H2 section | `clamp(30px, 4.6vw, 64px)` |
| H2 section claire | `clamp(28px, 4.2vw, 58px)` |
| H3 carte pack / produit | 22–30px (26px pour les packs) |
| Citation de marque | `clamp(26px, 4.6vw, 60px)`, Playfair italique |
| Corps large | `clamp(14px, 1.5vw, 18px)`, poids 300, line-height 1.7 |
| Corps carte | 13–14px, poids 300, line-height 1.65–1.75 |
| Prix pack | `clamp(22px, 2.4vw, 30px)`, poids 600 |
| Bouton / CTA | 10–11px, poids 600, `letter-spacing: .16–.18em`, uppercase |

### Espacement
Rythme vertical en `clamp()`, sections généreuses : `clamp(72px, 10vw, 140px)` (sections majeures), `clamp(56px, 8vw, 110px)` (sections secondaires), `clamp(48px, 7vw, 96px)` (footer). Gouttière horizontale : `clamp(20px, 5vw, 64px)`. Largeur max de contenu : **1560px**, centrée. Gaps de grille : `clamp(12px, 2vw, 28px)`.

### Rayons, ombres, bordures
- **Border-radius : 0 partout.** Aucun coin arrondi (sauf les bezels de la page responsive : 26px mobile, 18px tablette, 6px desktop).
- **Aucune ombre portée** dans l'UI. Seule exception : les cadres d'appareils de la page responsive (`0 30px 80px rgba(0,0,0,.6)`) et le panneau 3D.
- Bordures : `1px solid` — `#1A1A1A` sur fond sombre, `#EEE` sur fond blanc, `#333` pour les contrôles.

### Easing & durées
- Easing signature : `cubic-bezier(.16, 1, .3, 1)`.
- Reveal au scroll : `opacity .9s` + `transform .9s` (translateY 26px → 0).
- Hover carte : `transform .5s` (translateY -5/-6px) + `border-color .4s`.
- Zoom vignette au survol : `transform .7s` scale(1.05).
- Boutons / liens : `.3s`.
- Header condensé au scroll : `padding-block .35s`.
- Marquee positionnement : translateX 0 → -50%, `26s linear infinite`.
- Grain plein écran : `repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)`, opacité **0.05** (réglable 0 → 0.16), `pointer-events: none`, z-index 9998.

---

## Screens / Views

### Chrome commun

**Header (fixe, toutes pages)**
- `position: fixed`, pleine largeur, `background: rgba(10,10,10,.82)`, `backdrop-filter: blur(14px)`, `border-bottom: 1px solid #1A1A1A`, z-index 900.
- Contenu max 1560px, `padding-inline: clamp(16px, 4vw, 56px)`, `padding-block: 20px` → **12px quand `scrollY > 40`** (transition .35s).
- Gauche : logo `assets/logo-blanc.svg`, hauteur 22px. **Sous 900px**, le mot-symbole est remplacé par l'icône seule `assets/icone-blanc.svg` (24px).
- Centre/droite : nav 6 liens — Accueil · Portfolio · Services · Boutique · À propos · Contact. 11px, poids 500, `letter-spacing: .16em`, uppercase, `white-space: nowrap`. Lien inactif `#777`, actif `#fff` + `border-bottom: 1px solid #fff`. Hover → `#fff`.
  - **Sous 900px** : la nav devient défilable horizontalement (`overflow-x: auto`, scrollbar masquée) et s'aligne à gauche.
- Droite : bouton panier — carré 40×40, `border: 1px solid #333`, icône panier 16px, badge compteur en pastille blanche 18px (texte noir 10px/700) en haut à droite. Hover : bordure `#fff`, fond `#111`.
- CTA « Réserver un appel » : fond `#fff`, texte `#000`, 11px/600, `letter-spacing: .16em`, padding 13px 20px. **Masqué sous 1120px.** Cible : `https://wa.me/2290167366726`.

**Footer (toutes pages)**
Fond `#000`, `border-top: 1px solid #1A1A1A`, padding `clamp(48px,7vw,88px)` haut / 34px bas. Grille `auto-fit minmax(200px, 1fr)`, gap `clamp(28px,4vw,56px)` :
1. Logo (26px) + baseline Playfair italique 18px `#BBB` : « On ne capture pas des images. On fabrique des œuvres qui font vendre. »
2. Navigation (mêmes 6 liens, 13px poids 300 `#BBB`).
3. Contact : WhatsApp, email, « Calavi Tankpè, Bénin ».
4. Réseaux : Instagram @wecreate.bj, TikTok @wecreate.bj.
Barre basse séparée par `border-top: 1px solid #1A1A1A` : « WeCreate — Calavi Tankpè, Bénin » à gauche, « Premium · Cinématographique · Différent » à droite (10px, `letter-spacing: .2em`, `#555`).

---

### 1. Accueil (`/`)
**Objectif** : poser le positionnement premium en trois secondes et router vers Portfolio ou Boutique.

Sections dans l'ordre :
1. **Hero** — `min-height: 92vh`, contenu aligné en bas. Fond : `linear-gradient(115deg, #141414 0%, #000 45%, #1A1A1A 100%)` + halo `radial-gradient(120% 80% at 70% 20%, rgba(255,255,255,.10), transparent 60%)`. **Letterbox** : deux bandes `#000` pleine largeur, hauteur `clamp(28px, 6vh, 64px)`, en haut et en bas. À remplacer par une **vidéo loop en fond** (muette, autoplay, `object-fit: cover`, poster obligatoire).
   - Micro-label : « Production vidéo cinématographique · Calavi Tankpè, Bénin ».
   - H1 : « Nous fabriquons des ***œuvres*** qui font vendre. » (« œuvres » en italique).
   - Sous-titre 52ch max : « On ne capture pas des images. Écriture, mise en scène, plein format, étalonnage signature — chaque vidéo est traitée comme une œuvre. »
   - CTA primaire blanc « Voir le portfolio » → `/portfolio` ; CTA fantôme « Découvrir la boutique » → `/boutique`.
   - Animation d'entrée : `wc-fade` 1.1s (opacity 0→1, translateY 20px→0).
2. **Marquee positionnement** — fond `#000`, bordures haut/bas `#1A1A1A`, padding 18px. Texte répété « Premium · Cinématographique · Différent — » en 11px `letter-spacing: .42em` `#777`, deux copies côte à côte, translateX 0 → -50% en 26s linéaire.
3. **Ce qu'on fait** — 3 blocs cliquables (Entreprises / Immobilier / Mariage), grille `auto-fit minmax(280px, 1fr)`. Chaque bloc : vignette **ratio 4:5**, micro-label (« Abonnements mensuels » / « Location courte durée » / « Films premium »), H3 Playfair 30px, description 14px `#BBB`, lien souligné « Voir les packs » → `/services`. Hover : bordure `#555` + translateY(-6px).
4. **Travaux récents** — 6 vignettes, grille `auto-fit minmax(240px, 1fr)`, **ratios mixtes 9:16 et 16:9**. Titre projet 13px/500 + méta « Client · Type » en micro-label. Hover : scale(1.05) sur la vignette. Clic → lightbox projet. Lien « Tout le portfolio ».
5. **Preuve** — **section fond blanc / texte noir**. 4 items en grille `auto-fit minmax(220px,1fr)`, chacun `border-top: 1px solid #EEE` : « 5 jours » (livraison 5 jours ouvrés), « Plein format » (Sony ZV-E1), « Étalonnage signature », « 3 univers ». Chiffre en Playfair `clamp(28px,3.4vw,44px)`, sous-texte 13px `#333`.
6. **Aperçu boutique** — 3 produits phares (Color Grading Signature, LUT Pack Signature, Visite Premium). Carte : vignette 4:3, badge blanc sur noir, H3 Playfair 22px, description, prix, bouton « Ajouter ».
7. **Citation de marque** — pleine largeur, centrée, bordures haut/bas. Playfair italique `clamp(26px,4.6vw,60px)`, max 20ch : « Ils n'ont pas filmé nos appartements. Ils les ont rendus désirables. » + attribution « Gestionnaire de résidences · Cotonou ».
8. **CTA final** — centré, max 1100px. H2 « Parlons de votre ***projet***. » `clamp(34px,6vw,86px)`, sous-titre « Devis sous 24-48h. Livraison en 5 jours ouvrés. », bouton blanc « WhatsApp +229 01 67 36 67 26 » + bouton fantôme « Formulaire de contact ».

### 2. Portfolio (`/portfolio`)
**Objectif** : prouver le niveau de réalisation, filtrer par univers, ouvrir un projet.
- En-tête : micro-label « Portfolio · N projets » (compteur dynamique), H1 « Chaque projet, une ***œuvre***. »
- **Filtres** : Tous / Entreprises / Immobilier / Mariage. Pilule active = fond `#fff` + texte `#000` ; inactive = transparent, texte `#BBB`, bordure `#333`. 10px/600, `letter-spacing: .2em`, padding 12px 20px.
- **Grille masonry** : `columns: 3 300px; column-gap: clamp(12px,1.6vw,20px)`, cartes `break-inside: avoid`. Ratios mixtes 9:16 / 16:9 respectés par carte. Vignette + badge « ▶ aperçu » en bas à droite ; en production, **lecture de l'aperçu vidéo au survol** (muet, en boucle). Titre Playfair 21px + méta « Client · Type ».
- **Lightbox projet** (clic sur une carte) : overlay `rgba(0,0,0,.94)`, contenu max 1080px. Lecteur **16:9**, puis deux colonnes : titre + méta + description à gauche ; « Rôle de WeCreate » et « Livrables » à droite. Bouton « Fermer × » en haut à droite ; clic sur le fond ferme aussi. Animation `wc-fade` .5s.

Jeu de données de démonstration (8 projets) : Résidence Aurora (Aurora Stays, Immobilier, 9:16) · Maison Kékéré (Entreprises, 16:9) · Ayo & Sika (Mariage, 16:9) · Tankpè Coffee (Entreprises, 9:16) · Villa Océane (Immobilier, 16:9) · Fashion Robe (Mariage, 9:16) · Groupe Adjovi (Entreprises, 16:9) · Studio Calavi (Entreprises, 9:16). **À remplacer par les vrais projets du client.**

### 3. Services (`/services`)
**Objectif** : exposer la méthode et vendre les packs des 3 niches.
- En-tête : H1 « La méthode ***WeCreate***. » + 3 colonnes d'intro (comprendre/écrire → tourner → étalonner/livrer).
- **Trois sections de packs**, une par univers, séparées par `border-top: 1px solid #1A1A1A`. Chaque section : micro-label, H2 (nom de l'univers), intro 44ch à droite, puis grille `auto-fit minmax(270px,1fr)`.
- **Carte pack** : fond `#0F0F0F`, bordure `#1A1A1A`, padding 30px 26px 26px. H3 Playfair 26px, prix `clamp(22px,2.4vw,30px)` poids 600 + unité en micro-label, séparateur, liste d'inclus (chaque ligne préfixée d'un tiret blanc `—`, 13px poids 300 `#BBB`), bloc « Cible · … » / « Engagement · … » en 10px `#555`, puis CTA blanc **« Demander un devis »** (WhatsApp prérempli avec le nom du pack) et, si achetable, bouton fantôme **« Ajouter au panier »**. Hover : bordure `#555` + translateY(-5px).

Grille tarifaire (FCFA) :

| Univers | Pack | Prix | Engagement |
|---|---|---|---|
| Entreprises | Pack Présence | 350 000 F / mois | 3 mois |
| Entreprises | Pack Croissance | 650 000 F / mois | 3 mois |
| Entreprises | Pack Domination | 1 200 000 F / mois | 6 mois |
| Immobilier | Pack Visite Premium | 120 000 F à l'unité | sans engagement |
| Immobilier | Pack Gestionnaire Pro | 320 000 F / mois | 3 mois |
| Immobilier | Pack Gestionnaire Empire | 600 000 F / mois | 6 mois |
| Mariage | Pack Souvenir | 400 000 F | acompte 50% |
| Mariage | Pack Élégance | 750 000 F | acompte 50% |
| Mariage | Pack Héritage | 1 200 000 F | acompte 50% |
| Mariage | Wedding Film Signature | 2 000 000 F | sur devis |

- **Tableau comparatif Entreprises** — **section fond blanc**. Table pleine largeur, `min-width: 620px`, `overflow-x: auto` sur mobile. En-têtes en micro-labels 10px avec `border-bottom: 1px solid #000` ; lignes séparées par `#EEE` ; libellés de ligne en `#777`. Lignes : Prix mensuel · Vidéos/mois (4/8/16) · Jours de tournage (1/2/4) · Film de marque (— / 1 par trimestre / 2 par trimestre) · Drone (— / option / inclus) · Engagement minimum (3/3/6 mois).
- **Add-ons** — grille `auto-fit minmax(250px,1fr)`, chaque item `border-top` + titre 15px + prix 12px/600 aligné à droite + description 13px `#777` : Drone (à partir de 75 000 F) · Fichiers sources (150 000 F) · Séance Fashion Robe (180 000 F) · Sous-titres & versions (40 000 F) · Journée de tournage supplémentaire (250 000 F) · Livraison express 48h (+30%).

### 4. Boutique (`/boutique`)
**Objectif** : vendre en direct ebooks, LUTs et packs services.
- **Page entièrement fond blanc / texte noir** (le header reste sombre translucide).
- En-tête : micro-label « Boutique · Paiement en FCFA », H1 « Nos ***outils***, entre vos mains. », chapô 52ch.
- **Onglets** : Ebooks & Guides · LUTs & Presets · Packs Services. Actif = fond `#000` texte `#fff` ; inactif = transparent, texte `#333`, bordure `#BBB`.
- **Grille produits** : `auto-fit minmax(270px,1fr)`, gap `clamp(16px,2vw,28px)`. Carte : bordure `#EEE`, vignette **4:3** en dégradé clair, **badge** en haut à gauche (fond noir, texte blanc, 9px `letter-spacing: .2em`) — valeurs : `PDF`, `Téléchargement`, `Réservation`. Puis H3 Playfair 23px, description 13px `#333`, lien « Voir le détail », séparateur, prix 15px/600 + bouton noir (« Ajouter au panier », ou « Réserver » pour les packs services). Hover : bordure `#000` + translateY(-5px).

Catalogue :

| Famille | Produit | Prix | Badge |
|---|---|---|---|
| Ebooks & Guides | Color Grading Signature | 15 000 F | PDF |
| Ebooks & Guides | Signature Cinéma | 20 000 F | PDF |
| Ebooks & Guides | Le Manuel du Créateur Mobile | 10 000 F | PDF |
| LUTs & Presets | LUT Pack Signature | 25 000 F | Téléchargement |
| LUTs & Presets | Teal & Orange Cinéma | 18 000 F | Téléchargement |
| LUTs & Presets | Nostalgie / Luxe | 18 000 F | Téléchargement |
| Packs Services | Visite Premium — Immobilier | 120 000 F | Réservation |
| Packs Services | Pack Présence — Entreprises | 350 000 F | Réservation |
| Packs Services | Pack Souvenir — Mariage | 400 000 F | Réservation |

**Prix à confirmer avec le client** (valeurs de travail).

Format prix : séparateur de milliers = **espace**, suffixe « F » ou « FCFA » (`350 000 F`, `15 000 FCFA`).

### 5. Page produit (`/boutique/[slug]`)
Fond blanc. Lien retour « ← Retour à la boutique ». Deux colonnes `auto-fit minmax(300px,1fr)`, gap `clamp(28px,4vw,72px)` :
- Gauche : visuel **4:5** avec badge en haut à gauche.
- Droite : famille en micro-label, H1 Playfair `clamp(32px,4.6vw,62px)`, description longue 16px poids 300 line-height 1.8, séparateur, « Ce qui est inclus » + liste à tirets, puis ligne d'achat : prix en Playfair 34px + bouton noir (« Ajouter au panier » / « Réserver ») + lien « Une question ? WhatsApp ».

### 6. À propos (`/a-propos`)
- En-tête : H1 « Des ***œuvres***, pas du contenu. »
- Deux colonnes : portrait studio **4:5** à gauche ; récit à droite (naissance de l'agence, refus de la vidéo tiède, zone d'intervention) + citation Playfair italique `clamp(22px,2.6vw,34px)` : « Le budget d'une vidéo n'est pas une dépense. C'est le prix du désir que vous créez. »
- **Méthode — section fond blanc** : 4 étapes numérotées 01→04 (Brief · Tournage · Étalonnage signature · Livraison), grille `auto-fit minmax(210px,1fr)`, chaque item `border-top: 1px solid #000`.
- Trois colonnes finales : **L'équipe** (Direction artistique & réalisation / Image & lumière / Post-production & étalonnage), **L'équipement** (Sony ZV-E1 plein format / optiques lumineuses & stabilisation / son & lumière), **Zone d'intervention** (Calavi Tankpè · Cotonou · Porto-Novo · Ouidah · Parakou) + lien « Nous écrire ».

### 7. Contact (`/contact`)
- En-tête : micro-label « Contact · Devis sous 24-48h », H1 « Dites-nous ce que vous voulez ***vendre***. »
- **Formulaire** (colonne gauche, gap 20px) : Nom complet (requis) · Email (requis, type email) · Téléphone / WhatsApp (optionnel) · Type de projet (select : Entreprise — abonnement mensuel / Immobilier — location courte durée / Mariage — film premium / Produit boutique (ebook / LUTs) / Autre) · Message (textarea 5 lignes, redimensionnable verticalement). Champs : fond `#0F0F0F`, bordure `#333`, texte blanc, 15px, padding 14px 16px, **rayon 0**. Label au-dessus en micro-label `#777`. Bouton submit pleine largeur, fond blanc, « Envoyer la demande ».
  - À la soumission : message de confirmation encadré (`border: 1px solid #333`, padding 16px) — « Demande enregistrée. Réponse sous 24-48h — pour aller plus vite, écrivez-nous sur WhatsApp. » En production, brancher un vrai endpoint + validation + états d'erreur et de chargement.
- **Colonne droite** : coordonnées en Playfair souligné (WhatsApp `clamp(22px,2.4vw,30px)`, email `clamp(20px,2.2vw,26px)`), réseaux, mention studio sur rendez-vous ; puis **« Comment démarrer »** en 4 étapes 01→04 : Contact · Devis 24-48h · Signature · Brief & tournage.

### 8. Panier (panneau latéral, global)
Overlay `rgba(0,0,0,.7)` + `blur(3px)` (clic = fermeture). Panneau à droite, largeur `min(430px, 100%)`, pleine hauteur, fond `#0A0A0A`, `border-left: 1px solid #1A1A1A`, animation `wc-fade` .45s.
- En-tête : « Panier · N » en micro-label + bouton « × ».
- Corps défilable : par ligne, vignette 64×64 en dégradé, titre 14px/500, « Quantité N » en micro-label, lien « Retirer », prix à droite. État vide : « Votre panier est vide. » (14px poids 300 `#777`).
- Pied : ligne Total (label micro + montant en Playfair 26px), puis CTA blanc pleine largeur **« Finaliser sur WhatsApp »** — message prérempli listant les articles, les quantités et le total.

### 9. Pages annexes livrées
- **`WeCreate Responsive.dc.html`** — page de revue : le site réel affiché dans trois cadres (mobile 390×780, tablette 834×900, desktop 1440×900), mis à l'échelle automatiquement pour tenir dans la largeur disponible, + les 4 règles de responsive. **Outil de revue interne, pas une page publique.**
- **`WeCreate 3D.dc.html`** — « Salle de projection » en three.js : 6 écrans de projets suspendus en cercle (rayon 6.4, hauteurs alternées), sol miroir (`MeshStandardMaterial`, roughness .42, metalness .85) + grille, halo central en sprite additif, brouillard `FogExp2 .022`, caméra orbitale (drag = rotation, molette = distance 7.5→20), rotation auto désactivable, clic sur un écran → fiche projet en panneau latéral. Textures générées en canvas (dégradé gris + bandeau sombre + titre). Optionnel/branding — à considérer comme une expérience à part, pas une page de conversion.

---

## Interactions & Behavior
- **Reveal au scroll** : `IntersectionObserver` (threshold .1, `rootMargin: 0px 0px -6% 0px`), une seule fois par élément (`unobserve` après déclenchement). État initial : `opacity 0` + `translateY(26px)` ; état final : `opacity 1` + `none`. Transition `.9s cubic-bezier(.16,1,.3,1)`. Cibles : titres de section, cartes, items de liste.
- **Header condensé** : `padding-block` 20px → 12px dès `scrollY > 40`.
- **Hover cartes** : translateY(-5/-6px) + bordure qui s'éclaircit (`#1A1A1A` → `#555` sur sombre, `#EEE` → `#000` sur clair).
- **Hover vignettes portfolio** : scale(1.05) en .7s ; en production, démarrer la lecture de l'aperçu vidéo (muet, boucle) et la stopper à la sortie. Respecter `prefers-reduced-motion` : désactiver reveals, marquee et autoplay.
- **Navigation** : changement de page → `window.scrollTo(0,0)`, fermeture du panier et de la lightbox.
- **Filtres portfolio / onglets boutique** : filtrage client instantané, sans rechargement ; le compteur « N projets » se met à jour.
- **Panier** : ajouter incrémente la quantité si l'article existe déjà et **ouvre le panneau** ; « Retirer » supprime la ligne entière.
- **Focus visible** : `outline: 2px solid #fff; outline-offset: 3px` sur fond sombre (prévoir l'équivalent `#000` sur les sections blanches). Sélection de texte : fond blanc, texte noir.
- **Accessibilité** : `alt` sur tous les médias, `aria-label` sur les boutons icônes (panier, logo), contrastes AA garantis par la palette (éviter `#555` sur `#0A0A0A` pour du texte porteur de sens), le letterbox et le grain sont en `pointer-events: none` + décoratifs.

## Responsive behavior
Mobile-first, tout en `clamp()` — aucun point de rupture arbitraire, sauf :
- **≤ 1120px** : le CTA « Réserver un appel » du header est masqué.
- **≤ 900px** : la nav devient défilable horizontalement et s'aligne à gauche ; le logo passe à l'icône seule.
- Toutes les grilles sont en `auto-fit` + `minmax()` : elles se réorganisent d'elles-mêmes (3 → 2 → 1 colonne).
- Le masonry portfolio est en `columns: 3 300px` (3 → 2 → 1 selon la largeur).
- Le tableau comparatif passe en `overflow-x: auto` (min-width 620px).

## State Management
State du prototype (à répartir entre routes et store dans le codebase) :

| Variable | Type | Rôle |
|---|---|---|
| `page` | enum | route courante — devient du routing réel |
| `filter` | `'Tous' \| 'Entreprises' \| 'Immobilier' \| 'Mariage'` | filtre portfolio (candidat à un query param `?cat=`) |
| `tab` | `'Ebooks & Guides' \| 'LUTs & Presets' \| 'Packs Services'` | onglet boutique (candidat à `?famille=`) |
| `cart` | `{ id, qty }[]` | panier — **en mémoire seulement dans le prototype** |
| `cartOpen` | boolean | panneau latéral |
| `lightbox` | projet \| null | lightbox portfolio |
| `product` | produit \| null | produit affiché sur la page détail |
| `scrolled` | boolean | header condensé (`scrollY > 40`) |
| `sent` | boolean | confirmation du formulaire de contact |

**Données à externaliser** : trois collections — `PROJETS` (titre, client, catégorie, type, ratio, description, rôle, livrables), `PRODUITS` (id, famille, titre, badge, prix, description courte, description longue, liste d'inclus), `SERVICES` (univers → packs : nom, prix, unité, cible, engagement, inclus, produit lié achetable). CMS recommandé (Sanity/Contentful/fichiers MDX) pour que le client gère projets et prix.

**À décider côté production** : persistance du panier (localStorage/cookie/session serveur — interdite dans le prototype), moyen de paiement (Mobile Money / carte / virement — marché béninois : prévoir MTN MoMo & Moov Money), livraison des fichiers numériques (liens signés à expiration pour les PDF et LUTs), envoi du formulaire de contact, et suivi analytics des clics WhatsApp.

## Assets
- `assets/logo-blanc.svg` — mot-symbole WeCreate, version blanche (header et footer sur fond sombre). Fourni par le client.
- `assets/logo-noir.svg` — version noire, pour tout fond clair.
- `assets/icone-blanc.svg` — icône « W » seule, blanche (header mobile ≤ 900px).
- `assets/icone-noir.svg` — icône « W » seule, noire.
- **Polices** : Playfair Display et Inter via Google Fonts (`preconnect` + une seule requête combinée). En production, préférer l'auto-hébergement avec `font-display: swap`.
- **Médias** : tous les visuels sont des **placeholders** (dégradés gris + libellé monospace). Ratios à respecter impérativement : **9:16** (verticales), **16:9** (horizontales), **4:5** (blocs univers, visuel produit), **4:3** (vignettes produit boutique). Fournir un `poster` pour chaque vidéo, MP4 (H.264) + WebM, `preload="metadata"`, `muted playsinline loop` pour les aperçus.

## Files
Dans ce bundle :
- `WeCreate.dc.html` — **le site principal** : les 6 pages, la page produit, le panier, la lightbox.
- `WeCreate Responsive.dc.html` — revue responsive (mobile / tablette / desktop).
- `WeCreate 3D.dc.html` — salle de projection three.js.
- `assets/` — logos et icônes SVG.
- `screens/` — captures des 6 pages (01 Accueil → 06 Contact).

Note : les fichiers `.dc.html` sont des prototypes générés par un outil de design ; le balisage et la logique sont lisibles directement mais leur structure (styles inline, classe de logique unique) est propre à l'outil et **ne doit pas être reproduite** dans le codebase cible.
