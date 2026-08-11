import type { SchemaTypeDefinition } from "sanity";

import { homePage } from "./home-page";
import { objectTypes } from "./objects";
import { portfolioPage, portfolioProject } from "./portfolio";
import { siteSettings } from "./site-settings";

/** Document types presented as a single editable document, not a collection. */
export const SINGLETON_TYPES = [
  "siteSettings",
  "homePage",
  "portfolioPage",
] as const;

export const schemaTypes: SchemaTypeDefinition[] = [
  siteSettings,
  homePage,
  portfolioPage,
  portfolioProject,
  ...objectTypes,
];
