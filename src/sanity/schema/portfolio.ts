import { defineArrayMember, defineField, defineType } from "sanity";

import {
  DEFAULT_DISCIPLINE,
  DISCIPLINES,
  disciplineLabel,
  type Discipline,
} from "@/discipline";
import { PORTFOLIO_UNIVERSES } from "@/managed-content/types";

/**
 * The Discipline a document belongs to. A project created before Disciplines
 * existed has none, and is Vidéographie.
 */
function disciplineOf(document: unknown): Discipline {
  const value = (document as { discipline?: string } | undefined)?.discipline;
  return (
    DISCIPLINES.find((discipline) => discipline === value) ?? DEFAULT_DISCIPLINE
  );
}

/** A Vidéographie project is published as a film, the others as images. */
function isFilmedDocument(document: unknown): boolean {
  return disciplineOf(document) === "videographie";
}

/** The formats a Branding or Site web project's card may take. */
const IMAGE_RATIOS: Partial<
  Record<Discipline, { ratios: string[]; message: string }>
> = {
  branding: {
    ratios: ["4 / 5", "1 / 1"],
    message: "Une charte s'affiche en 4:5 ou en 1:1.",
  },
  "site-web": {
    ratios: ["16 / 10"],
    message: "Un site s'affiche en 16:10.",
  },
};

/**
 * Portfolio Projects, and the page that lists them.
 *
 * This is the one collection in the schema — everything else WeCreate edits is
 * a singleton. Projects are created, ordered and retired by editors, which is
 * exactly what a portfolio is.
 *
 * A project's Discipline decides what it is published with: a film for
 * Vidéographie, images for Branding and Site web. The Studio hides the fields
 * of the other kind, and the required fields below mirror the publication rule
 * per Discipline in `src/managed-content/portfolio.ts`. A hidden field is still
 * validated, so every rule that belongs to one kind checks the Discipline
 * first. The Studio asks for them so an editor is told at the point of
 * writing; the application enforces them at read time so a project that
 * slipped through — imported, or drafted before the rule existed — still
 * cannot reach a visitor.
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
      name: "discipline",
      title: "Discipline",
      type: "string",
      group: "editorial",
      options: {
        list: DISCIPLINES.map((discipline) => ({
          title: disciplineLabel(discipline),
          value: discipline,
        })),
        layout: "radio",
      },
      initialValue: "videographie",
      description:
        "Vidéographie : le projet est publié avec son film. Branding et Site web : avec ses images. Un projet créé avant ce choix est en Vidéographie.",
      // Not required: an unset value already means Vidéographie, and requiring
      // it would block editing every project that predates the choice.
    }),
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
      hidden: ({ document }) => !isFilmedDocument(document),
      validation: (rule) =>
        rule.custom((value, context) =>
          isFilmedDocument(context.document) && !value
            ? "Choisissez l'univers du film."
            : true,
        ),
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
        "Le format de la carte, et l'affiche si vous en fournissez une. Sans image, l'affiche est générée à partir de la vidéo (Vidéographie) ou reprend la première image (Branding, Site web). Le texte alternatif reste obligatoire dès qu'il y a une image.",
      validation: (rule) =>
        rule.required().custom((value, context) => {
          const media = value as
            | { alternativeText?: string; ratio?: string; image?: unknown }
            | undefined;
          if (isFilmedDocument(context.document)) {
            // `mediaFrame` asks for alternative text only once an image is
            // uploaded, which is right for a card that may stay a placeholder.
            // A film always ends up with a poster — the editor's, or the one
            // the video platform generates — so it always needs describing, and
            // the publication rule refuses the project without it. Saying so
            // here means an editor is told while writing rather than by an
            // empty portfolio.
            if (!media?.alternativeText?.trim()) {
              return "Décrivez l'affiche : elle est visible même quand la vidéo ne se lit pas.";
            }
            return true;
          }
          // Images carry their own descriptions, so the poster needs one only
          // when the editor uploads a separate image for it.
          if (media?.image && !media.alternativeText?.trim()) {
            return "Décrivez l'affiche.";
          }
          const formats = IMAGE_RATIOS[disciplineOf(context.document)];
          if (formats && media?.ratio && !formats.ratios.includes(media.ratio)) {
            return formats.message;
          }
          return true;
        }),
    }),
    defineField({
      name: "video",
      title: "Vidéo",
      type: "mux.video",
      group: "media",
      description:
        "Déposez le fichier : l'encodage, le streaming adaptatif et l'affiche sont pris en charge automatiquement.",
      hidden: ({ document }) => !isFilmedDocument(document),
      validation: (rule) =>
        rule.custom((value, context) =>
          isFilmedDocument(context.document) && !value
            ? "Un projet Vidéographie est publié avec son film."
            : true,
        ),
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      group: "media",
      description:
        "Les planches de la charte ou les captures du site, dans l'ordre où elles s'affichent. La première sert d'affiche si aucune n'est fournie.",
      of: [
        defineArrayMember({
          type: "object",
          name: "projectImage",
          title: "Image",
          fields: [
            defineField({
              name: "image",
              title: "Image",
              type: "image",
              options: { hotspot: true },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "alternativeText",
              title: "Texte alternatif",
              type: "string",
              description:
                "Décrit l'image pour les personnes qui ne la voient pas.",
              validation: (rule) => rule.required(),
            }),
          ],
          preview: { select: { media: "image", title: "alternativeText" } },
        }),
      ],
      hidden: ({ document }) => isFilmedDocument(document),
      validation: (rule) =>
        rule.custom((value, context) =>
          !isFilmedDocument(context.document) && (!value || value.length === 0)
            ? "Ajoutez au moins une image : c'est ce que le projet montre."
            : true,
        ),
    }),

    defineField({
      name: "hasPublicationPermission",
      title: "Le client autorise la publication",
      type: "boolean",
      group: "rights",
      initialValue: false,
      description:
        "Sans cette autorisation, le projet reste visible en prévisualisation et n'est jamais publié.",
      // An unticked box is accepted, because deciding not to publish yet is
      // normal, but the editor is told what it means for the site.
      validation: (rule) => [
        rule.required(),
        rule
          .custom((value) =>
            value === true
              ? true
              : "Tant que cette case n'est pas cochée, le projet n'apparaîtra pas sur le site.",
          )
          .warning(),
      ],
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
      hidden: ({ document }) => !isFilmedDocument(document),
      validation: (rule) =>
        rule.custom((value, context) =>
          isFilmedDocument(context.document) && !value
            ? "Indiquez si la parole porte du sens."
            : true,
        ),
    }),
    defineField({
      name: "transcript",
      title: "Transcription",
      type: "text",
      rows: 8,
      group: "rights",
      hidden: ({ document, parent }) =>
        !isFilmedDocument(document) || parent?.spokenContent !== "transcript",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as
            | { spokenContent?: string }
            | undefined;
          if (
            isFilmedDocument(context.document) &&
            parent?.spokenContent === "transcript" &&
            !value
          ) {
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
    select: {
      title: "title",
      client: "client",
      universe: "universe",
      discipline: "discipline",
    },
    prepare: ({ title, client, universe, discipline }) => ({
      title,
      subtitle: [
        client,
        isFilmedDocument({ discipline })
          ? universe
          : disciplineLabel(disciplineOf({ discipline })),
      ]
        .filter(Boolean)
        .join(" · "),
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
