import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { getManagedContentProvider } from "./provider";
import {
  ABOUT_TAG,
  BOUTIQUE_TAG,
  CONTACT_TAG,
  HOME_TAG,
  LEGAL_TAG,
  PORTFOLIO_TAG,
  SERVICES_TAG,
  SETTINGS_TAG,
} from "./tag";
import type { SiteContent } from "./types";

/**
 * Per-route published reads. Each is the original published-read shape —
 * `"use cache"`, its tags, `cacheLife`, then one `provider.read` — so Next.js
 * registers those tags on the page that called it.
 *
 * A shared layout cannot take part: with Cache Components, layout and page are
 * separate work units, and a second tagged read is a second provider round
 * trip. Header, footer and the page body therefore share one of these
 * functions, and publishing About expires `ABOUT_TAG` without dropping Services.
 */

async function publishedContent(): Promise<SiteContent> {
  const provider = await getManagedContentProvider();
  return provider.read("published");
}

/** Header, footer and default SEO — every public surface that is not a page of its own. */
export async function readPublishedChrome(): Promise<SiteContent> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheTag(LEGAL_TAG);
  cacheLife("managedContent");
  return publishedContent();
}

export async function readPublishedHome(): Promise<SiteContent> {
  "use cache";
  cacheTag(HOME_TAG);
  cacheTag(PORTFOLIO_TAG);
  cacheTag(BOUTIQUE_TAG);
  cacheTag(SETTINGS_TAG);
  cacheTag(LEGAL_TAG);
  cacheLife("managedContent");
  return publishedContent();
}

export async function readPublishedPortfolio(): Promise<SiteContent> {
  "use cache";
  cacheTag(PORTFOLIO_TAG);
  cacheTag(SETTINGS_TAG);
  cacheTag(LEGAL_TAG);
  cacheLife("managedContent");
  return publishedContent();
}

export async function readPublishedBoutique(): Promise<SiteContent> {
  "use cache";
  cacheTag(BOUTIQUE_TAG);
  cacheTag(SETTINGS_TAG);
  cacheTag(LEGAL_TAG);
  cacheLife("managedContent");
  return publishedContent();
}

export async function readPublishedServices(): Promise<SiteContent> {
  "use cache";
  cacheTag(SERVICES_TAG);
  cacheTag(SETTINGS_TAG);
  cacheTag(LEGAL_TAG);
  cacheLife("managedContent");
  return publishedContent();
}

export async function readPublishedAbout(): Promise<SiteContent> {
  "use cache";
  cacheTag(ABOUT_TAG);
  cacheTag(SETTINGS_TAG);
  cacheTag(LEGAL_TAG);
  cacheLife("managedContent");
  return publishedContent();
}

export async function readPublishedContact(): Promise<SiteContent> {
  "use cache";
  cacheTag(CONTACT_TAG);
  cacheTag(SETTINGS_TAG);
  cacheTag(LEGAL_TAG);
  cacheLife("managedContent");
  return publishedContent();
}
