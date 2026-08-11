/**
 * The shape of WeCreate's Managed Content: the portfolio projects, products,
 * prices and editorial copy WeCreate maintains without a developer.
 *
 * These types are the contract between the application and whichever content
 * provider is behind it. Components import from here and never from a provider
 * package, so a provider can be swapped for a deterministic fake in tests
 * without any component being mocked.
 */

/**
 * Which revision of Managed Content to read.
 *
 * `published` is what ordinary public requests must always see. `drafts` is
 * only ever reachable through an authenticated preview session.
 */
export type ContentPerspective = "published" | "drafts";

export interface NavigationLink {
  label: string;
  href: string;
}

export interface CallToAction {
  label: string;
  href: string;
}

/**
 * A heading with one italicised accent word, the typographic signature of the
 * approved design. Structured as three parts rather than rich text so editors
 * cannot introduce arbitrary markup.
 */
export interface SplitHeadline {
  lead: string;
  emphasis: string;
  trail: string;
}

export interface ContactDetails {
  whatsappLabel: string;
  whatsappUrl: string;
  email: string;
  locationLabel: string;
}

export interface SocialAccount {
  label: string;
  url: string;
}

export interface FooterContent {
  baseline: string;
  navigationHeading: string;
  contactHeading: string;
  socialHeading: string;
  legalLine: string;
}

export interface SeoDefaults {
  siteName: string;
  /** `%s` is replaced with the page title. */
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
  openGraphImageUrl: string | null;
  /** Open Graph locale, e.g. `fr_BJ`. */
  openGraphLocale: string;
}

export interface PageSeo {
  title: string;
  description: string;
  openGraphImageUrl: string | null;
}

export interface SiteSettings {
  brandName: string;
  positioningLine: string;
  navigation: NavigationLink[];
  headerCta: CallToAction;
  contact: ContactDetails;
  socialAccounts: SocialAccount[];
  footer: FooterContent;
  seo: SeoDefaults;
}

/** One rendition of a video, as a `<source>` would describe it. */
export interface PlaybackSource {
  src: string;
  type: string;
}

/**
 * A caption or subtitle track, for video whose speech carries meaning.
 *
 * `language` is a BCP 47 tag; `label` is what a viewer picks from the track
 * menu, so it is written in the language it describes.
 */
export interface CaptionTrack {
  src: string;
  language: string;
  label: string;
}

/**
 * A public video prepared for adaptive streaming.
 *
 * This is the resolved form: everything a page needs to show or play the
 * video, and nothing about who prepared it. The playback provider
 * (`src/video-playback/`) turns its own asset association into one of these,
 * so no component knows a vendor exists.
 *
 * It is optional everywhere it appears. A project whose video is missing,
 * still processing, or served by an unconfigured provider has to stay
 * understandable from its poster and its words alone.
 */
export interface PlaybackAsset {
  /**
   * Public identity of the prepared stream, issued by the playback provider
   * and used to play it adaptively. Null when the asset is a plain file, which
   * is what development and the acceptance suite use.
   */
  streamId: string | null;
  posterUrl: string;
  alternativeText: string;
  /** Ordered renditions, best first. */
  sources: PlaybackSource[];
  /** A short, silent loop for hover previews. Never the complete video. */
  preview: PlaybackSource | null;
  captions: CaptionTrack[];
}

/** Aspect ratio of a media frame, expressed as a CSS `aspect-ratio` value. */
export type MediaRatio = "9 / 16" | "16 / 9" | "4 / 5" | "4 / 3";

/**
 * The media a card shows before its real asset exists. The design handoff ships
 * every visual as a labelled grey placeholder at a fixed ratio; keeping that in
 * the content model means an unfinished project reserves correct layout space
 * instead of collapsing.
 */
export interface MediaFrameContent {
  ratio: MediaRatio;
  /** Monospace caption shown inside a placeholder frame. */
  placeholderLabel: string;
  /** Set once a real image exists; `alternativeText` is then required. */
  imageUrl: string | null;
  alternativeText: string;
}

/** A section an editor can hide without a developer. */
export interface SectionVisibility {
  isVisible: boolean;
}

export interface HeroContent {
  kicker: string;
  headline: SplitHeadline;
  subtitle: string;
  primaryCta: CallToAction;
  secondaryCta: CallToAction;
  /** Optional background loop. Absent by default; see `PlaybackAsset`. */
  playbackAsset: PlaybackAsset | null;
}

export interface MarqueeContent extends SectionVisibility {
  text: string;
}

export interface UniverseCard {
  key: string;
  kicker: string;
  title: string;
  description: string;
  linkLabel: string;
  href: string;
  media: MediaFrameContent;
}

export interface UniversesContent extends SectionVisibility {
  title: string;
  kicker: string;
  universes: UniverseCard[];
}

