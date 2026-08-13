import { activateVersionAction, uploadVersionAction } from "@/commerce/actions";
import {
  ALLOWED_DELIVERABLE_TYPES,
  MAX_DELIVERABLE_BYTES,
  shortChecksum,
} from "@/commerce/paid-deliverables";
import type { PaidDeliverableVersion } from "@/commerce/types";
import { formatBytes, formatMoment } from "@/lib/format";

import { CommerceButton, CommerceField, CommercePanel } from "./commerce-form";

/** One Digital Product, and every version of the file behind it. */
export interface DeliverableView {
  sku: string;
  /** The product's title in Managed Content, or its SKU when it has no page. */
  title: string;
  versions: PaidDeliverableVersion[];
  activeVersionId: string | null;
}

/**
 * Where a Commerce Operator uploads a Paid Deliverable and chooses which
 * version is sold.
 *
 * The two are deliberately separate controls. Uploading adds a version and
 * changes nothing a customer sees; activating is the decision that a purchase
 * made from now on receives this file. That is what lets WeCreate replace a
 * deliverable, check it, and only then put it on sale — and what stops a
 * mistaken upload reaching a buyer.
 *
 * Nothing on this page says where a file is kept. The versions are named by
 * their number, their file name and their checksum, which is everything an
 * operator needs to tell two of them apart and nothing anyone needs to reach
 * the bytes.
 */
export function DeliverablesPanel({
  deliverables,
}: {
  deliverables: DeliverableView[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <CommercePanel
        title="Téléverser une version"
        description={`Choisissez le produit, puis le fichier livré. Formats acceptés : ${Object.keys(
          ALLOWED_DELIVERABLE_TYPES,
        ).join(", ")}, jusqu'à ${formatBytes(MAX_DELIVERABLE_BYTES)}. La nouvelle version n'est pas mise en vente tant qu'elle n'est pas activée.`}
      >
        <form
          action={uploadVersionAction}
          encType="multipart/form-data"
          data-testid="version-upload"
          className="flex flex-col gap-4 sm:max-w-lg"
        >
          <label className="block">
            <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
              Produit
            </span>
            <select
              name="sku"
              required
              defaultValue=""
              className="mt-2 w-full border border-wc-border bg-wc-surface px-3 py-2 text-body text-wc-white"
            >
              <option value="" disabled>
                Choisir un produit
              </option>
              {deliverables.map((deliverable) => (
                <option key={deliverable.sku} value={deliverable.sku}>
                  {deliverable.title} — {deliverable.sku}
                </option>
              ))}
            </select>
          </label>
          <CommerceField
            label="Fichier"
            name="file"
            type="file"
            required
            accept={Object.keys(ALLOWED_DELIVERABLE_TYPES).join(",")}
          />
          <div>
            <CommerceButton>Téléverser</CommerceButton>
          </div>
        </form>
      </CommercePanel>

      {deliverables.map((deliverable) => (
        <Deliverable key={deliverable.sku} deliverable={deliverable} />
      ))}
    </div>
  );
}

function Deliverable({ deliverable }: { deliverable: DeliverableView }) {
  const active = deliverable.versions.find(
    (version) => version.id === deliverable.activeVersionId,
  );

  return (
    <article
      data-testid="deliverable"
      data-sku={deliverable.sku}
      className="border border-wc-line-dark bg-wc-surface-2 p-5"
    >
      <h3 className="m-0 text-product-title font-light">{deliverable.title}</h3>
      <p className="mt-1 mb-0 text-micro uppercase tracking-24 text-wc-muted-2">
        {deliverable.sku}
      </p>
      <p
        data-testid="active-version"
        data-active-version={active ? String(active.version) : ""}
        className="mt-4 mb-0 text-body font-light"
      >
        {active
          ? `Version ${active.version} en vente`
          : "Aucune version en vente"}
      </p>

      {deliverable.versions.length === 0 ? (
        <p className="mt-4 mb-0 text-body-sm font-light text-wc-muted-2">
          Aucun fichier livré pour ce produit. Tant qu&apos;il n&apos;y en a pas, il reste
          « bientôt disponible » dans la boutique.
        </p>
      ) : (
        <ul className="mt-4 mb-0 flex list-none flex-col gap-3 p-0">
          {deliverable.versions.map((version) => (
            <li
              key={version.id}
              data-testid="version"
              data-version={String(version.version)}
              data-active={String(version.id === deliverable.activeVersionId)}
              className="flex flex-col gap-3 border border-wc-line-dark p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              {/* The record, separate from the control beside it: what this
                  version *is* never changes, and only what is on sale does. */}
              <div
                data-testid="version-record"
                className="text-body-sm font-light text-wc-soft"
              >
                <p className="m-0 text-body text-wc-white">
                  Version {version.version} · {version.fileName}
                </p>
                <p className="m-0">
                  {formatBytes(version.byteSize)} · empreinte{" "}
                  <span data-testid="version-checksum">
                    {shortChecksum(version.checksum)}
                  </span>
                </p>
                <p className="m-0 text-wc-muted-2">
                  Déposée le {formatMoment(version.createdAt)} par{" "}
                  {version.createdByEmail}
                </p>
              </div>
              {version.id === deliverable.activeVersionId ? (
                <p className="m-0 text-micro uppercase tracking-24 text-wc-white">
                  En vente
                </p>
              ) : (
                <form action={activateVersionAction}>
                  <input type="hidden" name="sku" value={version.sku} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <CommerceButton secondary>
                    Activer la version {version.version}
                  </CommerceButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
