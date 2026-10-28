import { defineField, defineType } from "sanity";

import { visibilityField } from "./objects";

/**
 * A homepage: a fixed, named set of sections.
 *
 * There is one document per Discipline — Vidéographie's `homePage`,
 * `brandingHomePage` and `siteWebHomePage` — each with identical fields, so
 * publishing one leaves the other two untouched.
 *
 * Sections cannot be added, removed or reordered from the Studio — only their
 * copy and their visibility change. That is the line between Managed Content
 * and a page builder, and it is what keeps the approved design and its
 * accessibility guarantees intact (ADR-0001).
 */

function defineHomePage(name: string, title: string) {
  return defineType({
    name,
    title,
    type: "document",
    groups: [
      { name: "hero", title: "Hero", default: true },
      { name: "sections", title: "Sections" },
      { name: "seo", title: "Référencement" },
    ],
    fields: [
      defineField({
        name: "seo",
        title: "Référencement",
        type: "object",
        group: "seo",
        fields: [
          defineField({ name: "title", title: "Titre", type: "string" }),
          defineField({
            name: "description",
            title: "Description",
            type: "text",
            rows: 3,
          }),
          defineField({
            name: "openGraphImage",
            title: "Image de partage",
            type: "image",
          }),
        ],
      }),

      defineField({
        name: "hero",
        title: "Hero",
        type: "object",
        group: "hero",
        fields: [
          defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
          defineField({
            name: "headline",
            title: "Titre",
            type: "splitHeadline",
            validation: (rule) => rule.required(),
          }),
          defineField({ name: "subtitle", title: "Sous-titre", type: "text", rows: 3 }),
          defineField({ name: "primaryCta", title: "Bouton principal", type: "callToAction" }),
          defineField({ name: "secondaryCta", title: "Bouton secondaire", type: "callToAction" }),
        ],
      }),

      defineField({
        name: "positioningMarquee",
        title: "Bandeau défilant",
        type: "object",
        group: "sections",
        fields: [
          visibilityField(),
          defineField({ name: "text", title: "Texte", type: "string" }),
        ],
      }),

      defineField({
        name: "universes",
        title: "Ce qu'on fait",
        type: "object",
        group: "sections",
        fields: [
          visibilityField(),
          defineField({ name: "title", title: "Titre", type: "string" }),
          defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
          defineField({
            name: "universes",
            title: "Univers",
            type: "array",
            of: [{ type: "universeCard" }],
          }),
        ],
      }),

      defineField({
        name: "recentWork",
        title: "Travaux récents",
        type: "object",
        group: "sections",
        description:
          "La frise montre les Portfolio Projects publiés de cette discipline. Branding et Site web n'en ont aucun tant que les projets ne peuvent pas leur appartenir : la section affiche alors son message d'attente.",
        fields: [
          visibilityField(),
          defineField({ name: "headline", title: "Titre", type: "splitHeadline" }),
          defineField({ name: "link", title: "Lien", type: "callToAction" }),
          defineField({
            name: "emptyStateText",
            title: "Message quand aucun projet n'est publié",
            type: "string",
          }),
        ],
      }),

      defineField({
        name: "proof",
        title: "La différence WeCreate",
        type: "object",
        group: "sections",
        fields: [
          visibilityField(),
          defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
          defineField({
            name: "points",
            title: "Preuves",
            type: "array",
            of: [{ type: "proofPoint" }],
          }),
        ],
      }),

      defineField({
        name: "shopPreview",
        title: "Aperçu boutique",
        type: "object",
        group: "sections",
        description:
          "L'aperçu montre les Digital Products marqués comme mis en avant. Sans produit en vente, la section affiche son message d'attente.",
        fields: [
          visibilityField(),
          defineField({ name: "title", title: "Titre", type: "string" }),
          defineField({ name: "link", title: "Lien « tout voir »", type: "callToAction" }),
          defineField({
            name: "linkLabel",
            title: "Libellé du lien produit",
            type: "string",
          }),
          defineField({
            name: "emptyStateText",
            title: "Message quand aucun produit n'est en vente",
            type: "string",
          }),
        ],
      }),

      defineField({
        name: "brandQuote",
        title: "Citation de marque",
        type: "object",
        group: "sections",
        fields: [
          visibilityField(),
          defineField({ name: "quote", title: "Citation", type: "text", rows: 3 }),
          defineField({ name: "attribution", title: "Attribution", type: "string" }),
        ],
      }),

      defineField({
        name: "finalCta",
        title: "Appel à l'action final",
        type: "object",
        group: "sections",
        fields: [
          visibilityField(),
          defineField({ name: "headline", title: "Titre", type: "splitHeadline" }),
          defineField({ name: "subtitle", title: "Sous-titre", type: "string" }),
          defineField({ name: "primaryCta", title: "Bouton principal", type: "callToAction" }),
          defineField({ name: "secondaryCta", title: "Bouton secondaire", type: "callToAction" }),
        ],
      }),
    ],
    preview: {
      prepare: () => ({ title }),
    },
  });
}

export const homePage = defineHomePage("homePage", "Accueil · Vidéographie");
export const brandingHomePage = defineHomePage(
  "brandingHomePage",
  "Accueil · Branding",
);
export const siteWebHomePage = defineHomePage(
  "siteWebHomePage",
  "Accueil · Site web",
);
