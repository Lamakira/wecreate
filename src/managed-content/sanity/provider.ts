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
  Capability,
  CapabilityColumn,
  ContactContent,
  HomePage,
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
import { PORTFOLIO_UNIVERSES } from "../types";
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

interface SanityContentResult {
  settings?: DeepPartial<SiteSettings> | null;
  homePage?: DeepPartial<HomePage> | null;
  portfolioPage?: DeepPartial<Omit<PortfolioContent, "projects">> | null;
  portfolioProjects?: Array<SanityProject | null> | null;
  servicesPage?: DeepPartial<ServicesContent> | null;
  aboutPage?: DeepPartial<AboutContent> | null;
  contactPage?: DeepPartial<ContactContent> | null;
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
      homePage: {
        ...content.homePage,
        // Digital Products (issue #7) are not modelled in Sanity yet. Until they
        // are, this list stays empty rather than falling back to the bundled
        // sample entries: WeCreate publishes only real, approved work, so an
        // unfinished section shows its empty state instead of fabricated
        // products.
        shopPreview: { ...content.homePage.shopPreview, products: [] },
      },
      portfolio: {
        ...mergeContent(DEFAULT_SITE_CONTENT.portfolio, {
          ...result?.portfolioPage,
          projects: undefined,
        }),
        projects: (result?.portfolioProjects ?? [])
          .filter((document): document is SanityProject => Boolean(document))
          .map(toPortfolioProject),
      },
      services: toServices(result?.servicesPage),
      about: toAbout(result?.aboutPage),
      contact: toContact(result?.contactPage),
    };
  },
};
