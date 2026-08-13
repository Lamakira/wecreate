import { defineArrayMember, defineField, defineType } from "sanity";

import { isSafeProductReference } from "@/commerce/paid-deliverables";
import { DIGITAL_PRODUCT_FAMILY_LABELS } from "@/managed-content/digital-products";
import {
  DIGITAL_PRODUCT_FAMILIES,
  type DigitalProductFamily,
} from "@/managed-content/types";

import { apiVersion } from "../env";
import { previousSlugsField, readPublishedDocument } from "./addresses";

/**
 * Digital Products, and the Boutique that lists them.
 *
 * The second collection in this schema, after Portfolio Projects: WeCreate grows
 * both. Everything else it edits is a singleton.
 *
 * What is deliberately absent from this document type is the product itself. A
 * Paid Deliverable is a private file in the commerce system, uploaded by a
 * Commerce Operator and versioned there (issue #8); Sanity holds the cover, the
 * words, the price and the identity, and there is no file field here to put a
 * PDF in by mistake (issue #1). The one thing that crosses is the SKU, which is
 * what the two systems agree a product is.
 *
 * Three separate decisions, three separate controls. Publishing the document
 * makes the page public. *En vente* is WeCreate's intent to sell. *Archivé*
 * withdraws it without deleting it. None of the three implies another, and none
 * of them is enough on its own — a sale also needs an activated Paid Deliverable
 * Version, which is not editorial and is not here.
 */

