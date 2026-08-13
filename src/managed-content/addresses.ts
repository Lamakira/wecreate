/**
 * Content published at an address an editor may change.
 *
 * Two collections behave this way — Legal Documents and Digital Products — and
 * they behave identically, because the same requirement produced both:
 * "publishing a changed slug creates a permanent redirect from the prior
 * canonical URL" (issue #1). Something durable points at each of them, an Order
 * Snapshot at one and a receipt at the other, so an address either of them
 * leaves behind has to keep arriving.
 *
 * The Portfolio deliberately does not implement this; `src/proxy.ts` says why.
 */
export interface Addressed {
  /** The item's current URL segment. */
  slug: string;
  /** Segments it has published before. */
  previousSlugs: string[];
}

/** The item that currently lives at this address. */
export function findAtSlug<Item extends Addressed>(
  items: Item[],
  slug: string,
): Item | undefined {
  return items.find((item) => item.slug === slug);
}

/**
 * Every address that has been abandoned, and where it now points.
 *
 * Two entries never make it in. An address that is some item's *own* slug stays
 * that item's, so reusing an old address can never shadow a live page; and the
 * first claim on an address wins, so two items listing the same former slug
 * cannot make the destination depend on the order they were returned in.
 */
export function slugRedirects(items: Addressed[]): Record<string, string> {
  const live = new Set(items.map((item) => item.slug));
  const redirects: Record<string, string> = {};

  for (const item of items) {
    for (const previous of item.previousSlugs) {
      if (live.has(previous) || previous in redirects) {
        continue;
      }
      redirects[previous] = item.slug;
    }
  }

  return redirects;
}

/** The address a prior published address now points at, if any. */
export function findSlugRedirect(
  items: Addressed[],
  slug: string,
): string | undefined {
  return slugRedirects(items)[slug];
}
