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

/**
 * A public video prepared for adaptive streaming.
 *
 * Issue #3 replaces `sources` with Mux-issued adaptive renditions. Until then
 * the field is optional everywhere it appears, because the page must stay
 * understandable when playback is unavailable.
 */
export interface PlaybackAsset {
  posterUrl: string;
  alternativeText: string;
  sources: Array<{ src: string; type: string }>;
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

/**
 * The homepage's view of a Portfolio Project.
 *
 * Issue #3 owns the Portfolio Project document type; until it lands the Sanity
 * provider returns an empty list here and the section shows its empty state.
 */
export interface PortfolioProjectCard {
  id: string;
  title: string;
  client: string;
  category: string;
  href: string;
  media: MediaFrameContent;
}

export interface RecentWorkContent extends SectionVisibility {
  headline: SplitHeadline;
  link: CallToAction;
  projects: PortfolioProjectCard[];
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

/** Everything the public site needs from Managed Content in one place. */
export interface SiteContent {
  settings: SiteSettings;
  homePage: HomePage;
}
