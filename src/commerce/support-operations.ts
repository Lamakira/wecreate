import "server-only";

import { deliverApprovedOrder, sendReissuedAccess } from "@/fulfillment";
import { accessTokenDigest, newAccessToken } from "@/fulfillment/token";

import { readWorkingOperator, type WorkingOperator } from "./back-office";
import type { CommerceMessageKey } from "./messages";
import { administersCommerce } from "./operators";
import { readSignedInOperator } from "./session";
import { mayRetryDelivery } from "./support";

/**
 * Everything a Commerce Operator does to one order, and where each leaves them.
 *
 * These are the writes issue #15 asks for: correcting where an order goes,
 * taking up a delivery, replacing the address that opens it, granting a later
 * version, and writing down what somebody decided. Each one answers with an
 * address rather than performing a redirect, because what performs it is a
 * route handler — see `commerce/commande/operation/route.ts` for why the back
 * office posts to a route rather than calling a Server Function here.
 *
 * They are the second line of defence and never the first. Every one of them
 * asks who is working before it touches anything — a form is not a security
 * boundary, and a page that does not render a control does not stop anybody
 * posting to this — and Postgres asks the same questions again against the
 * request that arrives with these credentials.
 *
 * What is deliberately absent is the point (issue #15): there is no operation
 * here that edits a payment event, a provider identifier, a Payment State, an
 * Order Snapshot or a stored Paid Deliverable Version. Those are not refused;
 * they do not exist.
 */

/** What the browser asks for, in the field the form carries. */
export type SupportOperation =
  | "correct-contact"
  | "retry-delivery"
  | "reissue-access"
  | "upgrade-grant"
  | "annotate-order";

const OPERATIONS: readonly SupportOperation[] = [
  "correct-contact",
  "retry-delivery",
  "reissue-access",
  "upgrade-grant",
  "annotate-order",
];

function isSupportOperation(value: unknown): value is SupportOperation {
  return (
    typeof value === "string" &&
    OPERATIONS.includes(value as SupportOperation)
  );
}

/** Where the back office is served from, for a form that names nothing we know. */
const ORDERS = "/commerce/commandes";

/**
 * Where an operation about one order comes back to.
 *
 * The order is named in the query for the reason the dossier page gives: a
 * route with a dynamic segment is prerendered as a shell, and the message an
 * operator has just earned would be lost in one.
 */
