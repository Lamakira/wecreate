import type {
  DigitalProductCard,
  PlaybackAsset,
  PortfolioProject,
} from "../../../src/managed-content/types";

/**
 * Stand-in Portfolio Projects and Digital Products, for the tests that need a
 * populated site.
 *
 * They live here rather than in `src/` on purpose. WeCreate publishes only real,
 * approved work, so nothing that could be mistaken for a portfolio entry ships
 * in application source where a misconfigured deployment might serve it. Tests
 * seed these through the Managed Content hook, exactly as an editor would.
 *
 * The mixed 9:16 and 16:9 ratios, the project copy and the whole-XOF prices come
 * from the approved design handoff and issue #1's canonical catalogue.
 */

/**
 * A Playback Asset as a plain file rather than an adaptive stream.
 *
 * This is the shape the acceptance suite runs on: same-origin, no vendor, no
 * credentials, and no request leaving the test browser. `streamId` is what tells
 * the player it is looking at a stream instead — production assets carry one and
 * these do not, which is the only difference between the two paths.
 *
 * The media addresses below are never fetched, and no file backs them. Both the
 * player and the hover preview are `preload="none"`, so the browser asks for
 * bytes only once playback starts — which is itself the behaviour under test.
 * What the suite covers is which element exists, when, and how it behaves;
 * decoding real video is Mux's job and is verified against Mux, not here.
 */
function samplePlayback(posterUrl: string): PlaybackAsset {
  return {
    streamId: null,
    posterUrl,
    alternativeText: "Extrait du film, image d'ouverture.",
    sources: [{ src: "/sample-project.mp4", type: "video/mp4" }],
    preview: { src: "/sample-preview.mp4", type: "video/mp4" },
    captions: [],
  };
}

/** The one image the acceptance suite has: a same-origin brand asset. */
const SAMPLE_POSTER = "/brand/logo-noir.svg";

