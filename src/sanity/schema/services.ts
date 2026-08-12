import { defineField, defineType, type FieldDefinition } from "sanity";

import { visibilityField } from "./objects";

/**
 * The Services page: WeCreate's three universes, their packs, the Entreprises
 * comparison and the add-ons.
 *
 * A singleton with a fixed set of named sections, like the homepage. Editors
 * own the prices, the inclusions, the wording and the order — the arrays below
 * are drag-to-reorder, and that order is the order the page renders. They do
 * not own the page's structure (ADR-0001).
 *
 * Nothing here can make an offer purchasable. There is no SKU field, no price
 * in a currency other than whole XOF and no purchase switch, because a service
 * offer ends in a Service Enquiry and never in the Digital Cart (ADR-0006).
 */

/** Whole FCFA, the only currency WeCreate publishes or charges. */
function priceField(description: string): FieldDefinition {
  return defineField({
    name: "priceXof",
    title: "Prix (FCFA)",
    type: "number",
    description,
    validation: (rule) => rule.required().integer().positive(),
  });
}

export const servicePack = defineType({
  name: "servicePack",
  title: "Pack",
  type: "object",
  fields: [
    defineField({
      name: "id",
      title: "Identifiant",
      type: "slug",
      options: { source: "name" },
      description: "Reste stable même si le pack est renommé.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "name",
      title: "Nom",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    priceField(
      "Montant en francs CFA, sans décimale. Reste renseigné même pour un pack affiché « sur demande » : c'est le point de départ du devis.",
    ),
    defineField({
      name: "priceUnit",
      title: "Unité du prix",
      type: "string",
      description: "Par exemple « par mois » ou « à l'unité ». Vide si le prix est global.",
    }),
    defineField({
      name: "isOnRequest",
      title: "Sur demande",
      type: "boolean",
      initialValue: false,
      description:
        "Affiche « Sur demande » à la place du montant. Le pack reste contactable.",
    }),
    defineField({ name: "audience", title: "Cible", type: "string" }),
    defineField({
      name: "commitment",
      title: "Engagement",
      type: "string",
      description: "Par exemple « 3 mois » ou « Prestation ponctuelle ».",
    }),
    defineField({
      name: "paymentTerms",
      title: "Conditions de paiement",
      type: "text",
      rows: 2,
      description:
        "Information commerciale affichée telle quelle. Le site ne calcule et n'encaisse aucun acompte de prestation.",
    }),
    defineField({
      name: "inclusions",
      title: "Ce qui est inclus",
      type: "array",
      of: [{ type: "string" }],
      validation: (rule) => rule.min(1),
    }),
  ],
  preview: {
    select: { title: "name", priceXof: "priceXof", priceUnit: "priceUnit" },
    prepare: ({ title, priceXof, priceUnit }) => ({
      title,
      subtitle: [priceXof ? `${priceXof} F` : null, priceUnit]
        .filter(Boolean)
        .join(" "),
    }),
  },
});

export const serviceUniverse = defineType({
  name: "serviceUniverse",
  title: "Univers",
  type: "object",
  fields: [
    defineField({
      name: "key",
      title: "Identifiant",
      type: "slug",
      options: { source: "title" },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "intro", title: "Introduction", type: "text", rows: 3 }),
    defineField({
      name: "packs",
      title: "Packs",
      type: "array",
      of: [{ type: "servicePack" }],
      description: "L'ordre de cette liste est l'ordre d'affichage sur la page.",
      validation: (rule) => rule.min(1),
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "kicker" },
  },
});

export const comparisonRow = defineType({
  name: "comparisonRow",
  title: "Ligne du comparatif",
  type: "object",
  fields: [
    defineField({
      name: "key",
      title: "Identifiant",
      type: "slug",
      options: { source: "label" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Critère",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "values",
      title: "Valeurs",
      type: "array",
      of: [{ type: "string" }],
      description:
        "Une valeur par colonne, dans le même ordre que les colonnes du comparatif.",
    }),
  ],
  preview: {
    select: { title: "label", values: "values" },
    prepare: ({ title, values }) => ({
      title,
      subtitle: (values as string[] | undefined)?.join(" · "),
    }),
  },
});

export const serviceAddOn = defineType({
  name: "serviceAddOn",
  title: "Add-on",
  type: "object",
  fields: [
    defineField({
      name: "key",
      title: "Identifiant",
      type: "slug",
      options: { source: "title" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    priceField("Montant en francs CFA, sans décimale."),
    defineField({
      name: "priceUnit",
      title: "Unité du prix",
      type: "string",
      description: "Par exemple « par vidéo ». Vide si le prix est forfaitaire.",
    }),
    defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
  ],
  preview: {
    select: { title: "title", subtitle: "description" },
  },
});

export const servicesPage = defineType({
  name: "servicesPage",
  title: "Page services",
  type: "document",
  groups: [
    { name: "intro", title: "En-tête", default: true },
    { name: "enquiry", title: "Demande de service" },
    { name: "offers", title: "Offres" },
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
      name: "methodColumns",
      title: "Colonnes de méthode",
      type: "array",
      of: [{ type: "text" }],
      group: "intro",
      description: "Trois paragraphes affichés sous le titre.",
    }),
    defineField({
      name: "onRequestLabel",
      title: "Mention « sur demande »",
      type: "string",
      group: "intro",
      description: "Affichée à la place du prix des packs cochés « Sur demande ».",
    }),

    defineField({
      name: "enquiry",
      title: "Demande de service",
      type: "object",
      group: "enquiry",
      description:
        "Les deux actions d'un pack quittent le site : WhatsApp prérempli et l'appel découverte hébergé. Aucune commande, aucune date bloquée, aucun paiement.",
      fields: [
        defineField({ name: "title", title: "Titre du bloc", type: "string" }),
        defineField({
          name: "notice",
          title: "Ce que déclenche un contact",
          type: "text",
          rows: 4,
          description:
            "Dit au visiteur, à l'endroit où il clique, qu'il ouvre une conversation et rien d'autre.",
        }),
        defineField({
          name: "whatsappLabel",
          title: "Libellé du bouton WhatsApp",
          type: "string",
        }),
        defineField({
          name: "whatsappMessageTemplate",
          title: "Message WhatsApp prérempli",
          type: "text",
          rows: 3,
          description: "%s est remplacé par le pack choisi et son univers.",
        }),
        defineField({
          name: "discoveryCallLabel",
          title: "Libellé du bouton appel découverte",
          type: "string",
        }),
        defineField({
          name: "discoveryCallNote",
          title: "Précision sur l'appel découverte",
          type: "text",
          rows: 3,
        }),
      ],
    }),

    defineField({
      name: "universes",
      title: "Univers",
      type: "array",
      of: [{ type: "serviceUniverse" }],
      group: "offers",
      description: "L'ordre de cette liste est l'ordre d'affichage sur la page.",
    }),

    defineField({
      name: "comparison",
      title: "Comparatif Entreprises",
      type: "object",
      group: "offers",
      fields: [
        visibilityField(),
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({ name: "title", title: "Titre", type: "string" }),
        defineField({
          name: "caption",
          title: "Légende du tableau",
          type: "string",
          description:
            "Lue par les lecteurs d'écran pour annoncer ce que le tableau compare.",
        }),
        defineField({
          name: "columns",
          title: "Colonnes",
          type: "array",
          of: [{ type: "string" }],
          description: "Les packs comparés, dans l'ordre des colonnes.",
        }),
        defineField({
          name: "rows",
          title: "Lignes",
          type: "array",
          of: [{ type: "comparisonRow" }],
        }),
      ],
    }),

    defineField({
      name: "addOns",
      title: "Add-ons",
      type: "object",
      group: "offers",
      fields: [
        visibilityField(),
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({ name: "title", title: "Titre", type: "string" }),
        defineField({
          name: "addOns",
          title: "Options",
          type: "array",
          of: [{ type: "serviceAddOn" }],
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Page services" }),
  },
});
