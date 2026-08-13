import "server-only";

import { getSanityClient } from "@/sanity/client";
import { assertSanityConfigured } from "@/sanity/env";
import type { PlaybackAssociation } from "@/video-playback/provider";
import { videoPlaybackProvider } from "@/video-playback/provider";

import { DEFAULT_SITE_CONTENT } from "../default-content";
import { mergeContent, type DeepPartial } from "../merge";
import type { ManagedContentProvider } from "../provider";
import type {
  AboutContent,
  BoutiqueContent,
  Capability,
  CapabilityColumn,
  ContactContent,
  DigitalProduct,
  DigitalProductFamily,
  HomePage,
  LegalDocument,
  LegalDocumentKind,
  LegalRevision,
  LegalSection,
  MediaFrameContent,
  NumberedStep,
  PortfolioContent,
  PortfolioProject,
  PortfolioUniverse,
  ServiceAddOn,
  ServiceComparisonRow,
  ServicePack,
  ServiceUniverse,
  ServicesContent,
  SiteSettings,
  SpokenContentSupport,
} from "../types";
import {
  DIGITAL_PRODUCT_FAMILIES,
  LEGAL_DOCUMENT_KINDS,
  PORTFOLIO_UNIVERSES,
} from "../types";
import { SITE_CONTENT_QUERY } from "./query";

/**
 * Sanity returns every unfilled field as `null`, and returns `null` for the
 * whole document when it does not exist yet — including for a Portfolio Project
 * an editor has only just created.
 */
type SanityProject = DeepPartial<
  Omit<PortfolioProject, "playbackAsset" | "media">
> & {
  media?: DeepPartial<MediaFrameContent> | null;
  video?: DeepPartial<PlaybackAssociation> | null;
};

/**
 * A legal document identifies itself by its document id — `legal.cgv` — rather
 * than by a field an editor picks from a list. The Studio pins one id per kind,
 * so the identity a checkout resolves terms by cannot be retyped, duplicated or
 * left blank.
 */
type SanityLegalDocument = DeepPartial<Omit<LegalDocument, "kind">> & {
  documentId?: string | null;
};

/** A product document, with the cover under the name the query gives it. */
type SanityDigitalProduct = DeepPartial<Omit<DigitalProduct, "cover">> & {
  cover?: DeepPartial<MediaFrameContent> | null;
};

interface SanityContentResult {
  settings?: DeepPartial<SiteSettings> | null;
  homePage?: DeepPartial<HomePage> | null;
  portfolioPage?: DeepPartial<Omit<PortfolioContent, "projects">> | null;
  portfolioProjects?: Array<SanityProject | null> | null;
  boutiquePage?: DeepPartial<Omit<BoutiqueContent, "products">> | null;
  digitalProducts?: Array<SanityDigitalProduct | null> | null;
  servicesPage?: DeepPartial<ServicesContent> | null;
  aboutPage?: DeepPartial<AboutContent> | null;
  contactPage?: DeepPartial<ContactContent> | null;
  legalDocuments?: Array<SanityLegalDocument | null> | null;
}

/** An editor's choice, or nothing — never a universe the application invented. */
function toUniverse(value: string | null | undefined): PortfolioUniverse | null {
  return PORTFOLIO_UNIVERSES.find((universe) => universe === value) ?? null;
}

/**
 * One Sanity document, in the application's own vocabulary.
 *
 * Every field falls back to something empty rather than to something invented:
 * an incomplete project has to stay recognisably incomplete, because that is
 * what the publication rule reads to decide it may not be shown.
 */
function toPortfolioProject(document: SanityProject): PortfolioProject {
  const association = document.video;

  return {
    // Sanity prefixes an unpublished document's id with `drafts.`; stripping it
    // keeps one project one identity across both perspectives.
    id: (document.id ?? "").replace(/^drafts\./, ""),
    slug: document.slug ?? "",
    title: document.title ?? "",
    client: document.client ?? "",
    universe: toUniverse(document.universe),
    projectType: document.projectType ?? "",
    description: document.description ?? "",
    role: document.role ?? "",
    deliverables: document.deliverables ?? [],
    media: {
      ratio: document.media?.ratio ?? "16 / 9",
      placeholderLabel: document.media?.placeholderLabel ?? "",
      imageUrl: document.media?.imageUrl ?? null,
      alternativeText: document.media?.alternativeText ?? "",
    },
    playbackAsset: association?.playbackId
      ? videoPlaybackProvider.resolve({
          playbackId: association.playbackId,
          isReady: association.isReady === true,
          alternativeText: document.media?.alternativeText ?? "",
          textTracks: association.textTracks ?? [],
        })
      : null,
    hasPublicationPermission: document.hasPublicationPermission === true,
    spokenContent: (document.spokenContent ?? "none") as SpokenContentSupport,
    transcript: document.transcript ?? null,
  };
}

