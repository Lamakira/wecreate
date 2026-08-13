import { LegalNotice } from "@/components/legal/legal-notice";

/**
 * What a visitor is told when the text below is not yet WeCreate's.
 *
 * Approved legal copy is written by WeCreate with its own counsel and is an
 * external launch input (issue #1); everything this repository ships is a
 * stand-in describing what the real document will cover. The notice is not a
 * disclaimer bolted on afterwards — it says the same thing the application
 * enforces elsewhere, that provisional text stays out of search results and
 * cannot open a sale.
 *
 * It is deliberately not Managed Content. An editor can rewrite the document;
 * they cannot rewrite the fact that WeCreate has not approved it, which is
 * decided by the revision's status instead.
 */
export function LegalPlaceholderNotice() {
  return (
    <LegalNotice testId="legal-placeholder-notice" label="Texte provisoire.">
      Ce document n&apos;est pas encore le texte validé par WeCreate : il décrit
      ce que la version définitive couvrira. Aucun produit numérique ne peut être
      vendu sur ce site tant que les documents légaux ne sont pas validés.
    </LegalNotice>
  );
}
