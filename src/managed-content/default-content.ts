import type {
  AboutContent,
  ContactContent,
  ServicesContent,
  SiteContent,
} from "./types";

const WHATSAPP_URL = "https://wa.me/2290167366726";
/**
 * WeCreate's hosted 30-minute Discovery Call. A default an editor replaces in
 * the Studio once the production Calendly account exists; the site never loads
 * Calendly's own script, so a wrong address is a broken link and nothing more.
 */
const DISCOVERY_CALL_URL = "https://calendly.com/wecreate-bj/30min";

/**
 * Every commercial value below comes from the project brief (`docs/BRIEF-PROJET
 * -Site-WeCreate.md`, §6.4 and §7), which issue #1 makes authoritative wherever
 * it disagrees with the design prototype. The prototype's contradictory numbers
 * — 16 videos a month on Domination, its shooting-day and drone comparison
 * rows, and its six invented add-on prices — are deliberately not here.
 *
 * Payment conditions are shown because a prospective client needs them before a
 * conversation. Nothing on the site computes or collects them: a service offer
 * ends in WhatsApp or a Discovery Call, never in a cart (ADR-0006).
 */
const SERVICES_CONTENT: ServicesContent = {
  seo: {
    title: "Services",
    description:
      "Les packs vidéo WeCreate pour les entreprises, l'immobilier et le mariage : tarifs en FCFA, inclus détaillés, engagement et conditions de paiement. Chaque offre ouvre une conversation, pas une commande.",
    openGraphImageUrl: null,
  },
  kicker: "Services · Trois univers",
  headline: { lead: "La méthode ", emphasis: "WeCreate", trail: "." },
  methodColumns: [
    "On commence par comprendre ce que vous vendez et à qui. Ensuite on écrit. Puis on tourne — plein format, lumière travaillée, son propre.",
    "L'étalonnage signature vient à la fin : c'est là que l'image devient reconnaissable. Rien n'est laissé au hasard, jamais de gabarit.",
    "Livraison en 5 jours ouvrés, formats prêts à publier. Devis sous 24-48h, tarifs en FCFA, tout est écrit.",
  ],
  onRequestLabel: "Sur demande",
  enquiry: {
    title: "Comment on démarre",
    notice:
      "Écrire sur WhatsApp ou réserver un appel découverte est une demande de service : le site ne prend aucune commande, ne bloque aucune date et n'encaisse aucun paiement pour les prestations. Le devis, le planning et les conditions se décident ensemble, pendant la conversation.",
    whatsappLabel: "Demander un devis",
    whatsappMessageTemplate:
      "Bonjour WeCreate. Je vous écris au sujet de %s. Pouvons-nous en parler ?",
    discoveryCallLabel: "Appel découverte · 30 min",
    discoveryCallNote:
      "L'appel s'ouvre sur le calendrier de WeCreate, dans un nouvel onglet. Si le calendrier est lent ou indisponible, WhatsApp reste la voie la plus directe.",
  },
  universes: [
    {
      key: "entreprises",
      kicker: "Abonnements mensuels",
      title: "Entreprises",
      intro:
        "Une présence vidéo constante, pas un one-shot. On prend en charge le planning, le tournage et l'étalonnage.",
      packs: [
        {
          id: "entreprises-presence",
          name: "Pack Présence",
          priceXof: 350000,
          priceUnit: "par mois",
          isOnRequest: false,
          audience: "TPE, commerces, marques qui démarrent",
          commitment: "3 mois",
          paymentTerms:
            "100 % du premier mois à la signature, puis mensuel d'avance.",
          inclusions: [
            "4 vidéos verticales cinéma 30-60s par mois",
            "Étalonnage signature",
            "Musique sous licence",
            "1 cycle de retouches",
            "2 demi-journées de tournage",
            "Livraison en 5 jours ouvrés",
            "Stockage des rushes 3 mois",
          ],
        },
        {
          id: "entreprises-croissance",
          name: "Pack Croissance",
          priceXof: 650000,
          priceUnit: "par mois",
          isOnRequest: false,
          audience: "PME et marques en développement",
          commitment: "6 mois",
          paymentTerms:
            "100 % du premier mois à la signature, puis mensuel d'avance.",
          inclusions: [
            "8 vidéos par mois",
            "3 photos HD",
            "2 variantes par mois",
            "1 vidéo pub cinéma 60-90s par trimestre, concept, voix off et casting compris",
            "2 cycles de retouches",
            "4 demi-journées de tournage",
            "Brief d'1h et bilan trimestriel",
            "Stockage des rushes 6 mois",
          ],
        },
        {
          id: "entreprises-domination",
          name: "Pack Domination",
          priceXof: 1200000,
          priceUnit: "par mois",
          isOnRequest: false,
          audience: "Groupes, franchises, marques leaders",
          commitment: "12 mois",
          paymentTerms:
            "100 % du premier mois à la signature, puis mensuel d'avance.",
          inclusions: [
            "12 vidéos par mois, verticales et horizontales",
            "10 photos HD",
            "4 variantes par mois",
            "1 vidéo pub cinéma 90-120s par trimestre, multilingue possible",
            "2 couvertures événementielles par an",
            "Délais express : 3 jours pour les vidéos, 7 jours pour les films",
            "WhatsApp prioritaire et bilan annuel de 3h",
            "Stockage des rushes 12 mois",
          ],
        },
      ],
    },
    {
      key: "immobilier",
      kicker: "Location courte durée",
      title: "Immobilier",
      intro:
        "Les biens ne se louent pas sur des photos plates. On filme le désir : lumière, matière, sensation d'habiter.",
      packs: [
        {
          id: "immobilier-visite-premium",
          name: "Pack Visite Premium",
          priceXof: 120000,
          priceUnit: "à l'unité",
          isOnRequest: false,
          audience: "Propriétaires, un bien à valoriser",
          commitment: "Prestation ponctuelle",
          paymentTerms: "50 % à la réservation, 50 % à la livraison.",
          inclusions: [
            "1 vidéo verticale 60-90s au format 9:16",
            "Étalonnage cinéma",
            "Musique sous licence",
            "1 cycle de retouches",
            "Tournage de 2 à 3h en plein format Sony ZV-E1",
            "Livraison en 5 jours ouvrés",
          ],
        },
        {
          id: "immobilier-gestionnaire-pro",
          name: "Pack Gestionnaire Pro",
          priceXof: 320000,
          priceUnit: "par mois",
          isOnRequest: false,
          audience: "Gestionnaires de 3 à 8 biens",
          commitment: "3 mois",
          paymentTerms:
            "100 % du premier mois à la signature, puis mensuel d'avance.",
          inclusions: [
            "3 vidéos par mois",
            "Drone inclus",
            "3 photos HD par bien",
            "2 cycles de retouches",
            "Livraison en 4 jours",
          ],
        },
        {
          id: "immobilier-gestionnaire-empire",
          name: "Pack Gestionnaire Empire",
          priceXof: 600000,
          priceUnit: "par mois",
          isOnRequest: false,
          audience: "Portefeuilles de 8 biens et plus",
          commitment: "6 mois",
          paymentTerms:
            "100 % du premier mois à la signature, puis mensuel d'avance.",
          inclusions: [
            "6 vidéos par mois",
            "Drone inclus",
            "5 photos HD par bien",
            "3 cycles de retouches",
            "1 livraison express 48h par mois",
            "Conseil trimestriel",
            "Livraison en 3 jours",
          ],
        },
      ],
    },
    {
      key: "mariage",
      kicker: "Films premium",
      title: "Mariage",
      intro:
        "Un mariage ne se rejoue pas. On le traite comme un film : intention, silence, émotion — jamais du montage automatique.",
      packs: [
        {
          id: "mariage-souvenir",
          name: "Pack Souvenir",
          priceXof: 400000,
          priceUnit: "",
          isOnRequest: false,
          audience: "Cérémonies intimes",
          commitment: "Prestation ponctuelle",
          paymentTerms:
            "70 % à la réservation, la date est alors bloquée. 30 % à la livraison.",
          inclusions: [
            "1 récap cinéma de 3 à 5 min au format 16:9",
            "Version verticale",
            "Teaser 30s",
            "5 photos HD",
            "Étalonnage cinéma",
          ],
        },
        {
          id: "mariage-elegance",
          name: "Pack Élégance",
          priceXof: 750000,
          priceUnit: "",
          isOnRequest: false,
          audience: "Mariages complets",
          commitment: "Prestation ponctuelle",
          paymentTerms:
            "70 % à la réservation, la date est alors bloquée. 30 % à la livraison.",
          inclusions: [
            "Tout le pack Souvenir",
            "Séance Fashion Robe de 3h",
            "Vidéo fashion 60-90s",
            "Version horizontale",
            "5 photos éditoriales",
            "Direction artistique",
          ],
        },
        {
          id: "mariage-heritage",
          name: "Pack Héritage",
          priceXof: 1200000,
          priceUnit: "",
          isOnRequest: false,
          audience: "Mariages sur trois cérémonies",
          commitment: "Prestation ponctuelle",
          paymentTerms:
            "70 % à la réservation, la date est alors bloquée. 30 % à la livraison.",
          inclusions: [
            "Couverture de 3 cérémonies",
            "Récap global de 6 à 8 min",
            "3 récaps individuels",
            "Film fashion",
            "5 verticales et 4 teasers",
            "15 photos HD",
            "2e cameraman au religieux",
          ],
        },
        {
          id: "mariage-wedding-film-signature",
          name: "Wedding Film Signature",
          priceXof: 2000000,
          priceUnit: "",
          isOnRequest: true,
          audience: "Une œuvre, sur mesure",
          commitment: "Prestation ponctuelle",
          paymentTerms:
            "70 % à la réservation, la date est alors bloquée. 30 % à la livraison.",
          inclusions: [
            "Œuvre narrative de 10 à 15 min",
            "Highlight et récaps",
            "6 verticales et 5 teasers",
            "25 photos éditoriales",
            "Wedding Reveal Screening privé",
          ],
        },
      ],
    },
  ],
  comparison: {
    isVisible: true,
    kicker: "Comparatif · Abonnements Entreprises",
    title: "Choisir son rythme",
    caption: "Comparatif des trois abonnements Entreprises",
    columns: ["Pack Présence", "Pack Croissance", "Pack Domination"],
    rows: [
      {
        key: "prix",
        label: "Prix mensuel",
        values: ["350 000 F", "650 000 F", "1 200 000 F"],
      },
      { key: "videos", label: "Vidéos par mois", values: ["4", "8", "12"] },
      { key: "photos", label: "Photos HD", values: ["—", "3", "10"] },
      {
        key: "film-de-marque",
        label: "Vidéo pub cinéma",
        values: [
          "—",
          "1 par trimestre, 60-90s",
          "1 par trimestre, 90-120s, multilingue possible",
        ],
      },
      {
        key: "evenementiel",
        label: "Couvertures événementielles",
        values: ["—", "—", "2 par an"],
      },
      { key: "variantes", label: "Variantes par mois", values: ["—", "2", "4"] },
      {
        key: "delais",
        label: "Délais de livraison",
        values: [
          "5 jours ouvrés",
          "5 jours ouvrés",
          "Express : 3 jours, 7 jours pour les films",
        ],
      },
      {
        key: "bilans",
        label: "Bilans",
        values: ["—", "Bilan trimestriel", "Bilan annuel de 3h"],
      },
      {
        key: "stockage",
        label: "Stockage des rushes",
        values: ["3 mois", "6 mois", "12 mois"],
      },
      {
        key: "engagement",
        label: "Engagement minimum",
        values: ["3 mois", "6 mois", "12 mois"],
      },
    ],
  },
  addOns: {
    isVisible: true,
    kicker: "Add-ons",
    title: "À ajouter à n'importe quel pack",
    addOns: [
      {
        key: "drone-entreprise",
        title: "Drone — entreprises et immobilier",
        priceXof: 50000,
        priceUnit: "par vidéo",
        description: "Autorisations, pilote, plans aériens étalonnés.",
      },
      {
        key: "drone-mariage",
        title: "Drone — mariage",
        priceXof: 100000,
        priceUnit: "une cérémonie",
        description: "Les plans aériens de la journée, sur une cérémonie.",
      },
      {
        key: "drone-mariage-multiple",
        title: "Drone — mariage, plusieurs cérémonies",
        priceXof: 200000,
        priceUnit: "",
        description: "Les mêmes plans aériens, sur l'ensemble des cérémonies.",
      },
      {
        key: "fichiers-raw",
        title: "Fichiers sources RAW",
        priceXof: 50000,
        priceUnit: "par projet",
        description: "Les rushes bruts, livrés en fin de projet.",
      },
      {
        key: "photos-dediees",
        title: "Séance photos dédiée",
        priceXof: 50000,
        priceUnit: "",
        description: "Immobilier : un passage photo en plus du tournage.",
      },
      {
        key: "ambiance-soir",
        title: "Tournage ambiance soir",
        priceXof: 30000,
        priceUnit: "",
        description: "Une seconde passe à la tombée de la nuit.",
      },
      {
        key: "voix-off",
        title: "Voix off française professionnelle",
        priceXof: 25000,
        priceUnit: "",
        description: "Comédien voix, direction de jeu et mixage.",
      },
      {
        key: "version-horizontale",
        title: "Version horizontale 16:9",
        priceXof: 20000,
        priceUnit: "",
        description: "Le même film remonté pour le web et YouTube.",
      },
      {
        key: "express-48h",
        title: "Livraison express 48h",
        priceXof: 30000,
        priceUnit: "",
        description: "Priorité absolue sur le planning de post-production.",
      },
      {
        key: "fashion-robe",
        title: "Séance Fashion Robe",
        priceXof: 250000,
        priceUnit: "",
        description: "Une séance dédiée à la robe, en studio ou en extérieur.",
      },
      {
        key: "tiktok-couple",
        title: "Challenge ou transition TikTok couple",
        priceXof: 150000,
        priceUnit: "",
        description: "Une vidéo pensée pour les réseaux, tournée le jour J.",
      },
      {
        key: "teaser-supplementaire",
        title: "Teaser 30s supplémentaire",
        priceXof: 100000,
        priceUnit: "",
        description: "Un second teaser, monté pour une autre plateforme.",
      },
    ],
  },
};

