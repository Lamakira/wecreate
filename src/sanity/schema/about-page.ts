import { defineField, defineType, type FieldDefinition } from "sanity";

import { visibilityField } from "./objects";

/**
 * The À propos page: WeCreate's story, its method, what it is made of and where
 * it works.
 *
 * A singleton with a fixed set of named sections, like the homepage and the
 * services page. Editors own the words, the steps and the lines under *L'équipe*
 * and *L'équipement*; they do not own the page's structure (ADR-0001).
 */

/** *L'équipe* and *L'équipement* are the same shape, so they are defined once. */
function capabilityColumn(
  name: string,
  title: string,
  description: string,
): FieldDefinition {
  return defineField({
    name,
    title,
    type: "object",
    group: "sections",
    description,
    fields: [
      defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
      defineField({
        name: "items",
        title: "Lignes",
        type: "array",
        of: [{ type: "capability" }],
        description: "L'ordre de cette liste est l'ordre d'affichage.",
      }),
    ],
  });
}

export const aboutPage = defineType({
  name: "aboutPage",
  title: "Page à propos",
  type: "document",
  groups: [
    { name: "intro", title: "En-tête", default: true },
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

    defineField({ name: "kicker", title: "Sur-titre", type: "string", group: "intro" }),
    defineField({
      name: "headline",
      title: "Titre",
      type: "splitHeadline",
      group: "intro",
    }),

    defineField({
      name: "story",
      title: "Le récit",
      type: "object",
      group: "sections",
      fields: [
        defineField({
          name: "paragraphs",
          title: "Paragraphes",
          type: "array",
          of: [{ type: "text" }],
        }),
        defineField({
          name: "brandStatement",
          title: "Phrase de marque",
          type: "text",
          rows: 3,
          description:
            "Affichée en grand, en italique. Réservée aux formules que WeCreate a validées.",
        }),
        defineField({
          name: "portrait",
          title: "Portrait du studio",
          type: "mediaFrame",
          description:
            "Tant qu'aucune photo n'est ajoutée, le cadre affiche un repère gris au format 4:5 : la page ne fait jamais passer un visuel d'attente pour une vraie photo.",
        }),
      ],
    }),

    defineField({
      name: "method",
      title: "La méthode",
      type: "object",
      group: "sections",
      fields: [
        visibilityField(),
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({ name: "title", title: "Titre", type: "string" }),
        defineField({
          name: "steps",
          title: "Étapes",
          type: "array",
          of: [{ type: "numberedStep" }],
          description: "Numérotées automatiquement dans l'ordre de cette liste.",
        }),
      ],
    }),

    capabilityColumn(
      "team",
      "L'équipe",
      "Nommez les rôles. Un nom de personne ne s'écrit ici qu'une fois que WeCreate a validé qu'il apparaisse publiquement.",
    ),
    capabilityColumn("equipment", "L'équipement", "Le matériel utilisé en tournage."),

    defineField({
      name: "coverage",
      title: "Zone d'intervention",
      type: "object",
      group: "sections",
      fields: [
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({ name: "text", title: "Texte", type: "text", rows: 3 }),
        defineField({ name: "link", title: "Lien", type: "callToAction" }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Page à propos" }),
  },
});