export const digitalProduct = defineType({
  name: "digitalProduct",
  title: "Produit numérique",
  type: "document",
  groups: [
    { name: "editorial", title: "Éditorial", default: true },
    { name: "commercial", title: "Commercial" },
    { name: "availability", title: "Mise en vente" },
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
      name: "sku",
      title: "Référence produit",
      type: "string",
      group: "editorial",
      description:
        "Écrite une fois, jamais modifiée : c'est ce qu'une commande enregistre et ce à quoi le fichier livré est rattaché. Par exemple « EBK-01 ».",
      // ADR-0001 keeps stable product identifiers outside editorial control, and
      // this is where that is enforced — a description asking an editor not to
      // change it is not a rule. Both halves are refused: a SKU that has moved
      // since it was published, which would orphan every Order Snapshot and
      // Paid Deliverable Version already issued against it, and one that
      // duplicates another product's, which would make "the file for EBK-01" a
      // question with two answers.
      validation: (rule) =>
        rule.required().custom(async (sku, context) => {
          const reference = (sku as string | undefined)?.trim();
          if (!reference) {
            return true;
          }

          // The commerce system derives a private file's address from this
          // reference, so its shape is a rule rather than a convention — and the
          // editor is told here rather than by an upload the back office
          // refuses. `isSafeProductReference()` is the same rule.
          if (!isSafeProductReference(reference)) {
            return "Une référence ne contient que des lettres, des chiffres, un point, un tiret ou un tiret bas, et commence par une lettre ou un chiffre.";
          }

          const published = await readPublishedDocument<{ sku?: string }>(
            context,
            "{sku}",
          );
          if (published?.sku && published.sku !== reference) {
            return `La référence publiée est « ${published.sku} ». Une commande passée et le fichier livré y renvoient : créez un nouveau produit plutôt que de la changer.`;
          }

          const id = (context.document?._id ?? "").replace(/^drafts\./, "");
          const twin = await context
            .getClient({ apiVersion })
            .fetch<string | null>(
              `*[_type == "digitalProduct" && sku == $sku && !(_id in [$id, "drafts." + $id])][0].title`,
              { sku: reference, id },
            );
          if (twin) {
            return `« ${twin} » porte déjà la référence « ${reference} ». Une commande ne saurait plus lequel des deux elle a acheté.`;
          }

          return true;
        }),
    }),
    defineField({
      name: "family",
      title: "Famille",
      type: "string",
      group: "editorial",
      options: {
        list: DIGITAL_PRODUCT_FAMILIES.map((family) => ({
          title: DIGITAL_PRODUCT_FAMILY_LABELS[family],
          value: family,
        })),
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Adresse",
      type: "slug",
      group: "editorial",
      options: { source: "title", maxLength: 96 },
      description: "Le produit est publié sur /boutique/<adresse>.",
      validation: (rule) => rule.required(),
    }),
    {
      ...previousSlugsField(
        "Les liens déjà partagés, indexés ou envoyés dans un reçu continuent d'arriver sur le produit. Changez l'adresse ci-dessus et l'ancienne est exigée ici avant publication.",
      ),
      group: "editorial",
    },
    defineField({
      name: "format",
      title: "Format livré",
      type: "string",
      group: "editorial",
      description: "Affiché sur la couverture, ex. « PDF » ou « Fichiers .cube ».",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      title: "Description courte",
      type: "text",
      rows: 3,
      group: "editorial",
      description:
        "Une ligne : elle sert de résumé sur la carte et d'accroche en haut de la fiche produit.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description complète",
      type: "text",
      rows: 6,
      group: "editorial",
      description: "Facultative. Affichée sous l'accroche, sur la fiche produit.",
    }),
    defineField({
      name: "cover",
      title: "Couverture",
      type: "mediaFrame",
      group: "editorial",
      description:
        "Tant que la couverture définitive n'est pas fournie, le cadre affiche un repère gris au bon format. Un produit ne peut pas être mis en vente sans couverture.",
    }),

    defineField({
      name: "inclusions",
      title: "Ce qui est inclus",
      type: "array",
      group: "commercial",
      of: [defineArrayMember({ type: "string" })],
      description:
        "Ce que l'acheteur reçoit, ligne par ligne. N'écrivez que ce que WeCreate s'engage à livrer : c'est sur cette liste qu'un acheteur décide.",
    }),
    defineField({
      name: "priceXof",
      title: "Prix (FCFA)",
      type: "number",
      group: "commercial",
      description:
        "En francs entiers. La modification prend effet à la publication : tant qu'elle n'est pas publiée, le site affiche l'ancien prix.",
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: "isFeatured",
      title: "Mis en avant sur la page d'accueil",
      type: "boolean",
      group: "commercial",
      initialValue: false,
      description:
        "La section « La boutique » de l'accueil affiche les trois premiers produits mis en avant.",
    }),

    defineField({
      name: "isPurchaseEnabled",
      title: "En vente",
      type: "boolean",
      group: "availability",
      initialValue: false,
      description:
        "Publier la fiche et ouvrir la vente sont deux décisions. Sans cette case le produit reste visible et annoncé « bientôt disponible » — et même cochée, la vente n'ouvre qu'une fois la licence validée et le fichier activé côté commerce.",
    }),
    defineField({
      name: "isArchived",
      title: "Archivé",
      type: "boolean",
      group: "availability",
      initialValue: false,
      description:
        "Retire le produit de la boutique, de l'accueil et des moteurs de recherche, sans le supprimer : sa page reste en ligne pour les commandes passées et les accès déjà accordés.",
    }),
  ],
  orderings: [
    {
      name: "skuAsc",
      title: "Par référence",
      by: [{ field: "sku", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      sku: "sku",
      family: "family",
      isArchived: "isArchived",
      media: "cover.image",
    },
    prepare: ({ title, sku, family, isArchived, media }) => ({
      title: isArchived ? `${title} (archivé)` : title,
      // A family the editor has not picked yet simply does not appear in the
      // line, rather than being drawn as `undefined`.
      subtitle: [
        sku,
        DIGITAL_PRODUCT_FAMILIES.find((candidate) => candidate === family)
          ? DIGITAL_PRODUCT_FAMILY_LABELS[family as DigitalProductFamily]
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      media,
    }),
  },
});

export const boutiquePage = defineType({
  name: "boutiquePage",
  title: "Page boutique",
  type: "document",
  groups: [
    { name: "page", title: "Page", default: true },
    { name: "product", title: "Fiche produit" },
  ],
  fields: [
    defineField({
      name: "seo",
      title: "Référencement",
      type: "object",
      group: "page",
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
      name: "kicker",
      title: "Sur-titre",
      type: "string",
      group: "page",
    }),
    defineField({
      name: "headline",
      title: "Titre",
      type: "splitHeadline",
      group: "page",
    }),
    defineField({
      name: "intro",
      title: "Introduction",
      type: "text",
      rows: 3,
      group: "page",
    }),
    defineField({
      name: "allFamiliesLabel",
      title: "Libellé du filtre « tous »",
      type: "string",
      group: "page",
    }),
    defineField({
      name: "emptyStateText",
      title: "Message quand aucun produit n'est en vente",
      type: "string",
      group: "page",
    }),
    defineField({
      name: "detailLinkLabel",
      title: "Libellé du lien vers la fiche",
      type: "string",
      group: "page",
    }),

    defineField({
      name: "backLabel",
      title: "Libellé du retour à la boutique",
      type: "string",
      group: "product",
    }),
    defineField({
      name: "inclusionsKicker",
      title: "Titre de la liste « ce qui est inclus »",
      type: "string",
      group: "product",
    }),
    defineField({
      name: "licence",
      title: "Licence",
      type: "object",
      group: "product",
      description:
        "Le texte de la licence lui-même est un document légal : ces champs disent seulement où il se trouve et ce qu'il couvre.",
      fields: [
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({ name: "note", title: "Texte", type: "text", rows: 3 }),
        defineField({
          name: "linkLabel",
          title: "Libellé du lien",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "support",
      title: "Une question ?",
      type: "object",
      group: "product",
      description:
        "L'assistance sur un produit. Les adresses sont celles des paramètres du site : ici on écrit seulement ce qu'on en dit.",
      fields: [
        defineField({ name: "kicker", title: "Sur-titre", type: "string" }),
        defineField({ name: "note", title: "Texte", type: "text", rows: 3 }),
        defineField({
          name: "whatsappLabel",
          title: "Libellé WhatsApp",
          type: "string",
        }),
        defineField({
          name: "whatsappMessageTemplate",
          title: "Message WhatsApp prérempli",
          type: "text",
          rows: 2,
          description: "« %s » est remplacé par le nom du produit.",
        }),
        defineField({
          name: "emailLabel",
          title: "Libellé e-mail",
          type: "string",
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Page boutique" }),
  },
});
