import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { readLegalDocumentInForce } from "@/managed-content";
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
export function generateMetadata(): Metadata {
  return keepOutOfSearchResults();
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
 */
export default async function LegalRevisionRoute({
  params,
}: LegalRevisionRouteProps) {
  const { slug, revision: revisionId } = await params;
  const inForce = await readLegalDocumentInForce(slug);

  const revision = inForce?.history.find(
    (candidate) => candidate.id === revisionId,
  );
  if (!inForce || !revision) {
    notFound();
  }

  return <LegalDocumentView inForce={inForce} revision={revision} />;
}