/**
 * À propos: WeCreate's story, its method, what it is made of and where it works.
 *
 * The narrative, the method steps, the roles, the kit and the coverage area are
 * the design handoff's approved copy, which the brief asks À propos to carry
 * (§3: histoire, philosophie, méthode, équipement, zone d'intervention) without
 * dictating its words.
 *
 * Two things the prototype had are deliberately not here:
 *
 * - **Its brand quote.** "Le budget d'une vidéo n'est pas une dépense. C'est le
 *   prix du désir que vous créez." is a claim about what WeCreate's prices mean,
 *   and issue #1 makes the brief authoritative for commercial content. The brief
 *   does not contain it. The statement below is the brief's own promise, which
 *   WeCreate has approved.
 * - **Named people.** The team block lists roles, and `Capability` has no field
 *   for a person at all: a name shipped in source would read to a visitor
 *   exactly like an approved one.
 *
 * The portrait is a `MediaFrameContent` with no image, so it renders the design
 * handoff's labelled grey frame at 4:5 — visibly a slot awaiting a photograph
 * rather than a photograph.
 */
const ABOUT_CONTENT: AboutContent = {
  seo: {
    title: "À propos",
    description:
      "WeCreate, studio de production vidéo cinématographique à Calavi Tankpè : notre histoire, notre méthode, notre équipe, notre matériel et notre zone d'intervention au Bénin.",
    openGraphImageUrl: null,
  },
  kicker: "À propos · Studio à Calavi Tankpè",
  headline: { lead: "Des ", emphasis: "œuvres", trail: ", pas du contenu." },
  story: {
    paragraphs: [
      "WeCreate est né d'un refus : celui de la vidéo tiède. Au Bénin, presque tout le monde « fait du contenu ». Nous fabriquons des images qui marquent — parce qu'une image qui marque est une image qui vend.",
      "Le studio est basé à Calavi Tankpè. Nous intervenons partout au Bénin : Cotonou, Porto-Novo, Ouidah, Parakou, et à l'international sur devis.",
    ],
    brandStatement:
      "« On ne capture pas des images. On fabrique des œuvres qui font vendre. »",
    portrait: {
      ratio: "4 / 5",
      placeholderLabel: "portrait studio · 4:5",
      imageUrl: null,
      alternativeText: "",
    },
  },
  method: {
    isVisible: true,
    kicker: "La méthode",
    title: "Brief, tournage, étalonnage, livraison",
    steps: [
      {
        key: "brief",
        title: "Brief",
        description:
          "Ce que vous vendez, à qui, et ce que la vidéo doit déclencher. Puis on écrit.",
      },
      {
        key: "tournage",
        title: "Tournage",
        description:
          "Plein format, optiques lumineuses, son dédié, mise en scène assumée.",
      },
      {
        key: "etalonnage",
        title: "Étalonnage signature",
        description:
          "La couleur WeCreate, construite plan par plan. Notre empreinte.",
      },
      {
        key: "livraison",
        title: "Livraison",
        description: "5 jours ouvrés. Tous les formats, prêts à publier.",
      },
    ],
  },
  team: {
    kicker: "L'équipe",
    items: [
      {
        key: "direction-artistique",
        title: "Direction artistique & réalisation",
        description: "Écriture, découpage, direction de personnes.",
      },
      {
        key: "image-lumiere",
        title: "Image & lumière",
        description: "Cadre, exposition, gestion de la lumière disponible.",
      },
      {
        key: "post-production",
        title: "Post-production & étalonnage",
        description: "Montage, son, couleur signature, LUTs maison.",
      },
    ],
  },
  equipment: {
    kicker: "L'équipement",
    items: [
      {
        key: "boitier",
        title: "Sony ZV-E1 — plein format",
        description: "Basses lumières, S-Log3, stabilisation active.",
      },
      {
        key: "optiques",
        title: "Optiques lumineuses & stabilisation",
        description: "Focales fixes, gimbal, slider.",
      },
      {
        key: "son-lumiere",
        title: "Son & lumière",
        description: "Micros HF, enregistreur, panneaux LED bi-color.",
      },
    ],
  },
  coverage: {
    kicker: "Zone d'intervention",
    text: "Calavi Tankpè · Cotonou · Porto-Novo · Ouidah · Parakou. Tout le Bénin, et au-delà sur devis.",
    link: { label: "Nous écrire", href: "/contact" },
  },
};

