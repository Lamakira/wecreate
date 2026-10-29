/**
 * WeCreate's three lines of work (see `CONTEXT.md`).
 *
 * Each Discipline has an address and a homepage of its own (issue #59):
 * Vidéographie owns `/`, Branding `/branding` and Site web `/site-web`. The
 * identifiers double as the route segments and the theme names, so a route and
 * its theme share one name. Vidéographie is the default everywhere a page
 * declares nothing: the Boutique, À propos, Contact, the legal and transaction
 * pages stay in its black and white (issue #55, decision 4).
 */
export const DISCIPLINES = ["videographie", "branding", "site-web"] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DEFAULT_DISCIPLINE: Discipline = "videographie";

/** What a Discipline is called to a visitor, and where its homepage lives. */
const DISCIPLINE_DETAILS: Record<Discipline, { label: string; path: string }> =
  {
    videographie: { label: "Vidéographie", path: "/" },
    branding: { label: "Branding", path: "/branding" },
    "site-web": { label: "Site web", path: "/site-web" },
  };

/** The address of a Discipline's homepage. */
export function disciplinePath(discipline: Discipline): string {
  return DISCIPLINE_DETAILS[discipline].path;
}

/** The name a visitor sees for a Discipline, as the switch spells it. */
export function disciplineLabel(discipline: Discipline): string {
  return DISCIPLINE_DETAILS[discipline].label;
}

/**
 * The brand mark each Discipline's ground calls for.
 *
 * Branding's ground is cream, so it carries the black logo; the other two are
 * dark and keep the white one. Separate files rather than a CSS `invert()` on
 * the white one, so the black mark is the one WeCreate supplied.
 */
const BRAND_MARKS: Record<Discipline, { wordmark: string; icon: string }> = {
  videographie: {
    wordmark: "/brand/logo-blanc.svg",
    icon: "/brand/icone-blanc.svg",
  },
  branding: {
    wordmark: "/brand/logo-noir.svg",
    icon: "/brand/icone-noir.svg",
  },
  "site-web": {
    wordmark: "/brand/logo-blanc.svg",
    icon: "/brand/icone-blanc.svg",
  },
};

export function brandMark(discipline: Discipline) {
  return BRAND_MARKS[discipline];
}
