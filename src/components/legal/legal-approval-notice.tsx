import { LegalNotice } from "@/components/legal/legal-notice";
import { LEGAL_DOCUMENT_LABELS } from "@/managed-content/legal";
import type { LegalCheckoutTerms } from "@/managed-content/legal";

interface LegalApprovalNoticeProps {
  checkout: LegalCheckoutTerms;
}

/**
 * What still stands between WeCreate and being allowed to sell.
 *
 * The editor's half of the rule the application enforces on its own, the way
 * the portfolio's publication notice is: a placeholder legal text keeps
 * production purchasing off, and this is where an editor is told which
 * documents are holding it — in the page they are already looking at, rather
 * than in a checklist somewhere else.
 *
 * Only ever rendered in preview. It is operational information for WeCreate,
 * not something a visitor reading the terms needs; what *they* are told is that
 * the text in front of them is provisional, which the placeholder notice says.
 */
export function LegalApprovalNotice({ checkout }: LegalApprovalNoticeProps) {
  if (checkout.status === "ready") {
    return null;
  }

  return (
    <LegalNotice
      testId="legal-approval-notice"
      label="La vente de produits numériques reste désactivée :"
    >
      WeCreate n&apos;a pas encore validé le texte pour{" "}
      {checkout.awaitingApproval
        .map((kind) => LEGAL_DOCUMENT_LABELS[kind])
        .join(", ")}
      .
    </LegalNotice>
  );
}
