import type { Discipline } from "@/discipline";

import type { HomePage, SiteContent } from "./types";

/**
 * Which `SiteContent` field holds each Discipline's homepage.
 *
 * The keys are also the Sanity document type names (`homePage`,
 * `brandingHomePage`, `siteWebHomePage`), so the content model, the Studio and
 * the cache tags all use one name per homepage. `homePage` stays Vidéographie's
 * — it was the only homepage before issue #59 and keeps its name.
 */
export const HOME_PAGE_KEYS = {
  videographie: "homePage",
  branding: "brandingHomePage",
  "site-web": "siteWebHomePage",
} as const satisfies Record<Discipline, keyof SiteContent>;

/** The homepage content a Discipline's address renders. */
export function homePageOf(
  content: SiteContent,
  discipline: Discipline,
): HomePage {
  return content[HOME_PAGE_KEYS[discipline]];
}
