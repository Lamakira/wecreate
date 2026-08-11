import "server-only";

import { getSanityClient } from "@/sanity/client";
import { assertSanityConfigured } from "@/sanity/env";

import { DEFAULT_SITE_CONTENT } from "../default-content";
import { mergeContent, type DeepPartial } from "../merge";
import type { ManagedContentProvider } from "../provider";
import type { SiteContent } from "../types";
import { SITE_CONTENT_QUERY } from "./query";

/**
 * Sanity returns every unfilled field as `null`, and returns `null` for the
 * whole document when it does not exist yet.
 */
type SanityContentResult = DeepPartial<SiteContent> | null;

export const sanityContentProvider: ManagedContentProvider = {
  id: "sanity",
  async read(perspective) {
    assertSanityConfigured();

    const client = getSanityClient(perspective);
    const result = await client.fetch<SanityContentResult>(SITE_CONTENT_QUERY);
    const content = mergeContent(DEFAULT_SITE_CONTENT, result);

    return {
      ...content,
      homePage: {
        ...content.homePage,
        // Portfolio Projects (issue #3) and Digital Products (issue #7) are not
        // modelled in Sanity yet. Until they are, these lists stay empty rather
        // than falling back to the bundled sample entries: WeCreate publishes
        // only real, approved work, so an unfinished section shows its empty
        // state instead of fabricated projects or products.
        recentWork: { ...content.homePage.recentWork, projects: [] },
        shopPreview: { ...content.homePage.shopPreview, products: [] },
      },
    };
  },
};