/**
 * Contact: the three channels WeCreate answers on, and how a project starts.
 *
 * The design prototype put a five-field form here and confirmed submissions with
 * "Demande enregistrée". Issue #1 removed it: version one takes no generic
 * service enquiry and stores no lead, so this page carries three ordinary links
 * and nothing that submits.
 *
 * The addresses themselves live on `settings.contact` — the same values the
 * header, the footer and every service pack use — so the only thing written
 * twice on this page is what each channel is *for*.
 */
const CONTACT_CONTENT: ContactContent = {
  seo: {
    title: "Contact",
    description:
      "Écrire à WeCreate : WhatsApp, appel découverte de 30 minutes ou email. Devis sous 24-48h, studio à Calavi Tankpè, Bénin.",
    openGraphImageUrl: null,
  },
  kicker: "Contact · Devis sous 24-48h",
  headline: {
    lead: "Dites-nous ce que vous voulez ",
    emphasis: "vendre",
    trail: ".",
  },
  // What WeCreate answers in, and nothing about what it delivers in: the brief
  // sets delivery per pack — three days on Gestionnaire Empire, four on
  // Gestionnaire Pro, five elsewhere — so a single figure stated here would be
  // a commitment WeCreate never made. Services prints each pack's own.
  responseExpectation: "Devis sous 24-48h.",
  channels: {
    kicker: "Coordonnées",
    notice:
      "Nous écrire ouvre une conversation, rien de plus : ce site n'enregistre aucune demande, ne bloque aucune date et n'encaisse aucun paiement pour les prestations. Le devis, le planning et les conditions se décident ensemble.",
    whatsappNote:
      "La voie la plus directe. Décrivez le projet en trois lignes, nous répondons dans la journée ouvrée.",
    discoveryCallNote:
      "30 minutes pour cadrer le projet. Le calendrier de WeCreate s'ouvre dans un nouvel onglet ; s'il est lent ou indisponible, WhatsApp reste ouvert.",
    emailLabel: "Email administratif",
    emailNote:
      "Factures, documents, questions administratives. Pour un projet, WhatsApp va plus vite.",
    socialKicker: "Réseaux",
    locationNote: "Studio à Calavi Tankpè, Bénin — sur rendez-vous.",
  },
  gettingStarted: {
    kicker: "Comment démarrer",
    steps: [
      {
        key: "contact",
        title: "Contact",
        description:
          "WhatsApp ou appel découverte. Vous décrivez le projet en trois lignes.",
      },
      {
        key: "devis",
        title: "Devis sous 24-48h",
        description:
          "Une proposition claire : périmètre, livrables, prix en FCFA, délais.",
      },
      {
        key: "signature",
        title: "Signature",
        description:
          "Validation et acompte, hors site. Le créneau de tournage est alors bloqué.",
      },
      {
        key: "tournage",
        title: "Brief & tournage",
        description: "Brief créatif, repérage si besoin, puis on tourne.",
      },
    ],
  },
};

