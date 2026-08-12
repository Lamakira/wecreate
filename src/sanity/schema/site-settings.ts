import { defineField, defineType } from "sanity";

/**
 * Global content shared by every page: navigation labels, contact and social
 * details, footer copy and SEO defaults.
 *
 * A singleton — `structure.ts` presents it as one editable document rather than
 * a collection, and `documentActions` withholds create and delete.
 */
export const siteSettings = defineType({
  name: "siteSettings",
  title: "Paramètres du site",
  type: "document",
  groups: [
    { name: "brand", title: "Marque", default: true },
    { name: "navigation", title: "Navigation" },
    { name: "contact", title: "Contact" },
    { name: "footer", title: "Pied de page" },
    { name: "seo", title: "Référencement" },
  ],
  fields: [
    defineField({
      name: "brandName",
      title: "Nom de la marque",
      type: "string",
      group: "brand",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "positioningLine",
      title: "Ligne de positionnement",
      type: "string",
      group: "brand",
      description: "Affichée dans le bandeau défilant et le pied de page.",
    }),
    defineField({
      name: "navigation",
      title: "Liens de navigation",
      type: "array",
      of: [{ type: "navigationLink" }],
      group: "navigation",
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: "headerCta",
      title: "Bouton « Réserver un appel »",
      type: "callToAction",
      group: "navigation",
      description:
        "Masqué sur les écrans étroits ; la navigation principale reste accessible sans lui.",
    }),
    defineField({
      name: "contact",
      title: "Coordonnées",
      type: "object",
      group: "contact",
      // These are the three approved ways to reach WeCreate, and the Contact
      // page is built out of them. A label left empty here would ship a link
      // with no accessible name, so the Studio refuses it while the editor is
      // still looking at the field.
      fields: [
        defineField({
          name: "whatsappLabel",
          title: "Libellé WhatsApp",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "whatsappUrl",
          title: "Lien WhatsApp",
          type: "url",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "discoveryCallLabel",
          title: "Libellé de l'appel découverte",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "discoveryCallUrl",
          title: "Lien de l'appel découverte",
          type: "url",
          description:
            "La page Calendly hébergée de l'appel découverte de 30 minutes. Le site n'y charge aucun widget : c'est un lien, ouvert dans un nouvel onglet.",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "email",
          title: "Email",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({ name: "locationLabel", title: "Localisation", type: "string" }),
      ],
    }),
    defineField({
      name: "socialAccounts",
      title: "Réseaux sociaux",
      type: "array",
      of: [{ type: "socialAccount" }],
      group: "contact",
    }),
    defineField({
      name: "footer",
      title: "Pied de page",
      type: "object",
      group: "footer",
      fields: [
        defineField({ name: "baseline", title: "Baseline", type: "text", rows: 2 }),
        defineField({
          name: "navigationHeading",
          title: "Titre « Navigation »",
          type: "string",
        }),
        defineField({
          name: "contactHeading",
          title: "Titre « Contact »",
          type: "string",
        }),
        defineField({
          name: "socialHeading",
          title: "Titre « Réseaux »",
          type: "string",
        }),
        defineField({ name: "legalLine", title: "Mention légale", type: "string" }),
      ],
    }),
    defineField({
      name: "seo",
      title: "Référencement par défaut",
      type: "object",
      group: "seo",
      fields: [
        defineField({ name: "siteName", title: "Nom du site", type: "string" }),
        defineField({
          name: "titleTemplate",
          title: "Gabarit de titre",
          type: "string",
          description: "%s est remplacé par le titre de la page.",
        }),
        defineField({ name: "defaultTitle", title: "Titre par défaut", type: "string" }),
        defineField({
          name: "defaultDescription",
          title: "Description par défaut",
          type: "text",
          rows: 3,
        }),
        defineField({
          name: "openGraphImage",
          title: "Image de partage",
          type: "image",
        }),
        defineField({
          name: "openGraphLocale",
          title: "Locale Open Graph",
          type: "string",
          initialValue: "fr_BJ",
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Paramètres du site" }),
  },
});
