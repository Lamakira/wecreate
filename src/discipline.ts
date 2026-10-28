/**
 * WeCreate's three lines of work (see `CONTEXT.md`).
 *
 * The identifiers are the addresses each Discipline is meant to own, so a
 * route and its theme share one name. Vidéographie owns `/` and is the default
 * everywhere a page declares nothing: the Boutique, À propos, Contact, the
 * legal and transaction pages stay in its black and white (issue #55,
 * decision 4).
 */
export const DISCIPLINES = ["videographie", "branding", "site-web"] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export const DEFAULT_DISCIPLINE: Discipline = "videographie";

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
