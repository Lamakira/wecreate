import { randomBytes } from "node:crypto";

import type { PaymentOutcome } from "@/payments/types";

import type {
  FulfillmentState,
  OrderSnapshot,
  PaymentAttempt,
  PaymentEventEffect,
  PaymentState,
} from "./types";

/**
 * The rules an order carries with it, wherever it is stored.
 *
 * Pure functions over the records in `types.ts`, like `paid-deliverables.ts` is
 * for versions: how an order is named, how long it may still be paid for, and
 * what the last attempt on it means. The Supabase adapter and the fixture both
 * answer to these rather than each inventing their own.
 */

/**
 * Crockford's base32 without `I`, `L`, `O` and `U`.
 *
 * A reference is read aloud to support and typed back in, so the characters
 * that get confused with one another are simply not in it. `U` is left out for
 * the reason Crockford leaves it out: it keeps an accidental obscenity from
 * being generated.
 */
const REFERENCE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Two groups of five, which is what a person can read back over a telephone. */
const REFERENCE_GROUPS = 2;
const REFERENCE_GROUP_LENGTH = 5;

/**
 * WeCreate's own name for one order: `WC-7Q2M9-XZK4T`.
 *
 * It is printed on the ticket, quoted in support and logged beside a provider's
 * transaction id, so it has to be readable. It is also the only thing standing
 * between somebody guessing an address and reading what an order contains, so
 * it has to be unguessable: fifty bits of randomness from a cryptographic
 * source, which is not a number anybody enumerates. That is why the reference
 * is generated rather than counted — an order number that went up by one would
 * hand every order to whoever placed the last one.
 *
 * It is deliberately not a date. A reference that carried one would tell a
 * reader when WeCreate's first order was, and would still have to carry the
 * randomness underneath.
 */
export function newOrderReference(): string {
  const length = REFERENCE_GROUPS * REFERENCE_GROUP_LENGTH;
  // 32 evenly divides 256, so taking each byte modulo the alphabet's length
  // leaves every character equally likely.
  const characters = Array.from(
    randomBytes(length),
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  );

  const groups: string[] = [];
  for (let start = 0; start < length; start += REFERENCE_GROUP_LENGTH) {
    groups.push(characters.slice(start, start + REFERENCE_GROUP_LENGTH).join(""));
  }
  return `WC-${groups.join("-")}`;
}

/** Whether a string could be one of ours, for a lookup that should not be made. */
export function isOrderReference(value: string): boolean {
  const group = `[${REFERENCE_ALPHABET}]{${REFERENCE_GROUP_LENGTH}}`;
  return new RegExp(`^WC-${group}(-${group}){${REFERENCE_GROUPS - 1}}$`).test(
    value,
  );
}

/**
 * How long an order may still be paid for at the prices it recorded.
 *
 * Issue #1: another attempt may be made against the same Order Snapshot until
 * the order is twenty-four hours old, after which a buyer starts again at
 * current prices rather than under commercial terms nobody has looked at since.
 * Issue #13 builds the rest of that retry journey; this is the window it will
 * widen, and the reason a buyer cannot be trapped by an order they abandoned.
 */
export const ORDER_PAYABLE_SECONDS = 24 * 60 * 60;

/**
 * What a buyer is told about their payment, in French.
 *
 * Beside the rule, as `AVAILABILITY_LABELS` is. Nothing here is a colour or a
 * symbol: issue #1 asks for transaction states to be distinguished by words and
 * structure rather than by a red or a green accent.
 */
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  pending: "En attente de confirmation",
  approved: "Paiement approuvé",
  failed: "Paiement non abouti",
  cancelled: "Paiement annulé",
};

/**
 * The same for the other half of an order, which moves on its own (ADR-0005).
 *
 * `not_started` is written as *Préparation à venir* rather than as a failure or
 * a promise: an order that has not been paid for has nothing to deliver yet,
 * and saying so plainly is the point. `failed` is *Livraison à reprendre* for
 * the same reason — it is a thing WeCreate has to do again, not a thing the
 * buyer has to do, and least of all a payment they have to make again.
 */
export const FULFILLMENT_STATE_LABELS: Record<FulfillmentState, string> = {
  not_started: "Préparation à venir",
  processing: "Préparation en cours",
  delivered: "Livraison envoyée",
  failed: "Livraison à reprendre",
};

/**
 * A mark beside each state, for a reader scanning rather than reading.
 *
 * Decoration and nothing more: issue #1 rules out distinguishing transaction
 * states by a red or a green accent, and a symbol carrying meaning on its own
 * is the same mistake in another alphabet. Every surface that prints one hides
 * it from assistive technology and puts the word beside it.
 */
export const PAYMENT_STATE_MARKS: Record<PaymentState, string> = {
  pending: "…",
  approved: "✓",
  failed: "×",
  cancelled: "—",
};

/**
 * What a verified event does to a Payment State.
 *
 * The rule, in one place, because two systems answer to it: Postgres enforces
 * it inside `commerce_record_payment_event` and the fixture applies it in
 * JavaScript — change one and change the other, as `maskEmail` says of itself.
 *
 * Three answers, and the order of the questions is the whole rule:
 *
 * 1. An event that only announces a transaction says nothing about whether it
 *    was paid, whatever the order's state is.
 * 2. A pending order takes the first outcome that reaches it.
 * 3. Anything else arrived after payment truth was already decided. It is
 *    recorded and it changes nothing — nothing may unsay that a buyer paid, and
 *    a provider retrying out of order must not be able to (ADR-0005).
 */
export function paymentEventEffect(
  current: PaymentState,
  outcome: PaymentOutcome,
): PaymentEventEffect {
  if (outcome === "pending") return "unchanged";
  if (current === "pending") return "applied";
  // A second event saying what the state already says is agreement, not a
  // conflict, and reads better in the trail as such.
  return current === outcome ? "unchanged" : "superseded";
}

/** Whether this order may still be handed to a payment provider. */
export function isPayable(order: OrderSnapshot): boolean {
  if (order.paymentState !== "pending") {
    return false;
  }
  const age = Date.now() - new Date(order.createdAt).getTime();
  return Number.isFinite(age) && age < ORDER_PAYABLE_SECONDS * 1000;
}

/** The most recent attempt made on this order, if any has been. */
export function lastAttempt(order: OrderSnapshot): PaymentAttempt | undefined {
  return order.attempts.at(-1);
}

/**
 * The delivery address, masked: `a***@exemple.com`.
 *
 * Enough for the buyer to recognise their own, and not enough for anyone
 * holding a reference to learn one.
 *
 * Postgres masks it in `commerce.mask_email`, because the whole point is that
 * the unmasked address never leaves the database. This is the fixture's half of
 * the same rule, and the two are written to agree: change one and change the
 * other.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) {
    // Not an address this application would have accepted. Nothing of it is
    // shown rather than guessing which half was the local part.
    return "***";
  }
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}