/** An editor's choice, or nothing — never a family the application invented. */
function toFamily(value: string | null | undefined): DigitalProductFamily | null {
  return DIGITAL_PRODUCT_FAMILIES.find((family) => family === value) ?? null;
}

/**
 * One Digital Product, in the application's own vocabulary.
 *
 * Every field falls back to something empty rather than to something invented,
 * for the reason a Portfolio Project does: an incomplete product has to stay
 * recognisably incomplete, because that is what the purchase rule reads to
 * decide it may not be sold. The two flags fall back to `false` in the direction
 * that keeps money off the table — an unreadable *En vente* is not a sale.
 *
 * A family an editor has not chosen arrives as `null` rather than as a guess, in
 * the way a Portfolio Project's universe does: a product filed into the wrong
 * family is worse than one visibly still being written, and the purchase rule
 * refuses it either way while telling the editor which box is empty.
 */
function toDigitalProduct(document: SanityDigitalProduct): DigitalProduct {
  return {
    // Sanity prefixes an unpublished document's id with `drafts.`; stripping it
    // keeps one product one identity across both perspectives.
    id: (document.id ?? "").replace(/^drafts\./, ""),
    sku: document.sku ?? "",
    family: toFamily(document.family),
    slug: document.slug ?? "",
    previousSlugs: document.previousSlugs ?? [],
    title: document.title ?? "",
    format: document.format ?? "",
    summary: document.summary ?? "",
    description: document.description ?? "",
    inclusions: document.inclusions ?? [],
    priceXof: document.priceXof ?? 0,
    cover: {
      ratio: document.cover?.ratio ?? "4 / 3",
      placeholderLabel: document.cover?.placeholderLabel ?? "",
      imageUrl: document.cover?.imageUrl ?? null,
      alternativeText: document.cover?.alternativeText ?? "",
    },
    isFeatured: document.isFeatured === true,
    isPurchaseEnabled: document.isPurchaseEnabled === true,
    isArchived: document.isArchived === true,
  };
}

/**
 * The Boutique, normalised.
 *
 * The products are whatever the dataset holds, and nothing is filled in from the
 * bundled catalogue: the six shipped products are a starting point for a fresh
 * checkout, not a floor a configured project falls back through. A Sanity
 * project whose editor has deleted a product means to have deleted it, and a
 * Boutique that quietly restored it would be selling something WeCreate had
 * withdrawn.
 */
function toBoutique(
  page: DeepPartial<Omit<BoutiqueContent, "products">> | null | undefined,
  products: Array<SanityDigitalProduct | null> | null | undefined,
): BoutiqueContent {
  const merged = mergeContent(DEFAULT_SITE_CONTENT.boutique, {
    ...page,
    products: undefined,
  });

  return {
    ...merged,
    products: (products ?? [])
      .filter((document): document is SanityDigitalProduct => Boolean(document))
      .map(toDigitalProduct),
  };
}

/**
 * The service catalogue, normalised.
 *
 * `mergeContent` replaces arrays wholesale rather than merging element by
 * element, which is right — an editor who deletes a pack means to delete it —
 * but it means an element the editor left half-filled arrives with `null`
 * fields. These functions give every one of them an empty value, so a pack
 * saved without its inclusions renders as a pack with nothing listed instead of
 * throwing on the way out of the server.
 */
function toServicePack(document: DeepPartial<ServicePack>, index: number): ServicePack {
  return {
    id: document.id ?? `pack-${index}`,
    name: document.name ?? "",
    priceXof: document.priceXof ?? 0,
    priceUnit: document.priceUnit ?? "",
    isOnRequest: document.isOnRequest === true,
    audience: document.audience ?? "",
    commitment: document.commitment ?? "",
    paymentTerms: document.paymentTerms ?? "",
    inclusions: document.inclusions ?? [],
  };
}

