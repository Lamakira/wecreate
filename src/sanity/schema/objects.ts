import {
  defineField,
  defineType,
  type FieldDefinition,
  type SchemaTypeDefinition,
} from "sanity";

/**
 * Reusable field objects.
 *
 * Every one of these is a closed shape with named fields. There is deliberately
 * no rich-text or free-form block type anywhere in this schema: editors change
 * WeCreate's words, never its layout or markup.
 */

/**
 * The switch every optional section carries.
 *
 * Hiding a section is the whole of an editor's control over a page's shape:
 * they cannot add one, remove one or reorder them (ADR-0001). One definition,
 * so every page offers the same wording for the same decision.
 */
export function visibilityField(): FieldDefinition {
  return defineField({
    name: "isVisible",
    title: "Section affichée",
    type: "boolean",
    initialValue: true,
    description: "Décochez pour retirer la section de la page publique.",
  });
}

/**
 * The destinations a link field will accept: a path on this site, an `https:`
 * address, or a `mailto:`.
 *
 * These fields are plain strings rather than Sanity's `url` type because a
 * relative path is the common case and `url` rejects one. That leaves the
 * scheme unconstrained, which is worth closing at the point an editor types it.
 *
 * Not, to be clear, an XSS control — React refuses to render a `javascript:`
 * href at all, rewriting it to a stub that throws, and browsers refuse
 * top-level navigation to `data:`. This is the Studio telling an editor that a
 * destination will not work *before* it reaches a page, rather than the page
 * silently declining to follow it. The list is the one `isExternalHref` in
 * `src/components/primitives/cta-link.tsx` knows how to render.
 */
const LINK_DESTINATION_PATTERN = /^(\/(?![/\\])[^\s\\]*|https:\/\/[^\s]+|mailto:[^\s]+)$/;

function linkDestinationField(
  name: string,
  title: string,
  description?: string,
): FieldDefinition {
  return defineField({
    name,
    title,
    type: "string",
    description,
    validation: (rule) =>
      rule
        .required()
        .regex(LINK_DESTINATION_PATTERN, {
          name: "destination",
          invert: false,
        })
        .error(
          "Un chemin interne commençant par / (ex. /portfolio), une adresse https:// ou un lien mailto:.",
        ),
  });
}

export const callToAction = defineType({
  name: "callToAction",
  title: "Bouton",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Libellé",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    linkDestinationField(
      "href",
      "Destination",
      "Chemin interne (ex. /portfolio) ou adresse complète (ex. https://wa.me/…).",
    ),
  ],
  preview: {
    select: { title: "label", subtitle: "href" },
  },
});

export const splitHeadline = defineType({
  name: "splitHeadline",
  title: "Titre",
  type: "object",
  description:
    "Le mot en accent est affiché en italique, la signature typographique de la marque.",
  fields: [
    defineField({ name: "lead", title: "Avant l'accent", type: "string" }),
    defineField({
      name: "emphasis",
      title: "Mot en accent",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "trail", title: "Après l'accent", type: "string" }),
  ],
  preview: {
    select: { lead: "lead", emphasis: "emphasis", trail: "trail" },
    prepare: ({ lead, emphasis, trail }) => ({
      title: `${lead ?? ""}${emphasis ?? ""}${trail ?? ""}`.trim(),
    }),
  },
});

export const mediaFrame = defineType({
  name: "mediaFrame",
  title: "Visuel",
  type: "object",
  description:
    "Tant que le visuel définitif n'est pas fourni, le cadre affiche un repère gris au bon format.",
  fields: [
    defineField({
      name: "ratio",
      title: "Format",
      type: "string",
      initialValue: "16 / 9",
      options: {
        list: [
          { title: "Vertical 9:16", value: "9 / 16" },
          { title: "Horizontal 16:9", value: "16 / 9" },
          { title: "Portrait 4:5", value: "4 / 5" },
          { title: "Paysage 4:3", value: "4 / 3" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "placeholderLabel",
      title: "Libellé du repère",
      type: "string",
      description: "Texte affiché dans le cadre en attendant le visuel réel.",
    }),
    defineField({ name: "image", title: "Image", type: "image" }),
    defineField({
      name: "alternativeText",
      title: "Texte alternatif",
      type: "string",
      description:
        "Décrit l'image pour les personnes qui ne la voient pas. Obligatoire dès qu'une image est ajoutée.",
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { image?: unknown } | undefined;
          if (parent?.image && !value) {
            return "Une image publiée doit avoir un texte alternatif.";
          }
          return true;
        }),
    }),
  ],
});

export const navigationLink = defineType({
  name: "navigationLink",
  title: "Lien de navigation",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Libellé",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    linkDestinationField("href", "Chemin"),
  ],
  preview: { select: { title: "label", subtitle: "href" } },
});

export const socialAccount = defineType({
  name: "socialAccount",
  title: "Compte social",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Libellé",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "url",
      title: "Adresse",
      type: "url",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "label", subtitle: "url" } },
});

export const universeCard = defineType({
  name: "universeCard",
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
    defineField({ name: "description", title: "Description", type: "text", rows: 3 }),
    defineField({ name: "linkLabel", title: "Libellé du lien", type: "string" }),
    linkDestinationField("href", "Destination"),
    defineField({ name: "media", title: "Visuel", type: "mediaFrame" }),
  ],
  preview: { select: { title: "title", subtitle: "kicker" } },
});

export const proofPoint = defineType({
  name: "proofPoint",
  title: "Preuve",
  type: "object",
  fields: [
    defineField({
      name: "figure",
      title: "Chiffre ou formule",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
  ],
  preview: { select: { title: "figure", subtitle: "description" } },
});

/**
 * A titled line with a short description, under its own name.
 *
 * A method step and a line of *L'équipe* hold the same three fields but are not
 * the same thing to an editor, so each gets its own type with its own label and
 * its own guidance — while the shape stays written once.
 */
function titledLine(
  name: string,
  title: string,
  description: string,
): SchemaTypeDefinition {
  return defineType({
    name,
    title,
    type: "object",
    description,
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
      defineField({ name: "description", title: "Description", type: "text", rows: 2 }),
    ],
    preview: { select: { title: "title", subtitle: "description" } },
  });
}

export const numberedStep = titledLine(
  "numberedStep",
  "Étape",
  "Le numéro affiché (01, 02…) vient de la position de l'étape dans la liste : réordonnez, et la numérotation suit.",
);

export const capability = titledLine(
  "capability",
  "Ligne",
  "Un savoir-faire ou un élément de matériel. Pour l'équipe, nommez le rôle : n'écrivez le nom d'une personne qu'une fois que WeCreate a validé qu'il soit public.",
);

export const objectTypes = [
  callToAction,
  splitHeadline,
  mediaFrame,
  navigationLink,
  socialAccount,
  universeCard,
  proofPoint,
  numberedStep,
  capability,
];
