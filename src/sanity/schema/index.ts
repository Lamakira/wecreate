import type { SchemaTypeDefinition } from "sanity";

import { aboutPage } from "./about-page";
import { contactPage } from "./contact-page";
import { homePage } from "./home-page";
import { legalDocument, legalRevision, legalSection } from "./legal";
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

/**
 * Document types presented as a single editable document, not a collection.
 *
 * `legalDocument` belongs here even though there are five of them: the Studio
 * pins one document id per legal kind, so each is opened from the sidebar and
 * none can be created or deleted.
 */
export const SINGLETON_TYPES = [
  "siteSettings",
  "homePage",
  "portfolioPage",
  "servicesPage",
  "aboutPage",
  "contactPage",
  "legalDocument",
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
  legalDocument,
  legalRevision,
  legalSection,
  ...objectTypes,
];