function toServiceUniverse(
  document: DeepPartial<ServiceUniverse>,
  index: number,
): ServiceUniverse {
  return {
    key: document.key ?? `universe-${index}`,
    kicker: document.kicker ?? "",
    title: document.title ?? "",
    intro: document.intro ?? "",
    packs: (document.packs ?? []).map(toServicePack),
  };
}

function toServiceComparisonRow(
  document: DeepPartial<ServiceComparisonRow>,
  index: number,
): ServiceComparisonRow {
  return {
    key: document.key ?? `row-${index}`,
    label: document.label ?? "",
    values: document.values ?? [],
  };
}

function toServiceAddOn(
  document: DeepPartial<ServiceAddOn>,
  index: number,
): ServiceAddOn {
  return {
    key: document.key ?? `add-on-${index}`,
    title: document.title ?? "",
    priceXof: document.priceXof ?? 0,
    priceUnit: document.priceUnit ?? "",
    description: document.description ?? "",
  };
}

function toServices(
  document: DeepPartial<ServicesContent> | null | undefined,
): ServicesContent {
  const merged = mergeContent(DEFAULT_SITE_CONTENT.services, {
    ...document,
    universes: undefined,
    comparison: { ...document?.comparison, rows: undefined },
    addOns: { ...document?.addOns, addOns: undefined },
  });

  return {
    ...merged,
    universes: document?.universes
      ? document.universes.map(toServiceUniverse)
      : merged.universes,
    comparison: {
      ...merged.comparison,
      rows: document?.comparison?.rows
        ? document.comparison.rows.map(toServiceComparisonRow)
        : merged.comparison.rows,
    },
    addOns: {
      ...merged.addOns,
      addOns: document?.addOns?.addOns
        ? document.addOns.addOns.map(toServiceAddOn)
        : merged.addOns.addOns,
    },
  };
}

/**
 * A titled line, normalised: a method step, or a role or a piece of kit.
 *
 * Same reason as the service catalogue above — an array an editor has touched
 * replaces the baseline wholesale, so a line saved without its description has
 * to arrive as an empty string rather than as `null` reaching a component.
 *
 * `NumberedStep` and `Capability` are separate concepts with the same three
 * fields, so one function normalises both rather than two that would drift. A
 * step's displayed number is not among them: it is not stored, it is where the
 * step sits when the page renders it.
 */
function toTitledLine<Line extends NumberedStep | Capability>(
  document: DeepPartial<Line>,
  fallbackKey: string,
): Line {
  return {
    key: document.key ?? fallbackKey,
    title: document.title ?? "",
    description: document.description ?? "",
  } as Line;
}

function toCapabilityColumn(
  base: CapabilityColumn,
  document: DeepPartial<CapabilityColumn> | null | undefined,
): CapabilityColumn {
  const merged = mergeContent(base, { ...document, items: undefined });
  return {
    ...merged,
    items: document?.items
      ? document.items.map((item, index) =>
          toTitledLine<Capability>(item, `capability-${index}`),
        )
      : merged.items,
  };
}

function toAbout(
  document: DeepPartial<AboutContent> | null | undefined,
): AboutContent {
  const base = DEFAULT_SITE_CONTENT.about;
  const merged = mergeContent(base, {
    ...document,
    method: { ...document?.method, steps: undefined },
    team: undefined,
    equipment: undefined,
  });

  return {
    ...merged,
    method: {
      ...merged.method,
      steps: document?.method?.steps
        ? document.method.steps.map((step, index) =>
            toTitledLine<NumberedStep>(step, `step-${index}`),
          )
        : merged.method.steps,
    },
    team: toCapabilityColumn(base.team, document?.team),
    equipment: toCapabilityColumn(base.equipment, document?.equipment),
  };
}

function toContact(
  document: DeepPartial<ContactContent> | null | undefined,
): ContactContent {
  const merged = mergeContent(DEFAULT_SITE_CONTENT.contact, {
    ...document,
    gettingStarted: { ...document?.gettingStarted, steps: undefined },
  });

  return {
    ...merged,
    gettingStarted: {
      ...merged.gettingStarted,
      steps: document?.gettingStarted?.steps
        ? document.gettingStarted.steps.map((step, index) =>
            toTitledLine<NumberedStep>(step, `step-${index}`),
          )
        : merged.gettingStarted.steps,
    },
  };
}