export const SAMPLE_PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    id: "residence-aurora",
    slug: "residence-aurora",
    title: "Résidence Aurora",
    client: "Aurora Stays",
    universe: "Immobilier",
    projectType: "Visite premium",
    description:
      "Trois appartements meublés filmés comme des décors de film. Objectif : remplir le calendrier de réservations en basse saison.",
    role: "Écriture, tournage plein format, étalonnage signature, montage vertical.",
    deliverables: ["1 film 60s", "3 verticales 9:16", "12 photos extraites"],
    media: {
      ratio: "9 / 16",
      placeholderLabel: "9:16",
      imageUrl: null,
      alternativeText: "",
    },
    playbackAsset: samplePlayback(SAMPLE_POSTER),
    hasPublicationPermission: true,
    spokenContent: "none",
    transcript: null,
  },
  {
    id: "maison-kekere",
    slug: "maison-kekere",
    title: "Maison Kékéré",
    client: "Kékéré Design",
    universe: "Entreprises",
    projectType: "Film de marque",
    description:
      "Portrait d'atelier : la matière, la main, le geste. Un film de marque qui installe le prix.",
    role: "Direction artistique, réalisation, son, étalonnage.",
    deliverables: ["1 film 90s", "4 coupes réseaux", "Pack photos"],
    media: {
      ratio: "16 / 9",
      placeholderLabel: "16:9",
      imageUrl: null,
      alternativeText: "",
    },
    playbackAsset: samplePlayback(SAMPLE_POSTER),
    hasPublicationPermission: true,
    spokenContent: "none",
    transcript: null,
  },
  {
    id: "ayo-et-sika",
    slug: "ayo-et-sika",
    title: "Ayo & Sika",
    client: "Mariage privé",
    universe: "Mariage",
    projectType: "Wedding Film Signature",
    description:
      "Un film de mariage traité comme un long-métrage court : lumière naturelle, voix off, montage émotionnel.",
    role: "Deux caméras, captation son, teaser, film long.",
    deliverables: ["Film 8 min", "Teaser 60s", "Reel vertical"],
    media: {
      ratio: "16 / 9",
      placeholderLabel: "16:9",
      imageUrl: null,
      alternativeText: "",
    },
    // The one project here whose speech carries meaning: it has a voice-over,
    // so it may only be published with a transcript beside it.
    playbackAsset: samplePlayback(SAMPLE_POSTER),
    hasPublicationPermission: true,
    spokenContent: "transcript",
    transcript:
      "Voix off — « On s'est rencontrés un mardi. Personne n'avait prévu que ça durerait. »",
  },
  {
    id: "tankpe-coffee",
    slug: "tankpe-coffee",
    title: "Tankpè Coffee",
    client: "Tankpè Coffee",
    universe: "Entreprises",
    projectType: "Abonnement mensuel",
    description:
      "Huit verticales par mois, un seul jour de tournage. Constance et qualité cinéma.",
    role: "Planning éditorial, tournage, étalonnage, livraison hebdomadaire.",
    deliverables: ["8 verticales 9:16 par mois"],
    media: {
      ratio: "9 / 16",
      placeholderLabel: "9:16",
      imageUrl: null,
      alternativeText: "",
    },
    playbackAsset: samplePlayback(SAMPLE_POSTER),
    hasPublicationPermission: true,
    spokenContent: "none",
    transcript: null,
  },
  {
    id: "villa-oceane",
    slug: "villa-oceane",
    title: "Villa Océane",
    client: "Océane Rentals",
    universe: "Immobilier",
    projectType: "Gestionnaire Pro",
    description:
      "Une villa en location courte durée, filmée à l'heure dorée. Le taux d'occupation a suivi.",
    role: "Repérage, tournage drone, étalonnage.",
    deliverables: ["1 film 45s", "2 verticales", "Plans drone"],
    media: {
      ratio: "16 / 9",
      placeholderLabel: "16:9",
      imageUrl: null,
      alternativeText: "",
    },
    playbackAsset: samplePlayback(SAMPLE_POSTER),
    hasPublicationPermission: true,
    spokenContent: "none",
    transcript: null,
  },
  {
    id: "fashion-robe",
    slug: "fashion-robe",
    title: "Fashion Robe",
    client: "Séance mariage",
    universe: "Mariage",
    projectType: "Add-on Fashion Robe",
    description: "La robe comme sujet principal. Mouvement, tissu, silence.",
    role: "Mise en scène, tournage, étalonnage.",
    deliverables: ["1 reel 30s", "8 photos"],
    media: {
      ratio: "9 / 16",
      placeholderLabel: "9:16",
      imageUrl: null,
      alternativeText: "",
    },
    playbackAsset: samplePlayback(SAMPLE_POSTER),
    hasPublicationPermission: true,
    spokenContent: "none",
    transcript: null,
  },
];

/**
 * A seventh project, beside the six approved ones.
 *
 * Complete and publishable as it stands; `overrides` is what a test wants wrong
 * with it, written the way the test reads: pass `{ hasPublicationPermission:
 * false }` and it is a finished project the client has not agreed to yet.
 */
export function seventhProject(
  overrides: Partial<PortfolioProject>,
): PortfolioProject {
  return {
    id: "groupe-adjovi",
    slug: "groupe-adjovi",
    title: "Groupe Adjovi",
    client: "Adjovi Holding",
    universe: "Entreprises",
    projectType: "Pack Domination",
    description:
      "Film corporate, interviews dirigeants, habillage sobre. Positionner un groupe, pas vendre un produit.",
    role: "Écriture, interviews, réalisation, motion sobre.",
    deliverables: ["1 film 3 min", "6 extraits", "Sous-titres"],
    media: {
      ratio: "16 / 9",
      placeholderLabel: "16:9",
      imageUrl: null,
      alternativeText: "",
    },
    playbackAsset: samplePlayback(SAMPLE_POSTER),
    hasPublicationPermission: true,
    spokenContent: "none",
    transcript: null,
    ...overrides,
  };
}

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
export const SAMPLE_HERO_PLAYBACK: PlaybackAsset = {
  streamId: null,
  posterUrl: SAMPLE_POSTER,
  alternativeText: "",
  sources: [{ src: "/sample-hero.mp4", type: "video/mp4" }],
  preview: null,
  captions: [],
};