/**
 * The canonical starting state of WeCreate's Managed Content.
 *
 * Copy comes from the approved design handoff, corrected where the canonical
 * specification (issue #1) supersedes the prototype:
 *
 * - the Boutique holds Digital Products only, so no service pack appears here;
 * - Entreprises deliver 4 to 12 videos a month, not the prototype's 4 to 16;
 * - the removed contact form is replaced by a plain link to Contact.
 *
 * It is used two ways: the fixture provider serves it directly, and the Sanity
 * provider overlays the dataset on top of it, so a field an editor has not
 * filled in falls back to the baseline instead of rendering blank.
 *
 * It contains no Portfolio Projects and no Digital Products. Those are real,
 * approved work; a sample entry shipped in source could reach a public page
 * through a misconfigured deployment, so the sections start empty and say so.
 * Test fixtures supply their own — see `tests/e2e/support/sample-content.ts`.
 */
export const DEFAULT_SITE_CONTENT: SiteContent = {
  settings: {
    brandName: "WeCreate",
    positioningLine: "Premium · Cinématographique · Différent",
    navigation: [
      { label: "Accueil", href: "/" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Services", href: "/services" },
      { label: "Boutique", href: "/boutique" },
      { label: "À propos", href: "/a-propos" },
      { label: "Contact", href: "/contact" },
    ],
    headerCta: {
      label: "Réserver un appel",
      href: WHATSAPP_URL,
    },
    contact: {
      whatsappLabel: "WhatsApp +229 01 67 36 67 26",
      whatsappUrl: WHATSAPP_URL,
      discoveryCallLabel: "Réserver un appel découverte",
      discoveryCallUrl: DISCOVERY_CALL_URL,
      email: "wecreate08@gmail.com",
      locationLabel: "Calavi Tankpè, Bénin",
    },
    socialAccounts: [
      { label: "Instagram @wecreate.bj", url: "https://instagram.com/wecreate.bj" },
      { label: "TikTok @wecreate.bj", url: "https://tiktok.com/@wecreate.bj" },
    ],
    footer: {
      baseline:
        "On ne capture pas des images. On fabrique des œuvres qui font vendre.",
      navigationHeading: "Navigation",
      contactHeading: "Contact",
      socialHeading: "Réseaux",
      legalLine: "WeCreate — Calavi Tankpè, Bénin",
    },
    seo: {
      siteName: "WeCreate",
      titleTemplate: "%s · WeCreate",
      defaultTitle:
        "WeCreate — Production vidéo cinématographique à Calavi Tankpè",
      defaultDescription:
        "Agence de production vidéo cinématographique à Calavi Tankpè, Bénin. Entreprises, immobilier, mariage : écriture, tournage plein format et étalonnage signature.",
      openGraphImageUrl: null,
      openGraphLocale: "fr_BJ",
    },
  },
  homePage: {
    seo: {
      title: "WeCreate — Production vidéo cinématographique",
      description:
        "On ne capture pas des images. Écriture, mise en scène, plein format, étalonnage signature — chaque vidéo est traitée comme une œuvre.",
      openGraphImageUrl: null,
    },
    hero: {
      kicker: "Production vidéo cinématographique",
      headline: {
        lead: "Nous fabriquons des ",
        emphasis: "œuvres",
        trail: " qui font vendre.",
      },
      subtitle:
        "On ne capture pas des images. Écriture, mise en scène, plein format, étalonnage signature — chaque vidéo est traitée comme une œuvre.",
      primaryCta: {
        label: "Voir le portfolio",
        href: "/portfolio",
      },
      secondaryCta: {
        label: "Découvrir la boutique",
        href: "/boutique",
      },
      playbackAsset: null,
    },
    positioningMarquee: {
      isVisible: true,
      text: "Premium · Cinématographique · Différent",
    },
    universes: {
      isVisible: true,
      title: "Ce qu'on fait",
      kicker: "Trois univers · une seule exigence",
      universes: [
        {
          key: "entreprises",
          kicker: "Abonnements mensuels",
          title: "Entreprises",
          description:
            "Une présence vidéo constante : 4 à 12 vidéos par mois, étalonnées, planifiées, livrées.",
          linkLabel: "Voir les packs",
          href: "/services",
          media: {
            ratio: "4 / 5",
            placeholderLabel: "loop entreprise",
            imageUrl: null,
            alternativeText: "",
          },
        },
        {
          key: "immobilier",
          kicker: "Location courte durée",
          title: "Immobilier",
          description:
            "Des biens filmés comme des décors. On ne montre pas des pièces, on vend une envie.",
          linkLabel: "Voir les packs",
          href: "/services",
          media: {
            ratio: "4 / 5",
            placeholderLabel: "loop immobilier",
            imageUrl: null,
            alternativeText: "",
          },
        },
        {
          key: "mariage",
          kicker: "Films premium",
          title: "Mariage",
          description:
            "Des films qu'on regarde encore dans dix ans. Écriture, mise en scène, émotion.",
          linkLabel: "Voir les packs",
          href: "/services",
          media: {
            ratio: "4 / 5",
            placeholderLabel: "loop mariage",
            imageUrl: null,
            alternativeText: "",
          },
        },
      ],
    },
    recentWork: {
      isVisible: true,
      headline: { lead: "Travaux ", emphasis: "récents", trail: "" },
      link: { label: "Tout le portfolio", href: "/portfolio" },
      emptyStateText:
        "Les projets publiés apparaîtront ici dès leur mise en ligne.",
    },
    proof: {
      isVisible: true,
      kicker: "La différence WeCreate",
      points: [
        {
          key: "delai",
          figure: "5 jours",
          description:
            "Livraison en 5 jours ouvrés après le tournage. Sans relance.",
        },
        {
          key: "materiel",
          figure: "Plein format",
          description:
            "Sony ZV-E1, optiques lumineuses, son dédié. Pas de compromis technique.",
        },
        {
          key: "etalonnage",
          figure: "Étalonnage signature",
          description:
            "Une couleur reconnaissable, construite plan par plan. C'est notre empreinte.",
        },
        {
          key: "univers",
          figure: "3 univers",
          description:
            "Entreprises, immobilier, mariage. Une seule exigence : l'œuvre.",
        },
      ],
    },
    shopPreview: {
      isVisible: true,
      title: "La boutique",
      link: { label: "Tout voir", href: "/boutique" },
      linkLabel: "Voir le détail",
      products: [],
      emptyStateText:
        "Les produits numériques apparaîtront ici dès leur mise en vente.",
    },
    brandQuote: {
      isVisible: true,
      quote:
        "« Ils n'ont pas filmé nos appartements. Ils les ont rendus désirables. »",
      attribution: "Gestionnaire de résidences · Cotonou",
    },
    finalCta: {
      isVisible: true,
      headline: { lead: "Parlons de votre ", emphasis: "projet", trail: "." },
      subtitle: "Devis sous 24-48h. Livraison en 5 jours ouvrés.",
      primaryCta: {
        label: "WhatsApp",
        href: WHATSAPP_URL,
      },
      secondaryCta: {
        label: "Nous contacter",
        href: "/contact",
      },
    },
  },
  portfolio: {
    seo: {
      title: "Portfolio",
      description:
        "Les films de WeCreate pour les entreprises, l'immobilier et les mariages : écriture, tournage plein format, étalonnage signature.",
      openGraphImageUrl: null,
    },
    kicker: "Portfolio",
    headline: { lead: "Chaque projet, une ", emphasis: "œuvre", trail: "." },
    allUniversesLabel: "Tous",
    emptyStateText:
      "Les projets publiés apparaîtront ici dès leur mise en ligne.",
    projects: [],
  },
  services: SERVICES_CONTENT,
  about: ABOUT_CONTENT,
  contact: CONTACT_CONTENT,
};
