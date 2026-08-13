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
  /**
   * The hosted 30-minute Discovery Call page. A plain address an editor
   * maintains: nothing on the site loads a scheduling widget, so a slow or
   * unavailable calendar can never hold up a WeCreate page.
   */
  discoveryCallLabel: string;
  discoveryCallUrl: string;
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
 * The Boutique's teaser on the homepage.
 *
 * It holds no products of its own: the cards are the Digital Products an editor
 * has marked featured, exactly as *Travaux récents* is the first few Portfolio
 * Projects. A product is written once and appears in both places.
 */
export interface ShopPreviewContent extends SectionVisibility {
  title: string;
  link: CallToAction;
  linkLabel: string;
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
 * One step of a sequence a visitor reads in order: WeCreate's method on À
 * propos, and *Comment démarrer* on Contact.
 *
 * It carries no number of its own. The design prints `01` to `04`, and those
 * come from the step's position when it is rendered — an editor who reorders or
 * removes a step cannot leave the page counting `01, 02, 04`.
 */
export interface NumberedStep {
  key: string;
  title: string;
  description: string;
}

/**
 * One line of what WeCreate can do: a role on the team, or a piece of the kit.
 *
 * A role, deliberately, and not a person. WeCreate has supplied no approved
 * team identities, and a name written into application source would be a
 * placeholder identity on a public page — indistinguishable, to a visitor, from
 * a real one. The Studio asks for the same shape, so an editor adds the people
 * once WeCreate has decided who is named.
 */
export interface Capability {
  key: string;
  title: string;
  description: string;
}

/** A titled column of capabilities: *L'équipe*, *L'équipement*. */
export interface CapabilityColumn {
  kicker: string;
  items: Capability[];
}

export interface AboutStoryContent {
  paragraphs: string[];
  /**
   * A brand statement WeCreate has approved — the promise from the project
   * brief, not an aphorism invented for the design prototype. Displayed as the
   * page's one large italic line.
   */
  brandStatement: string;
  /** The studio portrait. A labelled placeholder frame until a real one exists. */
  portrait: MediaFrameContent;
}

export interface AboutMethodContent extends SectionVisibility {
  kicker: string;
  title: string;
  steps: NumberedStep[];
}

/** Where WeCreate films, and the way into a conversation about it. */
export interface AboutCoverageContent {
  kicker: string;
  text: string;
  link: CallToAction;
}

/**
 * The À propos page: WeCreate's story, its method, its team and kit, and the
 * area it works in.
 *
 * A fixed set of named sections like every other page here. An editor owns the
 * words, the steps and the people; they do not own the page's shape (ADR-0001).
 */
export interface AboutContent {
  seo: PageSeo;
  kicker: string;
  headline: SplitHeadline;
  story: AboutStoryContent;
  method: AboutMethodContent;
  team: CapabilityColumn;
  equipment: CapabilityColumn;
  coverage: AboutCoverageContent;
}

/**
 * The Contact page's own copy.
 *
 * The channels themselves are not here: WhatsApp, the hosted Discovery Call and
 * the administrative email are global contact details on `SiteSettings`, so
 * they are written once and the header, the footer, Services and this page all
 * read the same values. What belongs to this page is what it says *about* each
 * of them.
 */
export interface ContactChannelsContent {
  kicker: string;
  /**
   * What writing to WeCreate starts. Version one has no contact form and stores
   * no lead, and a visitor is told so where they press (ADR-0006).
   */
  notice: string;
  whatsappNote: string;
  discoveryCallNote: string;
  /** What the address is for — administrative questions, not project briefs. */
  emailLabel: string;
  emailNote: string;
  socialKicker: string;
  locationNote: string;
}

export interface ContactGettingStartedContent {
  kicker: string;
  steps: NumberedStep[];
}

/**
 * The Contact page: three approved channels, what each is for, and how a
 * project actually starts.
 *
 * There is no form and no stored lead. The design prototype had both; issue #1
 * removed them, so every action here leaves the site as an ordinary link and
 * nothing on this page is written down anywhere.
 */
export interface ContactContent {
  seo: PageSeo;
  kicker: string;
  headline: SplitHeadline;
  /**
   * How quickly WeCreate answers, stated before a visitor writes.
   *
   * How quickly it *delivers* does not belong here: the brief sets that per
   * pack, and one figure on this page would promise something WeCreate never
   * agreed to for every pack at once.
   */
  responseExpectation: string;
  channels: ContactChannelsContent;
  gettingStarted: ContactGettingStartedContent;
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

/**
 * The two families the Boutique sells, and the filters it offers.
 *
 * A fixed vocabulary, like `PORTFOLIO_UNIVERSES` and for a stronger reason: the
 * design prototype had a third tab, *Packs Services*, selling service packs
 * through the same cart. Issue #1 removed it — a service offer can never enter
 * the Digital Cart (ADR-0006) — so a family an editor could invent would be the
 * one way that tab could come back.
 *
 * The array is the source and the union is derived from it, so the presentation
 * order and the type cannot drift apart.
 */
export const DIGITAL_PRODUCT_FAMILIES = ["ebooks", "luts"] as const;

export type DigitalProductFamily = (typeof DIGITAL_PRODUCT_FAMILIES)[number];

/**
 * A Digital Product: an ebook, guide, LUT or preset paid for in full online and
 * delivered automatically once payment is confirmed.
 *
 * Everything here is public and editorial. What is deliberately absent is the
 * thing a buyer actually receives: the Paid Deliverable is a private file in the
 * commerce system, and Managed Content never holds it, names its storage or
 * knows how to reach it (issue #1). What crosses that line is one stable
 * identity — the `sku` — which is what an Order Snapshot records and what a
 * Paid Deliverable Version is activated against (issue #8).
 *
 * Three separate decisions decide whether a visitor may buy, and none of them
 * implies another. Publishing the document makes the page public. `isPurchaseEnabled`
 * is WeCreate's intent to sell it. And an active Paid Deliverable Version, which
 * lives outside this model entirely, is what makes the sale deliverable.
 */
export interface DigitalProduct {
  /**
   * Stable identity. Survives a retitling, a change of address and archiving —
   * an Order Access grant issued years ago still resolves through it.
   */
  id: string;
  /**
   * The immutable commercial identity an Order Snapshot records, e.g. `EBK-01`.
   * Distinct from `id` because it is WeCreate's own reference, written once and
   * quoted in a receipt, rather than a content-provider document id.
   */
  sku: string;
  /** Null until an editor has chosen one; a product without it cannot be sold. */
  family: DigitalProductFamily | null;
  /** The product's own URL segment under `/boutique`. */
  slug: string;
  /** Addresses this product has had, so an old link keeps arriving. */
  previousSlugs: string[];
  title: string;
  /**
   * What the file is, e.g. `PDF`. Shown as the card's badge — the design
   * handoff's one flash of inverted colour in the Boutique.
   */
  format: string;
  /** One line, on the card and as the lede of the product's own page. */
  summary: string;
  /** The fuller description, below the lede. Empty until an editor writes it. */
  description: string;
  /** What the buyer receives. A product may not be sold without it. */
  inclusions: string[];
  /**
   * Whole XOF, and positive before the product may be sold. WeCreate never
   * charges a fraction of a franc.
   */
  priceXof: number;
  /** The cover. A labelled placeholder frame until a real one exists. */
  cover: MediaFrameContent;
  /** Shown in the homepage's *La boutique* teaser. */
  isFeatured: boolean;
  /**
   * WeCreate's intent to sell this product. Separate from publishing it, which
   * is what makes the page public: a product page can exist, and say *bientôt
   * disponible*, long before there is anything to sell.
   */
  isPurchaseEnabled: boolean;
  /**
   * Withdrawn from discovery and from new sales, without being deleted.
   *
   * Deleting a product would break every historical reference to it — an Order
   * Snapshot, an Order Access grant, a receipt. An archived product keeps its
   * identity and its page; it leaves the Boutique, the sitemap and search.
   */
  isArchived: boolean;
}

/** What buying a Digital Product allows, and where the terms are written. */
export interface BoutiqueLicenceContent {
  kicker: string;
  note: string;
  linkLabel: string;
}

/**
 * How a visitor asks a question about a product.
 *
 * WhatsApp first, the administrative address second — the same two channels
 * Contact offers, because they are the same channels. This is support, not a
 * Service Enquiry: nothing here is about commissioning a film.
 */
export interface BoutiqueSupportContent {
  kicker: string;
  note: string;
  whatsappLabel: string;
  /** `%s` is replaced with the product's title. */
  whatsappMessageTemplate: string;
  emailLabel: string;
}

/**
 * The Boutique, and the Digital Products it lists.
 *
 * The products are a collection an editor grows, like Portfolio Projects and
 * unlike every other content type here, which is why they sit beside the page's
 * own copy rather than inside a section of it.
 */
export interface BoutiqueContent {
  seo: PageSeo;
  kicker: string;
  headline: SplitHeadline;
  intro: string;
  /** Label of the filter that clears the others, e.g. `Tous`. */
  allFamiliesLabel: string;
  emptyStateText: string;
  /** The card's link into the product's own page. */
  detailLinkLabel: string;
  /** The way back, from a product to the list. */
  backLabel: string;
  inclusionsKicker: string;
  licence: BoutiqueLicenceContent;
  support: BoutiqueSupportContent;
  products: DigitalProduct[];
}

/**
 * One commercial offer inside a service universe.
 *
 * A pack is priced, described and contactable — never purchasable. Nothing here
 * carries a SKU, a purchase flag or a Paid Deliverable, because a service offer
 * can never enter the Digital Cart, create an Order Snapshot or reach FedaPay
 * (ADR-0006). `paymentTerms` is commercial information WeCreate states out
 * loud so a visitor can prepare; the website neither calculates nor collects it.
 */
export interface ServicePack {
  /**
   * Stable identity, and the one `id` among the service types — its siblings
   * carry a `key`, the way `UniverseCard` and `ProofPoint` do. The difference
   * is real: a universe, a comparison row and an add-on are content blocks in a
   * list, while a pack is a named commercial offer that a Service Enquiry
   * message identifies. It survives a rename.
   */
  id: string;
  name: string;
  /**
   * Whole XOF. WeCreate's published reference price, kept even for a pack
   * quoted on request, because it is what the conversation starts from.
   */
  priceXof: number;
  /** What the price buys, e.g. `par mois`. Empty when it is a one-off fee. */
  priceUnit: string;
  /**
   * Quoted rather than listed: the page shows `ServicesContent.onRequestLabel`
   * in place of the amount.
   */
  isOnRequest: boolean;
  /** Who the pack is for. */
  audience: string;
  /** How long the client commits for, e.g. `3 mois`. */
  commitment: string;
  /** When each part is due. Stated only — see `ServiceEnquiryContent.notice`. */
  paymentTerms: string;
  inclusions: string[];
}

/**
 * A family of offers: Entreprises, Immobilier or Mariage. The same three
 * universes a Portfolio Project belongs to, sold rather than shown.
 */
export interface ServiceUniverse {
  key: string;
  kicker: string;
  title: string;
  intro: string;
  /** Display order is this array's order. */
  packs: ServicePack[];
}

/** One row of the comparison table. */
export interface ServiceComparisonRow {
  key: string;
  label: string;
  /** One cell per entry of `ServiceComparisonContent.columns`, in the same order. */
  values: string[];
}

/**
 * The Entreprises packs side by side, on the light band. A table because it is
 * one: row headers, column headers and a caption, so it is navigable by a
 * screen reader instead of being a grid of loose cells.
 */
export interface ServiceComparisonContent extends SectionVisibility {
  kicker: string;
  title: string;
  /** The table's accessible name. */
  caption: string;
  /** Column headings, in display order. */
  columns: string[];
  rows: ServiceComparisonRow[];
}

/** An option sold alongside a pack, never on its own. */
export interface ServiceAddOn {
  key: string;
  title: string;
  /** Whole XOF. */
  priceXof: number;
  /** What the price covers, e.g. `par vidéo`. Empty when it is a flat fee. */
  priceUnit: string;
  description: string;
}

export interface ServiceAddOnsContent extends SectionVisibility {
  kicker: string;
  title: string;
  addOns: ServiceAddOn[];
}

/**
 * What a service CTA is, and the words it carries.
 *
 * Both actions leave the site: a prefilled WhatsApp conversation, and a hosted
 * Discovery Call page. `notice` is what keeps them honest — a visitor is told,
 * in the same place they press, that this opens a conversation and nothing
 * else.
 */
export interface ServiceEnquiryContent {
  title: string;
  notice: string;
  whatsappLabel: string;
  /** `%s` is replaced with the offer the visitor chose. */
  whatsappMessageTemplate: string;
  discoveryCallLabel: string;
  discoveryCallNote: string;
}

/**
 * The Services page: WeCreate's method, its three universes and their packs,
 * the Entreprises comparison and the add-ons.
 *
 * Like the homepage this is a fixed set of named sections. An editor changes
 * copy, prices, inclusions, order and whether the last two sections are shown —
 * never the page's structure.
 */
export interface ServicesContent {
  seo: PageSeo;
  kicker: string;
  headline: SplitHeadline;
  /** The three columns of method copy under the title. */
  methodColumns: string[];
  /** Shown in place of a price for a pack quoted on request. */
  onRequestLabel: string;
  enquiry: ServiceEnquiryContent;
  universes: ServiceUniverse[];
  comparison: ServiceComparisonContent;
  addOns: ServiceAddOnsContent;
}

/**
 * Which of WeCreate's legal texts a document is.
 *
 * A fixed vocabulary, not an editor's free text, and the reason is the
 * checkout: an Order Snapshot records *which* terms a buyer accepted, so the
 * application has to be able to ask for "the CGV" by name. A kind invented in
 * the Studio could never be required, accepted or recorded, so there is no way
 * to invent one — an editor owns each document's words and its address, never
 * the set (ADR-0001).
 *
 * The array is the source and the union is derived from it, the way
 * `PORTFOLIO_UNIVERSES` is: one list, so the presentation order and the type
 * cannot drift apart. That order is the order everything shows them in — the
 * footer, the sitemap, and what a checkout asks a buyer to accept.
 */
export const LEGAL_DOCUMENT_KINDS = [
  "cgv",
  "livraison-remboursement",
  "licence",
  "confidentialite",
  "mentions-legales",
] as const;

export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];

/**
 * Whether a revision is WeCreate's approved legal text, or a stand-in written
 * so the site can be built before that text exists.
 *
 * Legal copy is an external launch input (issue #1). Everything this repository
 * ships is therefore `placeholder`, and the difference is enforced rather than
 * advisory: a placeholder is readable, but it is kept out of the sitemap, it
 * cannot satisfy the Commerce Launch Gate, and no live checkout will accept it.
 */
export type LegalRevisionStatus = "placeholder" | "approved";

/** One titled part of a legal text. Prose, in the order it is read. */
export interface LegalSection {
  key: string;
  heading: string;
  paragraphs: string[];
}

/**
 * A legal text as it stood from one date onwards.
 *
 * Revisions are append-only and immutable. New terms are a new revision with a
 * new `id`, never an edit of the one already published, because an Order
 * Snapshot references exactly this identity and has to keep resolving to
 * exactly this text long after WeCreate has moved on to the next version.
 */
export interface LegalRevision {
  /**
   * Stable identity of this exact text. Recorded in Order Snapshots, so it is
   * never reused and never re-pointed at different words.
   */
  id: string;
  /** The day the text takes effect, as `YYYY-MM-DD`. */
  effectiveFrom: string;
  status: LegalRevisionStatus;
  sections: LegalSection[];
}

/**
 * One of WeCreate's legal documents, with every revision it has had.
 *
 * The document is the durable thing — its kind, its title, where it lives —
 * and its `revisions` are the history of what it said. `previousSlugs` is what
 * keeps a changed address from breaking a link somebody has already saved or a
 * crawler has already indexed.
 */
export interface LegalDocument {
  kind: LegalDocumentKind;
  /** The document's own URL segment under `/legal`. */
  slug: string;
  previousSlugs: string[];
  title: string;
  /** One line saying what the document covers, shown under its title. */
  summary: string;
  /** Oldest first. Appended to; never rewritten. */
  revisions: LegalRevision[];
}

/** Everything the public site needs from Managed Content in one place. */
export interface SiteContent {
  settings: SiteSettings;
  homePage: HomePage;
  portfolio: PortfolioContent;
  boutique: BoutiqueContent;
  services: ServicesContent;
  about: AboutContent;
  contact: ContactContent;
  /** One entry per `LegalDocumentKind`, in the order they are presented. */
  legalDocuments: LegalDocument[];
}
