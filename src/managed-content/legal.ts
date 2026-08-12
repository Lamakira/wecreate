import { LEGAL_DOCUMENT_KINDS } from "./types";
import type {
  LegalDocument,
  LegalDocumentKind,
  LegalRevision,
  LegalRevisionStatus,
} from "./types";

/**
 * French wording for each document, shown to editors in preview.
 *
 * The editor's words rather than the model's, for the same reason the portfolio
 * has `PUBLICATION_REQUIREMENT_LABELS`: an editor is told which document is
 * still waiting for WeCreate's text, not which enum member is unmatched.
 */
export const LEGAL_DOCUMENT_LABELS: Record<LegalDocumentKind, string> = {
  cgv: "les conditions générales de vente",
  "livraison-remboursement": "la livraison et le remboursement",
  licence: "la licence des produits numériques",
  confidentialite: "la politique de confidentialité",
  "mentions-legales": "les mentions légales",
};

/**
 * The documents a buyer accepts explicitly before paying.
 *
 * Issue #1: "Require explicit acceptance of the effective CGV and
 * digital-delivery/refund terms." Nothing else is on this list, and that is the
 * point — privacy information is given, never consented to alongside a payment,
 * and marketing consent is not inferred from a purchase.
 */
export const CHECKOUT_ACCEPTANCE_KINDS: readonly LegalDocumentKind[] = [
  "cgv",
  "livraison-remboursement",
];

/**
 * WeCreate's own day, which is the day an effective date is stated in.
 *
 * A legal text takes effect on a date, not at an instant, and the date that
 * matters is the one where the business is. Deriving it from the server's
 * timezone would move the changeover by an hour and, either side of midnight,
 * by a day.
 */
const LEGAL_TIME_ZONE = "Africa/Porto-Novo";

/**
 * Today, as `YYYY-MM-DD`.
 *
 * Read through `readLegalDay()` rather than called directly: Cache Components
 * refuses a moving clock in a prerender, so the day is cached under the content
 * tag and re-derived whenever the content it decides against is.
 */
export function legalToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEGAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  // Assembled from the parts rather than from the formatted string: the
  // timezone is what `Intl` is here for, and the order it writes the pieces in
  // is a locale-data detail this must not depend on.
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Where a visitor reads the document currently in force. */
export function legalPath(slug: string): string {
  return `/legal/${slug}`;
}

/** Where a visitor reads one named revision, current or superseded. */
export function legalRevisionPath(slug: string, revisionId: string): string {
  return `/legal/${slug}/${revisionId}`;
}

/**
 * Every revision that is in force or has been, newest first.
 *
 * A revision dated ahead of `on` is not in this list. It is published content —
 * an editor may prepare terms weeks before they apply — but it is not yet what
 * anybody is bound by, and printing it beside the text in force would leave a
 * visitor unable to tell which of the two they are reading.
 *
 * Two revisions can share a date: an editor who corrects the terms they
 * published this morning gives the correction the same effective date, because
 * that is when it applies. The later one in the list wins, since revisions are
 * appended — so the tie is broken by position rather than left to the sort.
 */
export function revisionHistory(
  document: LegalDocument,
  on: string,
): LegalRevision[] {
  return document.revisions
    .map((revision, position) => ({ revision, position }))
    .filter(({ revision }) => revision.effectiveFrom <= on)
    .sort((a, b) =>
      a.revision.effectiveFrom === b.revision.effectiveFrom
        ? b.position - a.position
        : a.revision.effectiveFrom < b.revision.effectiveFrom
          ? 1
          : -1,
    )
    .map(({ revision }) => revision);
}

/**
 * The revision in force on a given day: the most recent one whose effective
 * date has arrived.
 *
 * `undefined` when none has. A document whose text is entirely in the future
 * has no page, no footer link and no sitemap entry — the same answer as a
 * document that does not exist, rather than an address that resolves to nothing
 * a visitor can rely on.
 */
export function effectiveRevision(
  document: LegalDocument,
  on: string,
): LegalRevision | undefined {
  return revisionHistory(document, on)[0];
}

/** One named revision of one document, whether or not it is still in force. */
export function findRevision(
  document: LegalDocument,
  revisionId: string,
): LegalRevision | undefined {
  return document.revisions.find((revision) => revision.id === revisionId);
}

/** The document that currently lives at this address. */
export function findLegalDocument(
  documents: LegalDocument[],
  slug: string,
): LegalDocument | undefined {
  return documents.find((document) => document.slug === slug);
}