/**
 * Which legal document a Sanity id names, or nothing.
 *
 * `drafts.legal.cgv` and `legal.cgv` are the same document seen from the two
 * perspectives, so the prefix is stripped the way it is for a Portfolio Project.
 * An id that is not one of the five known kinds is ignored rather than guessed
 * at: a document the application cannot name is one a checkout could never
 * require, present or record.
 */
function toLegalKind(documentId: string): LegalDocumentKind | undefined {
  const kind = documentId.replace(/^drafts\./, "").replace(/^legal\./, "");
  return LEGAL_DOCUMENT_KINDS.find(
    (candidate: LegalDocumentKind) => candidate === kind,
  );
}

function toLegalSection(
  document: DeepPartial<LegalSection>,
  index: number,
): LegalSection {
  return {
    key: document.key ?? `section-${index}`,
    heading: document.heading ?? "",
    paragraphs: (document.paragraphs ?? []).filter(Boolean),
  };
}

/**
 * One revision, normalised.
 *
 * A revision with no identity is dropped by the caller rather than given one:
 * an invented id would be a new identity every time the query ran, and an Order
 * Snapshot pointing at it would resolve to nothing. Status falls back to
 * `placeholder`, which is the safe direction — unapproved text keeps production
 * purchasing off, while text wrongly assumed approved would let it through.
 */
function toLegalRevision(document: DeepPartial<LegalRevision>): LegalRevision {
  return {
    id: document.id ?? "",
    effectiveFrom: document.effectiveFrom ?? "",
    status: document.status === "approved" ? "approved" : "placeholder",
    sections: (document.sections ?? []).map(toLegalSection),
  };
}

/**
 * The five legal documents, one per kind, whatever the dataset holds.
 *
 * A kind with no document in Sanity — a fresh project, or one where the editor
 * has not opened that document yet — keeps the bundled placeholder, so the site
 * always has a legal page to link to and the Commerce Launch Gate always has
 * something honest to refuse.
 */
function toLegalDocuments(
  documents: Array<SanityLegalDocument | null> | null | undefined,
): LegalDocument[] {
  const byKind = new Map<LegalDocumentKind, SanityLegalDocument>();
  for (const document of documents ?? []) {
    const kind = document && toLegalKind(document.documentId ?? "");
    if (kind && !byKind.has(kind)) {
      byKind.set(kind, document);
    }
  }

  return DEFAULT_SITE_CONTENT.legalDocuments.map((base) => {
    const document = byKind.get(base.kind);
    // Field by field rather than by spreading the query result: `documentId` is
    // how Sanity names the document, not part of the content model, and it must
    // not ride along into what the rest of the application reads.
    const merged = mergeContent(base, {
      slug: document?.slug,
      previousSlugs: document?.previousSlugs,
      title: document?.title,
      summary: document?.summary,
    });

    return {
      ...merged,
      kind: base.kind,
      revisions: document?.revisions
        ? document.revisions.map(toLegalRevision).filter(
            // Nothing without both an identity and a date: one is what an Order
            // Snapshot references, the other is what decides when it applies.
            (revision) => revision.id !== "" && revision.effectiveFrom !== "",
          )
        : merged.revisions,
    };
  });
}

export const sanityContentProvider: ManagedContentProvider = {
  id: "sanity",
  async read(perspective) {
    assertSanityConfigured();

    const client = getSanityClient(perspective);
    const result = await client.fetch<SanityContentResult | null>(
      SITE_CONTENT_QUERY,
    );
    const content = mergeContent(DEFAULT_SITE_CONTENT, {
      settings: result?.settings ?? undefined,
      homePage: result?.homePage ?? undefined,
    });

    return {
      ...content,
      portfolio: {
        ...mergeContent(DEFAULT_SITE_CONTENT.portfolio, {
          ...result?.portfolioPage,
          projects: undefined,
        }),
        projects: (result?.portfolioProjects ?? [])
          .filter((document): document is SanityProject => Boolean(document))
          .map(toPortfolioProject),
      },
      boutique: toBoutique(result?.boutiquePage, result?.digitalProducts),
      services: toServices(result?.servicesPage),
      about: toAbout(result?.aboutPage),
      contact: toContact(result?.contactPage),
      legalDocuments: toLegalDocuments(result?.legalDocuments),
    };
  },
};
