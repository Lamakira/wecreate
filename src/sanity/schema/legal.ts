import { defineField, defineType } from "sanity";

import { previousSlugsField, readPublishedDocument } from "./addresses";

/**
 * WeCreate's legal documents: CGV, livraison et remboursement, licence,
 * confidentialité, mentions légales.
 *
 * Five documents, no more and no fewer. `structure.ts` pins one document id per
 * kind — `legal.cgv` and its four siblings — and `documentActions` withholds
 * create and delete, because a checkout resolves the terms it must record *by*
 * that identity. A sixth document invented in the Studio could never be
 * required, accepted or recorded, so there is no way to make one.
 *
 * What an editor owns is each document's words, its address and its history.
 * What they do not own is the set, or the past: a revision is append-only.
 */

/** A revision as Sanity stores it, before the application's own shape. */
interface StoredRevision {
  id?: { current?: string };
  effectiveFrom?: string;
  status?: string;
  sections?: unknown;
}

/**
 * A revision reduced to its identity and everything that identity promises.
 *
 * `text` is compared verbatim between the draft and what is published, so any
 * change to the date, the status or a single word of a section counts as
 * rewriting terms somebody has already accepted. `_key`s are part of it and
 * that is fine: Sanity keeps them stable, and reordering sections changes the
 * document a customer agreed to just as surely as rewording one.
 */
function toComparableRevision(revision: StoredRevision): {
  id: string;
  text: string;
} {
  return {
    id: revision.id?.current ?? "",
    text: JSON.stringify([
      revision.effectiveFrom ?? null,
      revision.status ?? null,
      revision.sections ?? null,
    ]),
  };
}

/**
 * One revision of a legal text.
 *
 * Its `id` is what an Order Snapshot stores. Publishing new terms means adding
 * a revision, never editing the one already published — an edit would silently
 * change what a past customer accepted, which is the one thing this document
 * type exists to prevent.
 */
export const legalRevision = defineType({
  name: "legalRevision",
  title: "Révision",
  type: "object",
  description:
    "De nouvelles conditions s'ajoutent : on n'écrase pas une révision déjà publiée, une commande passée y renvoie.",
  fields: [
    defineField({
      name: "id",
      title: "Identifiant de la révision",
      type: "slug",
      description:
        "Écrit une fois, jamais modifié : c'est ce qu'une commande enregistre. Par exemple « cgv-2026-09-01 ».",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "effectiveFrom",
      title: "En vigueur à partir du",
      type: "date",
      options: { dateFormat: "YYYY-MM-DD" },
      description:
        "La révision la plus récente dont la date est arrivée est celle qui s'applique. Une date future prépare un changement sans l'appliquer.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "status",
      title: "Statut du texte",
      type: "string",
      initialValue: "placeholder",
      options: {
        list: [
          { title: "Provisoire - texte de développement", value: "placeholder" },
          { title: "Validé par WeCreate", value: "approved" },
        ],
        layout: "radio",
      },
      description:
        "Un texte provisoire est lisible sur le site mais reste hors des moteurs de recherche, et bloque la mise en vente tant qu'il n'est pas validé.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "array",
      of: [{ type: "legalSection" }],
      validation: (rule) => rule.min(1),
    }),
  ],
  preview: {
    select: { effectiveFrom: "effectiveFrom", id: "id.current", status: "status" },
    prepare: ({ effectiveFrom, id, status }) => ({
      title: `${effectiveFrom ?? "sans date"} - ${id ?? "sans identifiant"}`,
      subtitle: status === "approved" ? "Validé" : "Provisoire",
    }),
  },
});

/** One titled part of a legal text. Prose, in the order it is read. */
export const legalSection = defineType({
  name: "legalSection",
  title: "Section",
  type: "object",
  fields: [
    defineField({
      name: "key",
      title: "Identifiant",
      type: "slug",
      options: { source: "heading" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "heading",
      title: "Titre",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "paragraphs",
      title: "Paragraphes",
      type: "array",
      of: [{ type: "text", rows: 4 }],
      validation: (rule) => rule.min(1),
    }),
  ],
  preview: { select: { title: "heading" } },
});

export const legalDocument = defineType({
  name: "legalDocument",
  title: "Document légal",
  type: "document",
  groups: [
    { name: "identity", title: "Document", default: true },
    { name: "revisions", title: "Révisions" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      group: "identity",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "summary",
      title: "Résumé",
      type: "text",
      rows: 2,
      group: "identity",
      description: "Une ligne sous le titre, disant ce que le document couvre.",
    }),
    defineField({
      name: "slug",
      title: "Adresse",
      type: "slug",
      group: "identity",
      options: { source: "title" },
      description: "Le document est publié sur /legal/…",
      validation: (rule) => rule.required(),
    }),
    {
      ...previousSlugsField(
        "Les liens déjà partagés et déjà indexés continuent d'arriver sur le document. Changez l'adresse ci-dessus et l'ancienne est exigée ici avant publication.",
      ),
      group: "identity",
    },

    defineField({
      name: "revisions",
      title: "Révisions",
      type: "array",
      of: [{ type: "legalRevision" }],
      group: "revisions",
      description:
        "De la plus ancienne à la plus récente. Ajoutez une révision pour changer les conditions ; une révision déjà publiée ne se modifie ni ne se supprime.",
      validation: (rule) =>
        rule.custom(async (revisions, context) => {
          const drafted = ((revisions ?? []) as StoredRevision[]).map(
            toComparableRevision,
          );

          const duplicate = drafted.find(
            (revision, index) =>
              revision.id !== "" &&
              drafted.findIndex((other) => other.id === revision.id) !== index,
          );
          if (duplicate) {
            return `Deux révisions portent l'identifiant « ${duplicate.id} ». Une commande ne saurait plus laquelle elle a acceptée.`;
          }

          // What is already published is what past orders reference, and the
          // Studio is the only place it could change — the application sees one
          // snapshot and cannot tell an edit from the truth. So both halves of
          // "does not rewrite or delete" are refused here: a revision that has
          // gone, and one whose date or words no longer match what was
          // published under that identity.
          const published = await readPublishedDocument<{
            revisions?: StoredRevision[];
          }>(context, "{revisions}");
          if (!published) {
            return true;
          }

          const inForce = (published.revisions ?? []).map(toComparableRevision);

          const removed = inForce
            .filter(
              (revision) =>
                revision.id !== "" &&
                !drafted.some((candidate) => candidate.id === revision.id),
            )
            .map((revision) => revision.id);
          if (removed.length > 0) {
            return `Révision déjà publiée retirée : ${removed.join(", ")}. Une commande passée y renvoie - publiez-en une nouvelle plutôt que d'effacer celle-ci.`;
          }

          const rewritten = inForce.find((revision) => {
            const candidate = drafted.find((other) => other.id === revision.id);
            return candidate && candidate.text !== revision.text;
          });
          if (rewritten) {
            return `La révision « ${rewritten.id} » est déjà publiée : son texte et sa date ne peuvent plus changer. Ajoutez une nouvelle révision - celle-ci est ce qu'une commande passée a accepté.`;
          }

          return true;
        }),
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "slug.current" },
    prepare: ({ title, subtitle }) => ({
      title: title ?? "Document légal",
      subtitle: subtitle ? `/legal/${subtitle}` : undefined,
    }),
  },
});
