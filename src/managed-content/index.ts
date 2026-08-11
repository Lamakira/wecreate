import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";

import { getManagedContentProvider } from "./provider";
import type { HomePage, SiteContent, SiteSettings } from "./types";

export * from "./types";
export { MANAGED_CONTENT_TAG } from "./tag";

import { MANAGED_CONTENT_TAG } from "./tag";

/**
 * The published site, cached and tagged.
 *
 * Public pages prerender from this, so an ordinary visit reaches a cached
 * response and never a content provider — which is what keeps the browsing
 * path off any transactional service (ADR-0003). Publishing invalidates the
 * tag through `/api/revalidate`.
 */
async function readPublishedContent(): Promise<SiteContent> {
  "use cache";
  cacheTag(MANAGED_CONTENT_TAG);
  cacheLife("managedContent");

  const provider = await getManagedContentProvider();
  return provider.read("published");
}

/**
 * The draft site. Deliberately uncached: a preview must show what the editor
 * just typed, and its result must never be served to anyone else.
 */
async function readDraftContent(): Promise<SiteContent> {
  const provider = await getManagedContentProvider();
  return provider.read("drafts");
}

/**
 * Read Managed Content for the current request.
 *
 * Draft mode is the only way to reach unpublished content. Next.js sets a
 * signed bypass cookie when preview is enabled, which both selects the draft
 * perspective here and takes the response out of the shared cache.
 */
export async function readSiteContent(): Promise<SiteContent> {
  const { isEnabled } = await draftMode();
  return isEnabled ? readDraftContent() : readPublishedContent();
}

export async function readSiteSettings(): Promise<SiteSettings> {
  return (await readSiteContent()).settings;
}

export async function readHomePage(): Promise<HomePage> {
  return (await readSiteContent()).homePage;
}
