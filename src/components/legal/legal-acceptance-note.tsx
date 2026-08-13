import { CHECKOUT_ACCEPTANCE_KINDS } from "@/managed-content/legal";
import type { LegalDocumentKind } from "@/managed-content/types";

interface LegalAcceptanceNoteProps {
  kind: LegalDocumentKind;
}

/**
 * What reading this document commits a visitor to — which, for three of the
 * five, is nothing at all.
 *
 * Issue #1 asks for two things to stay visibly apart. Transactional terms are
 * accepted explicitly before a payment and their revision is recorded in the
 * Order Snapshot; marketing consent is neither asked for nor inferred from a
 * purchase. Saying both on every legal page means a visitor reading the privacy
 * policy is told, on that page, that buying subscribes them to nothing — rather
 * than having to work it out from the absence of a checkbox.
 */
export function LegalAcceptanceNote({ kind }: LegalAcceptanceNoteProps) {
  const isTransactional = CHECKOUT_ACCEPTANCE_KINDS.includes(kind);

  return (
    <div
      data-testid="legal-acceptance-note"
      className="flex flex-col gap-3 border-l border-wc-border pl-5 text-body-sm font-light text-wc-soft"
    >
      <p className="m-0">
        {isTransactional ? (
          <>
            <strong className="font-semibold text-wc-white">
              Conditions transactionnelles.
            </strong>{" "}
            Leur acceptation explicite est demandée avant tout paiement d&apos;un
            produit numérique, et la révision acceptée est enregistrée avec la
            commande.
          </>
        ) : (
          <>
            <strong className="font-semibold text-wc-white">
              Document d&apos;information.
            </strong>{" "}
            Aucune acceptation n&apos;est demandée ici.
          </>
        )}
      </p>
      <p className="m-0">
        Rien sur ce site ne vaut consentement marketing : acheter n&apos;inscrit
        à aucune communication commerciale, et aucun consentement de ce type
        n&apos;est collecté.
      </p>
    </div>
  );
}
