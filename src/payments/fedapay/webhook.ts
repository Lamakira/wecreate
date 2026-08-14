import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  PaymentEventDelivery,
  PaymentEventReading,
  PaymentOutcome,
} from "../types";

/**
 * FedaPay's half of a webhook: proving it sent the delivery, and reading what
 * it said.
 *
 * Beside the adapter rather than in the route handler, for the reason
 * `src/sanity/preview.ts` holds Sanity's signature check: `/api/paiement/fedapay`
 * decides what to *do* with an event, and knows nothing about how one is proved
 * genuine (ADR-0008). Swapping the provider swaps this file and nothing else.
 *
 * **This file deliberately does not import `server-only`**, for the same reason
 * `provider.ts` beside it does not: the provider-contract suite has to import
 * it in Node and run it over a delivery FedaPay really sent. What keeps it off a
 * client bundle is that nothing in `src/` imports it but the adapter, and that
 * the secret is read inside a function rather than at module scope.
 */

/**
 * The secret FedaPay signs this deployment's deliveries with.
 *
 * Its own credential, separate from `FEDAPAY_SECRET_KEY`: FedaPay generates one
 * per endpoint and per environment, so sandbox and live never share it. Read
 * inside the function so importing this module needs no environment at all.
 */
function endpointSecret(): string {
  return process.env.FEDAPAY_WEBHOOK_SECRET ?? "";
}

/**
 * How old a delivery may be and still be accepted.
 *
 * The timestamp is inside what is signed, so it cannot be moved without
 * invalidating the signature, and FedaPay generates a fresh one on every resend
 * — a retry an hour later arrives with an hour-old body and a current
 * timestamp. Five minutes is therefore generous for a live delivery and narrow
 * for a captured one somebody is replaying.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * `t=1723710000,s=9f86d0…`
 *
 * FedaPay's official libraries build the signature over `${timestamp}.${body}`
 * with the endpoint secret, and send it under the `s` scheme beside the
 * timestamp that was signed. More than one `s` may be present while a secret is
 * being rotated, and any one of them matching is enough.
 *
 * Read defensively, and proved against a real delivery by
 * `tests/contract/fedapay.spec.ts`. That suite is the only thing that can
 * settle this: a fake that agreed with a wrong reading here would prove nothing.
 */
export function parseSignatureHeader(header: string): {
  timestamp: number;
  signatures: string[];
} {
  const parts = header.split(",");
  let timestamp = Number.NaN;
  const signatures: string[] = [];

  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const scheme = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (scheme === "t") {
      timestamp = Number(value);
    } else if (scheme === "s") {
      signatures.push(value);
    }
  }

  return { timestamp, signatures };
}

/** Compare two hexadecimal digests without leaking where they diverge. */
function matches(candidate: string, expected: string): boolean {
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(candidate, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

/**
 * Whether FedaPay signed this exact body, recently, with this endpoint's secret.
 *
 * An unconfigured secret never verifies anything. That is the safe failure: a
 * deployment that has not been given its endpoint secret refuses every event
 * and leaves every payment pending, rather than approving orders on the word of
 * whoever found the URL.
 */
export function isSignedFedaPayDelivery(
  body: string,
  header: string | null,
  secret = endpointSecret(),
  now = Date.now(),
): boolean {
  if (!secret || !header) {
    return false;
  }

  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    return false;
  }

  const age = Math.abs(now / 1000 - timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");

  return signatures.some((signature) => matches(signature, expected));
}

/**
 * What each FedaPay event means for a Payment State.
 *
 * Four names, and deliberately not one more. These are the events FedaPay's own
 * integration guide handles and the ones the README asks an operator to
 * subscribe to; everything else it can send — payouts, transfers, account
 * events — is acknowledged and ignored, which is the safe default for a name
 * nobody here has read the meaning of. Guessing at a fifth would eventually
 * approve an order on the strength of a payout.
 *
 * `transaction.created` is listed on purpose: it is a genuine event about an
 * order WeCreate knows, and it says nothing about whether it was paid.
 * Recording it and leaving the state alone keeps the history complete without
 * letting an announcement become a confirmation.
 */
const OUTCOMES: Record<string, PaymentOutcome> = {
  "transaction.created": "pending",
  "transaction.approved": "approved",
  "transaction.declined": "failed",
  "transaction.canceled": "cancelled",
};

/**
 * FedaPay's identity for one delivery.
 *
 * Its events carry an `id`; a delivery that somehow does not gets one derived
 * from the body, which is stable across redeliveries for the reason that
 * matters — the signature and its timestamp are in the header, so a resend of
 * the same event resends the same bytes.
 */
function eventIdentity(payload: Record<string, unknown>, body: string): string {
  const id = payload.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number") return String(id);

  return `sha256:${createHmac("sha256", "fedapay-event").update(body, "utf8").digest("hex")}`;
}

/** An ISO instant from whatever the payload offered, or the signed timestamp. */
function occurredAt(value: unknown, header: string | null): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }

  const { timestamp } = header
    ? parseSignatureHeader(header)
    : { timestamp: Number.NaN };
  return Number.isFinite(timestamp)
    ? new Date(timestamp * 1000).toISOString()
    : new Date().toISOString();
}

/**
 * Read one delivery, having proved FedaPay sent it.
 *
 * The order of the checks is the point: nothing is parsed before the signature
 * is proved, so a caller with no secret cannot hand this JSON to work its way
 * through.
 *
 * `at` exists for one caller and it is not the application: the contract suite
 * runs this over a delivery FedaPay signed at some point in the past, and
 * without a clock to hold still, *every* capture would be refused for age and
 * the parsing this file exists to prove would never be reached. The application
 * passes nothing and gets the real clock.
 */
export function readFedaPayEvent(
  delivery: PaymentEventDelivery,
  { at = Date.now(), secret = endpointSecret() }: { at?: number; secret?: string } = {},
): PaymentEventReading {
  const header = delivery.headers.get("x-fedapay-signature");
  if (!isSignedFedaPayDelivery(delivery.body, header, secret, at)) {
    return { status: "unsigned" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(delivery.body);
  } catch {
    return { status: "malformed" };
  }
  if (typeof payload !== "object" || payload === null) {
    return { status: "malformed" };
  }

  const event = payload as Record<string, unknown>;
  const name = typeof event.name === "string" ? event.name : "";
  if (!name) {
    return { status: "malformed" };
  }

  const outcome = OUTCOMES[name];
  if (!outcome) {
    return { status: "ignored" };
  }

  // FedaPay nests the transaction it is telling us about under `entity`. Its
  // id is a number in the API and is kept as text here, which is the shape the
  // payment attempt recorded when the transaction was created.
  const entity = event.entity;
  const transaction =
    typeof entity === "object" && entity !== null
      ? (entity as Record<string, unknown>).id
      : undefined;
  if (typeof transaction !== "string" && typeof transaction !== "number") {
    return { status: "malformed" };
  }

  return {
    status: "verified",
    event: {
      provider: "fedapay",
      providerEventId: eventIdentity(event, delivery.body),
      providerEventType: name,
      providerTransactionId: String(transaction),
      occurredAt: occurredAt(event.created_at, header),
      outcome,
    },
  };
}
