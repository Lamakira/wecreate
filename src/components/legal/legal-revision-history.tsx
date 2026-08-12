import Link from "next/link";

import { SectionKicker } from "@/components/primitives/section-kicker";
import { formatEffectiveDate } from "@/lib/format";
import { legalRevisionPath } from "@/managed-content/legal";
import type { LegalRevision } from "@/managed-content/types";

interface LegalRevisionHistoryProps {
  slug: string;
  /** In force now or previously, newest first. */
  history: LegalRevision[];
  /** The one in force. */
  current: LegalRevision;
}

/**
 * Every version of this document that has applied, and where to read each one.
 *
 * Publishing new terms adds a revision; it never rewrites the one a past order
 * accepted. This is where that promise becomes something a customer can check:
 * the identity recorded with their purchase is on this list, and it still opens
 * the exact words they agreed to.
 *
 * Absent when there is only one revision — the effective date and identity are
 * already stated at the top of the page, and a one-item history would only
 * repeat them.
 */
export function LegalRevisionHistory({
  slug,
  history,
  current,
}: LegalRevisionHistoryProps) {
  if (history.length < 2) {
    return null;
  }

  return (
    <section
      aria-labelledby="legal-history-heading"
      className="mt-section-xs border-t border-wc-line-dark pt-heading-gap"
    >
      <SectionKicker as="h2" id="legal-history-heading">
        Historique des révisions
      </SectionKicker>
      <ul className="flex list-none flex-col gap-3 p-0">
        {history.map((revision) => (
          <li
            key={revision.id}
            data-testid="legal-revision-entry"
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-body-sm font-light text-wc-soft"
          >
            <span>{formatEffectiveDate(revision.effectiveFrom)}</span>
            <span className="text-micro tracking-20 uppercase text-wc-muted-2">
              {revision.id}
            </span>
            {revision.id === current.id ? (
              <span className="text-micro tracking-20 uppercase text-wc-white">
                En vigueur
              </span>
            ) : (
              <Link
                href={legalRevisionPath(slug, revision.id)}
                className="border-b border-wc-muted pb-px transition-colors duration-300 hover:border-wc-white hover:text-wc-white"
              >
                Lire cette version
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
