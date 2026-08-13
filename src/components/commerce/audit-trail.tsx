import { shortChecksum } from "@/commerce/paid-deliverables";
import type { AuditMetadata, CommerceAuditEntry } from "@/commerce/types";
import { formatMoment } from "@/lib/format";

import { CommercePanel } from "./commerce-form";

const ACTION_LABELS: Record<CommerceAuditEntry["action"], string> = {
  "paid-deliverable-version.created": "Version déposée",
  "paid-deliverable-version.activated": "Version activée",
};

function describe(metadata: AuditMetadata | null): string {
  return metadata
    ? `version ${metadata.version} (${metadata.fileName}, empreinte ${shortChecksum(metadata.checksum)})`
    : "aucune";
}

/**
 * What WeCreate's staff did to the files it sells, in the order it happened.
 *
 * Append-only, and shown here because an audit trail nobody reads is not one.
 * Every entry names an individual — there are no shared accounts to hide behind
 * — the moment, the product, and what changed on either side of the change.
 * What it never carries is a secret, a token or an address: the safe half of
 * what happened is enough to answer "who put this file on sale, and when".
 */
export function AuditTrail({ entries }: { entries: CommerceAuditEntry[] }) {
  return (
    <CommercePanel
      title="Journal des opérations"
      description="Chaque dépôt et chaque mise en vente, avec la personne qui l'a faite. Le journal ne peut être ni modifié ni effacé."
    >
      {entries.length === 0 ? (
        <p className="m-0 text-body-sm font-light text-wc-muted-2">
          Aucune opération enregistrée.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid="audit-entry"
              data-action={entry.action}
              data-sku={entry.sku}
              className="border border-wc-line-dark p-4 text-body-sm font-light text-wc-soft"
            >
              <p className="m-0 text-body text-wc-white">
                {ACTION_LABELS[entry.action]} — {entry.sku}
              </p>
              <p className="m-0">
                {formatMoment(entry.occurredAt)} · {entry.actorEmail}
              </p>
              <p className="m-0 text-wc-muted-2">
                Avant : {describe(entry.before)}. Après : {describe(entry.after)}.
              </p>
            </li>
          ))}
        </ul>
      )}
    </CommercePanel>
  );
}