/**
 * Every address that has been abandoned, and where it now points.
 *
 * Publishing a changed slug does not abandon the old one: a link somebody saved
 * or a crawler indexed has to keep arriving at the same document (issue #1).
 *
 * Two entries never make it in. An address that is some document's *own* slug
 * stays that document's, so reusing an old address can never shadow a live
 * page; and the first claim on an address wins, so two documents listing the
 * same former slug cannot make the destination depend on document order.
 */
export function legalSlugRedirects(
  documents: LegalDocument[],
): Record<string, string> {
  const live = new Set(documents.map((document) => document.slug));
  const redirects: Record<string, string> = {};

  for (const document of documents) {
    for (const previous of document.previousSlugs) {
      if (live.has(previous) || previous in redirects) {
        continue;
      }
      redirects[previous] = document.slug;
    }
  }

  return redirects;
}

/** The address a prior published address now points at, if any. */
export function findLegalSlugRedirect(
  documents: LegalDocument[],
  slug: string,
): string | undefined {
  return legalSlugRedirects(documents)[slug];
}

/** One document in force, as everything outside Managed Content refers to it. */
export interface EffectiveLegalRevision {
  kind: LegalDocumentKind;
  title: string;
  /** The document's own address, which serves this revision while it applies. */
  path: string;
  revisionId: string;
  effectiveFrom: string;
  status: LegalRevisionStatus;
}

/**
 * Whether WeCreate may sell at all, and what a buyer must accept if so.
 *
 * A union rather than a list that happens to be empty, because the two states
 * must not look alike to a caller: "nothing left to accept" and "not allowed to
 * take money" are opposite answers, and a checkout that read a bare array would
 * treat the second as the first and charge somebody under terms nobody
 * approved. Narrowing on `status` is the only way to reach the revisions.
 */
export type LegalCheckoutTerms =
  | {
      status: "blocked";
      /**
       * The documents WeCreate has not approved text in force for.
       *
       * This is the legal half of the Commerce Launch Gate, and it is why
       * placeholder text can carry development and staging without ever being
       * able to carry a sale. Issue #1 names CGV, privacy, refund and licence;
       * *mentions légales* counts too, because the same issue requires it as a
       * public route and a gate that passed without it would sign off a French
       * commercial site that may not lawfully publish. Issue #18 assembles the
       * rest of the Gate around this.
       */
      awaitingApproval: LegalDocumentKind[];
    }
  | {
      status: "ready";
      /**
       * What a buyer accepts explicitly before paying, in presentation order.
       *
       * Issue #1: "Require explicit acceptance of the effective CGV and
       * digital-delivery/refund terms." Nothing else is on this list, and that
       * is the point — privacy information is given, never consented to
       * alongside a payment, and marketing consent is not inferred from a
       * purchase.
       */
      mustAccept: EffectiveLegalRevision[];
    };

/**
 * What is legally in force right now, resolved once and read by everything that
 * needs it.
 *
 * This is the boundary issue #1 asks for: a checkout takes the revisions to
 * present and record from here, rather than reading a rendered page. It is
 * derived from Managed Content and holds no state of its own.
 */
export interface EffectiveLegalTerms {
  /** Every document in force, in presentation order. Placeholders included:
   *  the footer and the pages still have to lead somewhere before launch. */
  inForce: EffectiveLegalRevision[];
  /** Whether a sale may happen, and under which revisions. */
  checkout: LegalCheckoutTerms;
}

/**
 * Resolve every legal document to the revision in force on a given day.
 *
 * Ordered by `LEGAL_DOCUMENT_KINDS` rather than by whatever order the content
 * provider returned, so the footer, the sitemap and a checkout's acceptance
 * list all read the same way.
 */
export function effectiveLegalTerms(
  documents: LegalDocument[],
  on: string,
): EffectiveLegalTerms {
  const inForce: EffectiveLegalRevision[] = [];

  for (const kind of LEGAL_DOCUMENT_KINDS) {
    const document = documents.find((candidate) => candidate.kind === kind);
    const revision = document && effectiveRevision(document, on);
    if (!document || !revision) {
      continue;
    }
    inForce.push({
      kind,
      title: document.title,
      path: legalPath(document.slug),
      revisionId: revision.id,
      effectiveFrom: revision.effectiveFrom,
      status: revision.status,
    });
  }

  const approved = inForce.filter((revision) => revision.status === "approved");
  const awaitingApproval = LEGAL_DOCUMENT_KINDS.filter(
    (kind) => !approved.some((revision) => revision.kind === kind),
  );

  return {
    inForce,
    checkout:
      awaitingApproval.length > 0
        ? { status: "blocked", awaitingApproval }
        : {
            status: "ready",
            mustAccept: approved.filter((revision) =>
              CHECKOUT_ACCEPTANCE_KINDS.includes(revision.kind),
            ),
          },
  };
}
