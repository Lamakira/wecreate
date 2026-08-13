import { defineArrayMember, defineField, type CustomValidator } from "sanity";

import { apiVersion } from "../env";

/**
 * Changing where something is published, without breaking what points at it.
 *
 * Two document types carry an editable address — a Legal Document and a Digital
 * Product — and both have to obey the same rule from issue #1: "publishing a
 * changed slug creates a permanent redirect from the prior canonical URL."
 *
 * The Studio is where that is enforced, because it is the only place it can be:
 * the application sees one snapshot of the content and cannot tell an address
 * that has just changed from one that has always been what it is.
 */

/** What Sanity hands a custom validation rule, named rather than re-declared. */
export type ValidationContext = Parameters<CustomValidator>[1];

/**
 * The published version of the document being edited, or `undefined` while it
 * has never been published.
 *
 * Every rule that guards the past compares the draft against what is already
 * live, because that is what past orders and existing links depend on. The
 * projection is the caller's, so each rule reads only the fields it judges.
 */
export async function readPublishedDocument<T>(
  context: ValidationContext,
  projection: string,
): Promise<T | undefined> {
  const publishedId = (context.document?._id ?? "").replace(/^drafts\./, "");
  if (!publishedId) {
    return undefined;
  }

  const published = await context
    .getClient({ apiVersion })
    .fetch<T | null>(`*[_id == $id][0]${projection}`, { id: publishedId });

  return published ?? undefined;
}

/**
 * The record of every address this document has left behind.
 *
 * The editor is not asked to remember: the publish is refused until the address
 * being abandoned is recorded here, so the redirect is part of changing the
 * address rather than a chore beside it. `src/proxy.ts` turns the record into a
 * real 308.
 *
 * `description` is the caller's, because what points at an abandoned address
 * differs — a search result and a shared link for one, a receipt for the other.
 */
export function previousSlugsField(description: string) {
  return defineField({
    name: "previousSlugs",
    title: "Adresses précédentes",
    type: "array",
    of: [defineArrayMember({ type: "string" })],
    description,
    validation: (rule) =>
      rule.custom(async (previous, context) => {
        const abandoned = (previous as string[] | undefined) ?? [];
        const current = (
          context.document?.slug as { current?: string } | undefined
        )?.current;

        if (current && abandoned.includes(current)) {
          return "L'adresse actuelle ne peut pas figurer parmi les adresses précédentes.";
        }

        const published = await readPublishedDocument<{
          slug?: { current?: string };
        }>(context, "{slug}");

        const wasAt = published?.slug?.current;
        if (wasAt && wasAt !== current && !abandoned.includes(wasAt)) {
          return `L'adresse publiée est « ${wasAt} ». Ajoutez-la ici avant de publier la nouvelle, sinon les liens existants ne mènent plus nulle part.`;
        }

        return true;
      }),
  });
}
