import { defineField, defineType } from "sanity";

/**
 * The Contact page: what each of WeCreate's three channels is for, and how a
 * project starts.
 *
 * The channels themselves are not here. WhatsApp, the hosted Discovery Call and
 * the administrative email are edited once under *Paramètres du site* → Contact,
 * so the header, the footer, every service pack and this page can never disagree
 * about an address.
 *
 * There is deliberately no form to configure. Version one takes no generic
 * service enquiry and stores no lead (ADR-0006), so this page is three links and
 * an explanation — there is nothing here that could submit anything.
 */
export const contactPage = defineType({
  name: "contactPage",
  title: "Page contact",
  type: "document",
  groups: [
    { name: "intro", title: "En-tête", default: true },
    { name: "channels", title: "Coordonnées" },
    { name: "gettingStarted", title: "Comment démarrer" },
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
      name: "responseExpectation",
      title: "Délai de réponse",
      type: "string",
      group: "intro",
      description: "Ce que WeCreate s'engage à tenir, affiché avant que le visiteur écrive.",
    }),

    defineField({
      name: "channels",
      title: "Coordonnées",
      type: "object",
      group: "channels",
      description:
        "Les adresses elles-mêmes se modifient dans « Paramètres du site » → Contact. Ici, on écrit à quoi sert chacune.",
      fields: [
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({
          name: "notice",
          title: "Ce que déclenche un message",
          type: "text",
          rows: 4,
          description:
            "Dit au visiteur, là où il clique, qu'il ouvre une conversation et rien d'autre.",
        }),
        defineField({
          name: "whatsappNote",
          title: "Précision WhatsApp",
          type: "text",
          rows: 2,
        }),
        defineField({
          name: "discoveryCallNote",
          title: "Précision appel découverte",
          type: "text",
          rows: 3,
        }),
        defineField({
          name: "emailLabel",
          title: "Libellé de l'email",
          type: "string",
          description: "Par exemple « Email administratif ».",
        }),
        defineField({
          name: "emailNote",
          title: "Précision email",
          type: "text",
          rows: 2,
        }),
        defineField({ name: "socialKicker", title: "Sur-titre réseaux", type: "string" }),
        defineField({
          name: "locationNote",
          title: "Mention du studio",
          type: "string",
        }),
      ],
    }),

    defineField({
      name: "gettingStarted",
      title: "Comment démarrer",
      type: "object",
      group: "gettingStarted",
      fields: [
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({
          name: "steps",
          title: "Étapes",
          type: "array",
          of: [{ type: "numberedStep" }],
          description: "Numérotées automatiquement dans l'ordre de cette liste.",
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Page contact" }),
  },
});
