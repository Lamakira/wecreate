import { ORDER_ANOMALY_LABELS } from "@/commerce/support";
import { FULFILLMENT_STATE_LABELS } from "@/commerce/orders";
import { shortChecksum } from "@/commerce/paid-deliverables";
import type {
  AuditMetadata,
  CommerceAuditAction,
  CommerceAuditEntry,
} from "@/commerce/types";
import { formatMoment } from "@/lib/format";

import { CommercePanel } from "./commerce-form";

const ACTION_LABELS: Record<CommerceAuditAction, string> = {
  "paid-deliverable-version.created": "Version déposée",
  "paid-deliverable-version.activated": "Version activée",
  "order-contact.corrected": "Coordonnées corrigées",
  "order-access.reissued": "Accès renvoyés",
  "order-access.upgraded": "Version accordée",
  "order-delivery.retried": "Livraison reprise",
  "order.annotated": "Note de réconciliation",
};

/**
 * The safe half of what changed, read out in French.
 *
 * Every field of `AuditMetadata` that is present, in one order for every entry,
 * so two entries about the same thing read the same way. What is absent is
 * simply not said: an entry about an address has no version to name, and one
 * about a version has no address.
 */
function describe(metadata: AuditMetadata): string {
  const parts: string[] = [];

  if (metadata.version !== undefined) {
    const named = [metadata.fileName, metadata.checksum ? `empreinte ${shortChecksum(metadata.checksum)}` : undefined]
      .filter(Boolean)
      .join(", ");
    parts.push(named ? `version ${metadata.version} (${named})` : `version ${metadata.version}`);
  }
  if (metadata.emailHint) parts.push(`e-mail ${metadata.emailHint}`);
  if (metadata.telephoneHint) parts.push(`téléphone ${metadata.telephoneHint}`);
  if (metadata.fulfillment) {
    parts.push(FULFILLMENT_STATE_LABELS[metadata.fulfillment]);
  }
  if (metadata.issuedAt) parts.push(`accès émis le ${formatMoment(metadata.issuedAt)}`);
  if (metadata.anomaly) parts.push(ORDER_ANOMALY_LABELS[metadata.anomaly]);
  if (metadata.note) parts.push(`« ${metadata.note} »`);

  return parts.length > 0 ? parts.join(", ") : "aucune";
}

/**
 * What WeCreate's staff did, in the order it happened.
 *
 * Append-only, and shown here because an audit trail nobody reads is not one.
 * Every entry names an individual — there are no shared accounts to hide behind
 * — the moment, what it was about, and what changed on either side of the
 * change. What it never carries is a secret, a token, an address or a contact
 * detail in full: the safe half of what happened is enough to answer "who did
 * this, and when".
 *
 * The same component on both surfaces that show it, because it is the same
 * trail: `/commerce` shows everything WeCreate's staff have done, and an Order
 * Dossier shows the part of it that is about one buyer's order.
 */
export function AuditTrail({
  entries,
  title = "Journal des opérations",
  description = "Chaque dépôt, chaque mise en vente et chaque geste de support, avec la personne qui l'a fait. Le journal ne peut être ni modifié ni effacé.",
  empty = "Aucune opération enregistrée.",
}: {
  entries: CommerceAuditEntry[];
  title?: string;
  description?: string;
  empty?: string;
}) {
  return (
    <CommercePanel title={title} description={description}>
      {entries.length === 0 ? (
        <p className="m-0 text-body-sm font-light text-wc-muted-2">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid="audit-entry"
              data-action={entry.action}
              data-sku={entry.sku ?? ""}
              data-order={entry.orderReference ?? ""}
              className="border border-wc-line-dark p-4 text-body-sm font-light text-wc-soft"
            >
              <p className="m-0 text-body text-wc-white">
                {ACTION_LABELS[entry.action]} -{" "}
                {entry.sku ?? entry.orderReference}
              </p>
              <p className="m-0">
                {formatMoment(entry.occurredAt)} · {entry.actorEmail}
              </p>
              <p className="m-0 text-wc-muted-2">
                {entry.before ? `Avant : ${describe(entry.before)}. ` : ""}
                {entry.after ? `Après : ${describe(entry.after)}.` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </CommercePanel>
  );
}