export interface RecentWorkContent extends SectionVisibility {
  headline: SplitHeadline;
  link: CallToAction;
  emptyStateText: string;
}

export interface ProofPoint {
  key: string;
  figure: string;
  description: string;
}

export interface ProofContent extends SectionVisibility {
  kicker: string;
  points: ProofPoint[];
}

/**
 * The homepage's view of a Digital Product.
 *
 * Issue #7 owns the Digital Product document type and issue #9 owns adding one
 * to the Digital Cart. Until then this is a read-only teaser: it links to the
 * Boutique and never offers a purchase action, because no product is
 * purchase-enabled before the Commerce Launch Gate.
 */
export interface DigitalProductCard {
  id: string;
  title: string;
  badge: string;
  description: string;
  /** Whole XOF amount. WeCreate never charges fractional currency units. */
  priceXof: number;
  href: string;
  media: MediaFrameContent;
}

export interface ShopPreviewContent extends SectionVisibility {
  title: string;
  link: CallToAction;
  linkLabel: string;
  products: DigitalProductCard[];
  emptyStateText: string;
}

export interface BrandQuoteContent extends SectionVisibility {
  quote: string;
  attribution: string;
}

export interface FinalCtaContent extends SectionVisibility {
  headline: SplitHeadline;
  subtitle: string;
  primaryCta: CallToAction;
  secondaryCta: CallToAction;
}

/**
 * The homepage is a fixed, named set of sections — not a page builder. Editors
 * control each section's copy and whether it is shown; they cannot invent,
 * reorder or nest sections, which is what keeps the approved design and its
 * accessibility guarantees intact.
 */
export interface HomePage {
  seo: PageSeo;
  hero: HeroContent;
  positioningMarquee: MarqueeContent;
  universes: UniversesContent;
  recentWork: RecentWorkContent;
  proof: ProofContent;
  shopPreview: ShopPreviewContent;
  brandQuote: BrandQuoteContent;
  finalCta: FinalCtaContent;
}

/**
 * The three universes WeCreate sells and films in. A Portfolio Project belongs
 * to exactly one, which is also what the portfolio's filters offer.
 */
export type PortfolioUniverse = "Entreprises" | "Immobilier" | "Mariage";

export const PORTFOLIO_UNIVERSES: readonly PortfolioUniverse[] = [
  "Entreprises",
  "Immobilier",
  "Mariage",
];

/**
 * How a project's spoken content is made available to someone who cannot hear
 * it. Declared by the editor, because only a person who has watched the film
 * knows whether speech carries meaning in it.
 */
export type SpokenContentSupport = "none" | "captions" | "transcript";

/**
 * A client-approved body of WeCreate work, with its editorial context, poster
 * and adaptive Playback Asset.
 *
 * Everything here is either editorial (what the work was and who it was for),
 * rights (whether the client agreed to it being shown), or presentational
 * (ratio, poster). What none of it contains is a vendor's playback identifier:
 * an editor associates a video, and the playback provider issues the rest.
 */
export interface PortfolioProject {
  /** Stable identity. Survives a retitling or a change of slug. */
  id: string;
  /** The project's own URL segment under `/portfolio`. */
  slug: string;
  title: string;
  /** Who the work was for. */
  client: string;
  /** Null until an editor has chosen one; a project without it cannot publish. */
  universe: PortfolioUniverse | null;
  /** The kind of engagement, e.g. `Visite premium`. Shown beside the client. */
  projectType: string;
  description: string;
  /** What WeCreate did on it. */
  role: string;
  /** What was handed over. */
  deliverables: string[];
  /** The card's visual: its format, its poster and that poster's description. */
  media: MediaFrameContent;
  playbackAsset: PlaybackAsset | null;
  /** Whether the client has agreed to this work being published. */
  hasPublicationPermission: boolean;
  spokenContent: SpokenContentSupport;
  /** Required when `spokenContent` is `transcript`. */
  transcript: string | null;
}

/**
 * The portfolio page and the Portfolio Projects it lists.
 *
 * The projects are a collection an editor grows, unlike every other content
 * type here — which is why they sit beside the homepage rather than inside it.
 * The homepage's *Travaux récents* reel is the first few of this same list, so
 * a project is written once and appears in both places.
 */
export interface PortfolioContent {
  seo: PageSeo;
  kicker: string;
  headline: SplitHeadline;
  /** Label of the filter that clears the others, e.g. `Tous`. */
  allUniversesLabel: string;
  emptyStateText: string;
  projects: PortfolioProject[];
}

/** Everything the public site needs from Managed Content in one place. */
export interface SiteContent {
  settings: SiteSettings;
  homePage: HomePage;
  portfolio: PortfolioContent;
}
