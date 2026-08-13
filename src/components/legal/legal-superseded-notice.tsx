import Link from "next/link";

import { LegalNotice } from "@/components/legal/legal-notice";
import { formatEffectiveDate } from "@/lib/format";
import { legalPath } from "@/managed-content/legal";

interface LegalSupersededNoticeProps {
  /** The document this revision belongs to. */
  slug: string;
  /** The day the revision that replaced it took effect. */
  replacedOn: string;
}

/**
 * What a visitor is told when they are reading terms that no longer apply.
 *
 * Superseded revisions stay readable because past orders reference them, which
 * means somebody can arrive at one from a receipt, a bookmark or the history
 * list. Saying so before the prose — and pointing at the text in force — is the
 * difference between an archive and a page that misleads.
 */
export function LegalSupersededNotice({
  slug,
  replacedOn,
}: LegalSupersededNoticeProps) {
  return (
    <LegalNotice testId="legal-superseded-notice" label="Version archivée.">
      Elle a été remplacée le {formatEffectiveDate(replacedOn)} et reste
      consultable parce que des commandes y renvoient.{" "}
      <Link
        href={legalPath(slug)}
        className="border-b border-wc-muted pb-px transition-colors duration-300 hover:border-wc-white hover:text-wc-white"
      >
        Lire la version en vigueur
      </Link>
      .
    </LegalNotice>
  );
}