function dossier(reference: string, message?: CommerceMessageKey): string {
  const at = `/commerce/commande?reference=${encodeURIComponent(reference)}`;
  return message ? `${at}&message=${message}` : at;
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

/**
 * Do what this form asked for, and answer with where to send the browser.
 *
 * Never throws for anything a person can cause. A session that has expired, a
 * form naming an operation this application does not have, an order nobody
 * here holds: each of them is an address with a French sentence waiting at the
 * end of it.
 */
export async function performSupportOperation(
  form: FormData,
): Promise<string> {
  const operation = form.get("operation");
  if (!isSupportOperation(operation)) {
    return ORDERS;
  }

  const working = await readWorkingOperator(administersCommerce);
  if (!working) {
    // A session that exists and simply may not do this goes to the back office,
    // which explains why — that it needs a code, or that this account does not
    // administer commerce. No session at all is the only case where "sign in
    // again" is the truth. The reads behind this are resolved once per request,
    // so asking a second time costs nothing.
    return (await readSignedInOperator())
      ? "/commerce"
      : "/commerce/connexion?message=sessionExpired";
  }

  const reference = field(form, "reference");
  switch (operation) {
    case "correct-contact":
      return correctContact(working, form, reference);
    case "retry-delivery":
      return retryDelivery(working, reference);
    case "reissue-access":
      return reissueAccess(working, form, reference);
    case "upgrade-grant":
      return upgradeGrant(working, form, reference);
    case "annotate-order":
      return annotateOrder(working, form, reference);
  }
}

/**
 * Record that the address or telephone the buyer wrote is not where their order
 * should go.
 *
 * The Order Snapshot is not touched and cannot be from here: what the buyer
 * typed is what they typed, and this adds the separate, attributable fact that
 * a delivery reads instead.
 */
async function correctContact(
  { provider, credentials }: WorkingOperator,
  form: FormData,
  reference: string,
): Promise<string> {
  const outcome = await provider.correctBuyerContact(credentials, {
    reference,
    email: field(form, "email"),
    telephone: field(form, "telephone"),
    reason: field(form, "reason"),
  });

  return dossier(
    reference,
    outcome.status === "recorded" ? "contactCorrected" : outcome.reason,
  );
}

/**
 * Take up a delivery that failed, through the same boundary a webhook uses.
 *
 * Nothing here delivers anything: `deliverApprovedOrder` claims the order,
 * makes the grants that are missing, emails the receipt and settles the
 * Fulfillment State, exactly as it does for an approved payment arriving from
 * FedaPay (ADR-0010). What the back office adds is a person asking for it, and
 * that is what the audit entry records — with the Fulfillment State on either
 * side, so a retry that changed nothing is as visible as one that worked.
 *
 * It cannot reach a Payment State from here, and does not try: an approved
 * order stays approved whether this succeeds or fails (ADR-0005).
 */
async function retryDelivery(
  { provider, credentials }: WorkingOperator,
  reference: string,
): Promise<string> {
  const order = await provider.readOrder(reference);
  if (!order) return dossier(reference, "unknownOrder");
  if (!mayRetryDelivery(order)) {
    return dossier(reference, "nothingToDeliver");
  }

  const outcome = await deliverApprovedOrder(reference);
  const after =
    (await provider.readOrder(reference))?.fulfillmentState ??
    order.fulfillmentState;
  await provider.noteDeliveryRetry(credentials, {
    reference,
    before: order.fulfillmentState,
    after,
  });

  return dossier(
    reference,
    outcome === "delivered" ? "deliveryRetried" : "deliveryStillFailing",
  );
}

/**
 * Replace the address that opens one order, and write to the buyer with it.
 *
 * In that order, and the order is the point: the digest is replaced first, so
 * the previous address stops working the moment WeCreate decides it should, and
 * the message that goes out afterwards is the one carrying the address that
 * works. A message sent first and a reissue that then failed would leave a
 * buyer holding a link to nothing.
 *
 * The token is generated here and stored nowhere: what crosses the commerce
 * boundary is its digest, and what crosses the email boundary is the address
 * carrying it.
 *
 * **The audit entry records the reissue and not the message**, because the
 * reissue is what durably happened and it is written in the same transaction as
 * itself. Whether the message went is a delivery outcome, and this application
 * has one place for those — a Fulfillment State, which a reissue does not move.
 * A send that fails is told to the operator in the strongest terms the back
 * office has (`accessReissuedUnsent`: the previous address no longer works,
 * send them again), and pressing again reissues and sends again. What would be
 * worse than either is an entry claiming a message went out when it did not.
 */
async function reissueAccess(
  { provider, credentials }: WorkingOperator,
  form: FormData,
  reference: string,
): Promise<string> {
  const token = newAccessToken();
  const outcome = await provider.reissueOrderAccess(credentials, {
    reference,
    tokenDigest: accessTokenDigest(token),
    reason: field(form, "reason"),
  });
  if (outcome.status === "refused") {
    return dossier(reference, outcome.reason);
  }

  const sent = await sendReissuedAccess({
    order: outcome.order,
    access: outcome.access,
    deliverTo: outcome.deliverTo,
    token,
  });

  return dossier(reference, sent ? "accessReissued" : "accessReissuedUnsent");
}

/**
 * Grant one purchased product a later Paid Deliverable Version than it bought.
 *
 * A deliberate gift rather than a silent one: the Order Snapshot goes on saying
 * which version was paid for, the grant beside it says which one may now be
 * opened, and the audit entry names both with the individual who decided it.
 */
async function upgradeGrant(
  { provider, credentials }: WorkingOperator,
  form: FormData,
  reference: string,
): Promise<string> {
  const outcome = await provider.upgradeGrantVersion(credentials, {
    reference,
    sku: field(form, "sku"),
    versionId: field(form, "versionId"),
    reason: field(form, "reason"),
  });

  return dossier(
    reference,
    outcome.status === "recorded" ? "grantUpgraded" : outcome.reason,
  );
}

/**
 * Write down what a person decided about an order, and settle the Order Anomaly
 * they decided it about.
 *
 * The whole of what WeCreate does about a duplicate or unusual payment. No
 * refund is issued here and none ever will be: money is returned in the payment
 * provider's own dashboard, by somebody who chose to, and this records that
 * they did (issue #15).
 */
async function annotateOrder(
  { provider, credentials }: WorkingOperator,
  form: FormData,
  reference: string,
): Promise<string> {
  const anomalyId = field(form, "anomalyId");
  const outcome = await provider.annotateOrder(credentials, {
    reference,
    anomalyId: anomalyId.length > 0 ? anomalyId : null,
    note: field(form, "note"),
  });

  return dossier(
    reference,
    outcome.status === "recorded" ? "orderAnnotated" : outcome.reason,
  );
}
