import type {
  DigitalProductCard,
  PortfolioProjectCard,
} from "../../../src/managed-content/types";

/**
 * Stand-in Portfolio Projects and Digital Products, for the tests that need a
 * populated homepage.
 *
 * They live here rather than in `src/` on purpose. WeCreate publishes only real,
 * approved work, so nothing that could be mistaken for a portfolio entry ships
 * in application source where a misconfigured deployment might serve it. Tests
 * seed these through the Managed Content hook, exactly as an editor would.
 *
 * The mixed 9:16 and 16:9 ratios and the whole-XOF prices come from the approved
 * design handoff and issue #1's canonical catalogue.
 */

export const SAMPLE_PORTFOLIO_PROJECTS: PortfolioProjectCard[] = [
  {
    id: "residence-aurora",
    title: "Résidence Aurora",
    client: "Aurora Stays",
    category: "Immobilier",
    href: "/portfolio",
    media: {
      ratio: "9 / 16",
      placeholderLabel: "9:16",
      imageUrl: null,
      alternativeText: "",
    },
  },
  {
    id: "maison-kekere",
    title: "Maison Kékéré",
    client: "Kékéré Design",
    category: "Entreprises",
    href: "/portfolio",
    media: {
      ratio: "16 / 9",
      placeholderLabel: "16:9",
      imageUrl: null,
      alternativeText: "",
    },
  },
  {
    id: "ayo-et-sika",
    title: "Ayo & Sika",
    client: "Mariage privé",
    category: "Mariage",
    href: "/portfolio",
    media: {
      ratio: "16 / 9",
      placeholderLabel: "16:9",
      imageUrl: null,
      alternativeText: "",
    },
  },
  {
    id: "tankpe-coffee",
    title: "Tankpè Coffee",
    client: "Tankpè Coffee",
    category: "Entreprises",
    href: "/portfolio",
    media: {
      ratio: "9 / 16",
      placeholderLabel: "9:16",
      imageUrl: null,
      alternativeText: "",
    },
  },
  {
    id: "villa-oceane",
    title: "Villa Océane",
    client: "Océane Rentals",
    category: "Immobilier",
    href: "/portfolio",
    media: {
      ratio: "16 / 9",
      placeholderLabel: "16:9",
      imageUrl: null,
      alternativeText: "",
    },
  },
  {
    id: "fashion-robe",
    title: "Fashion Robe",
    client: "Séance mariage",
    category: "Mariage",
    href: "/portfolio",
    media: {
      ratio: "9 / 16",
      placeholderLabel: "9:16",
      imageUrl: null,
      alternativeText: "",
    },
  },
];

export const SAMPLE_DIGITAL_PRODUCTS: DigitalProductCard[] = [
  {
    id: "color-grading-signature",
    title: "Color Grading Signature",
    badge: "PDF",
    description: "L'étalonnage cinéma de WeCreate, décomposé étape par étape.",
    priceXof: 15000,
    href: "/boutique",
    media: {
      ratio: "4 / 3",
      placeholderLabel: "couverture ebook",
      imageUrl: null,
      alternativeText: "",
    },
  },
  {
    id: "pack-lut-signature",
    title: "Pack LUT Signature WeCreate",
    badge: "Téléchargement",
    description: "Notre étalonnage maison, en 10 LUTs .cube.",
    priceXof: 20000,
    href: "/boutique",
    media: {
      ratio: "4 / 3",
      placeholderLabel: "aperçu LUT",
      imageUrl: null,
      alternativeText: "",
    },
  },
  {
    id: "manuel-createur-mobile",
    title: "Le Manuel du Créateur Mobile",
    badge: "PDF",
    description: "Tourner en qualité pro avec un smartphone.",
    priceXof: 10000,
    href: "/boutique",
    media: {
      ratio: "4 / 3",
      placeholderLabel: "couverture ebook",
      imageUrl: null,
      alternativeText: "",
    },
  },
];

/** The optional hero loop, for the tests that exercise playback behaviour. */
export const SAMPLE_HERO_PLAYBACK = {
  posterUrl: "/brand/logo-noir.svg",
  alternativeText: "",
  sources: [{ src: "/sample-hero.mp4", type: "video/mp4" }],
};
