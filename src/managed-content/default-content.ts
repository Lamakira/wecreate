import type { SiteContent } from "./types";

const WHATSAPP_URL = "https://wa.me/2290167366726";

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
};
