import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import {
  readEffectiveLegalTerms,
  readLegalDocumentInForce,
  readLegalSlugRedirect,
} from "@/managed-content";
import { legalPath } from "@/managed-content/legal";
import { keepOutOfSearchResults } from "@/site-config";

/**
 * Not held to the instant-navigation bar, for the same reason
 * `/portfolio/[slug]` is not: the header marks the current navigation entry
 * from `usePathname()`, and no shell shared by every legal document can know
 * which address it is being rendered for.
 */
export const instant = false;

/** The route's own params, typed here rather than taken from Next's generated
 *  route types, which do not exist until the first build. */
interface LegalRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: LegalRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const inForce = await readLegalDocumentInForce(slug);
  if (!inForce) {
    return {};
  }

  const { document, current } = inForce;
  const { isEnabled: isPreview } = await draftMode();

  return {
    title: document.title,
    description: document.summary,
    alternates: { canonical: legalPath(document.slug) },
    openGraph: {
      title: document.title,
      description: document.summary,
    },
    // Two ways a legal page must stay out of search results, and neither is
    // about the route: a preview is one editor's unpublished draft, and a
    // placeholder is not WeCreate's approved text. Presenting either as its
    // terms would be worse than not being indexed at all. Spread rather than
    // set, so approved text on a crawlable deployment leaves the key absent
    // and inherits the site-wide rule instead of overwriting it.
    ...(isPreview || current.status !== "approved"
      ? keepOutOfSearchResults()
      : {}),
  };
}

/**
 * One legal document, at the address it currently lives at.
 *
 * Three answers are possible, in this order. The address belongs to a document
 * with a revision in force, and it is served. The address is one the document
 * used to have, and the request is redirected to where it moved — a link
 * somebody saved or a crawler indexed has to keep arriving (issue #1). Or
 * neither, and it resolves to the site's not-found page.
 *
 * A document whose every revision is dated in the future has no page here. It
 * is published content an editor prepared ahead of time, but nobody is bound by
 * it yet, and an address that resolved to terms not in force would be worse
 * than one that resolves to nothing.
 *
 * The redirect below is the fallback rather than the mechanism: `src/proxy.ts`
 * has already answered 308 for a former address, because by the time this runs
 * the response has begun streaming and the status is committed.
 */
export default async function LegalRoute({ params }: LegalRouteProps) {
  const { slug } = await params;
  const inForce = await readLegalDocumentInForce(slug);

  if (!inForce) {
    const movedTo = await readLegalSlugRedirect(slug);
    if (movedTo) {
      permanentRedirect(legalPath(movedTo));
    }
    notFound();
  }

  // In preview only: whether WeCreate may sell yet, and what is holding it. It
  // is the editor's view of a rule the application applies anyway.
  const { isEnabled: isPreview } = await draftMode();
  const checkout = isPreview
    ? (await readEffectiveLegalTerms()).checkout
    : undefined;

  return <LegalDocumentView inForce={inForce} checkout={checkout} />;
}
