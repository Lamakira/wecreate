import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { NotFoundContent } from "@/components/shell/not-found-content";
import { SitePage } from "@/components/shell/site-page";
import { readChrome, readLegalDocumentInForce } from "@/managed-content";
import { pageMetadata } from "@/seo/page-metadata";
import { keepOutOfSearchResults } from "@/site-config";

/** Same reason as the document's own route: no shared shell knows the address. */
export const instant = false;

interface LegalRevisionRouteProps {
  params: Promise<{ slug: string; revision: string }>;
}

/**
 * An archived revision is readable but never indexed.
 *
 * It is superseded text kept because past orders reference it. Left indexable
 * it would compete in search results with the terms actually in force, and a
 * visitor arriving from a search would have no way of knowing which of the two
 * they had found. `follow` stays on so the link back to the current version is
 * still worth something.
 */
export async function generateMetadata(): Promise<Metadata> {
  const content = await readChrome();

  return {
    ...pageMetadata(content.settings.seo),
    ...keepOutOfSearchResults(),
  };
}

/**
 * One named revision of one legal document.
 *
 * This is what an Order Snapshot's recorded revision resolves to: the exact
 * words a customer accepted, at a stable address, however many times WeCreate
 * has published new terms since. Publishing adds a revision and never rewrites
 * one, so this page keeps answering.
 *
 * Only revisions that are or have been in force are addressable. A revision
 * dated in the future is prepared, not published to anyone — it is absent from
 * the history for the same reason, so the two cannot disagree.
 *
 * A revision that is not there renders the not-found body inside this route's
 * own `SitePage`, with the editor's chrome; the route's metadata is already
 * `noindex`.
 */
export default async function LegalRevisionRoute({
  params,
}: LegalRevisionRouteProps) {
  const { slug, revision: revisionId } = await params;
  const content = await readChrome();
  const inForce = await readLegalDocumentInForce(slug);

  const revision = inForce?.history.find(
    (candidate) => candidate.id === revisionId,
  );
  if (!inForce || !revision) {
    return (
      <SitePage
        settings={content.settings}
        legalDocuments={content.legalDocuments}
      >
        <NotFoundContent />
      </SitePage>
    );
  }

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
      <LegalDocumentView inForce={inForce} revision={revision} />
    </SitePage>
  );
}
