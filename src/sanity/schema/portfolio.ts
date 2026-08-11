import { defineArrayMember, defineField, defineType } from "sanity";

import { PORTFOLIO_UNIVERSES } from "@/managed-content/types";

/**
 * Portfolio Projects, and the page that lists them.
 *
 * This is the one collection in the schema — everything else WeCreate edits is
 * a singleton. Projects are created, ordered and retired by editors, which is
 * exactly what a portfolio is.
 *
 * The required fields below mirror the publication rule in
 * `src/managed-content/portfolio.ts`. The Studio asks for them so an editor is
 * told at the point of writing; the application enforces them at read time so a
 * project that slipped through — imported, or drafted before the rule existed —
 * still cannot reach a visitor.
 */

export const portfolioProject = defineType({
  name: "portfolioProject",
  title: "Projet",
  type: "document",
  groups: [
    { name: "editorial", title: "Éditorial", default: true },
    { name: "media", title: "Média" },
    { name: "rights", title: "Droits et accessibilité" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      group: "editorial",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Adresse",
      type: "slug",
      group: "editorial",
      options: { source: "title", maxLength: 96 },
      description: "Le projet est publié sur /portfolio/<adresse>.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "client",
      title: "Client",
      type: "string",
      group: "editorial",
      description:
        "Le nom sous lequel le client accepte d'être cité. « Mariage privé » quand il souhaite rester anonyme.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "universe",
      title: "Univers",
      type: "string",
      group: "editorial",
      options: {
        list: PORTFOLIO_UNIVERSES.map((universe) => ({
          title: universe,
          value: universe,
        })),
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "projectType",
      title: "Type de prestation",
      type: "string",
      group: "editorial",
      description: "Affiché à côté du client, ex. « Visite premium ».",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Date de mise en ligne",
      type: "date",
      group: "editorial",
      description:
        "Détermine l'ordre du portfolio et des travaux récents, du plus récent au plus ancien.",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 4,
      group: "editorial",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "role",
      title: "Rôle de WeCreate",
      type: "text",
      rows: 3,
      group: "editorial",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "deliverables",
      title: "Livrables",
      type: "array",
      group: "editorial",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.required().min(1),
    }),

    defineField({
      name: "media",
      title: "Affiche",
      type: "mediaFrame",
      group: "media",
      description:
        "Le format de la carte, et l'affiche si vous en fournissez une. Sans image, l'affiche est générée à partir de la vidéo.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "video",
      title: "Vidéo",
      type: "mux.video",
      group: "media",
      description:
        "Déposez le fichier : l'encodage, le streaming adaptatif et l'affiche sont pris en charge automatiquement.",
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: "hasPublicationPermission",
      title: "Le client autorise la publication",
      type: "boolean",
      group: "rights",
      initialValue: false,
      description:
        "Sans cette autorisation, le projet reste visible en prévisualisation et n'est jamais publié.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "spokenContent",
      title: "Contenu parlé",
      type: "string",
      group: "rights",
      initialValue: "none",
      options: {
        list: [
          { title: "Aucune parole porteuse de sens", value: "none" },
          { title: "Sous-titres dans la vidéo", value: "captions" },
          { title: "Transcription ci-dessous", value: "transcript" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "transcript",
      title: "Transcription",
      type: "text",
      rows: 8,
      group: "rights",
      hidden: ({ parent }) => parent?.spokenContent !== "transcript",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as
            | { spokenContent?: string }
            | undefined;
          if (parent?.spokenContent === "transcript" && !value) {
            return "Une vidéo dont la parole porte du sens doit avoir une transcription.";
          }
          return true;
        }),
    }),
  ],
  orderings: [
    {
      name: "publishedAtDesc",
      title: "Du plus récent au plus ancien",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "title", client: "client", universe: "universe" },
    prepare: ({ title, client, universe }) => ({
      title,
      subtitle: [client, universe].filter(Boolean).join(" · "),
    }),
  },
});

export const portfolioPage = defineType({
  name: "portfolioPage",
  title: "Page portfolio",
  type: "document",
  fields: [
    defineField({
      name: "seo",
      title: "Référencement",
      type: "object",
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
    defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
    defineField({ name: "headline", title: "Titre", type: "splitHeadline" }),
    defineField({
      name: "allUniversesLabel",
      title: "Libellé du filtre « tous »",
      type: "string",
    }),
    defineField({
      name: "emptyStateText",
      title: "Message quand aucun projet n'est publié",
      type: "string",
    }),
  ],
  preview: {
    prepare: () => ({ title: "Page portfolio" }),
  },
});
