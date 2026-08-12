import type { SchemaTypeDefinition } from "sanity";

import { aboutPage } from "./about-page";
import { contactPage } from "./contact-page";
import { homePage } from "./home-page";
import { objectTypes } from "./objects";
import { portfolioPage, portfolioProject } from "./portfolio";
import {
  comparisonRow,
  serviceAddOn,
  servicePack,
  serviceUniverse,
  servicesPage,
} from "./services";
import { siteSettings } from "./site-settings";

/** Document types presented as a single editable document, not a collection. */
export const SINGLETON_TYPES = [
  "siteSettings",
  "homePage",
  "portfolioPage",
  "servicesPage",
  "aboutPage",
  "contactPage",
] as const;

export const schemaTypes: SchemaTypeDefinition[] = [
  siteSettings,
  homePage,
  portfolioPage,
  portfolioProject,
  servicesPage,
  serviceUniverse,
  servicePack,
  comparisonRow,
  serviceAddOn,
  aboutPage,
  contactPage,
  ...objectTypes,
];
