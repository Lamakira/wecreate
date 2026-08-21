import { randomBytes } from "node:crypto";

import type { PaymentOutcome } from "@/payments/types";

import type {
  FulfillmentState,
  OrderAnomalyKind,
  OrderSnapshot,
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
 * It is measured from the order's creation and never from its latest attempt,
 * so retrying cannot extend it — an Order Snapshot that kept renewing its own
 * window would hold yesterday's prices open indefinitely.
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
  cancelled: "-",
};

/**
 * What a verified event does to a Payment State.
 *
 * The rule, in one place, because two systems answer to it: Postgres enforces
 * it inside `commerce_record_payment_event` and the fixture applies it in
 * JavaScript — change one and change the other, as `maskEmail` says of itself
 * in `contact.ts`.
 *
 * Four answers, and the order of the questions is the whole rule:
 *
 * 1. An event that only announces a transaction says nothing about whether it
 *    was paid, whatever the order's state is.
 * 2. A pending order takes the first outcome that reaches it.
 * 3. **An approval decides an order whose payment had not succeeded.** A buyer
 *    may pay again for twenty-four hours (issue #13), so a refusal is not the
 *    end of an order — and when FedaPay says the money arrived, it arrived,
 *    whether that is the first thing it said or the third.
 * 4. Anything else arrived after payment truth was already decided. It is
 *    recorded and it changes nothing.
 *
 * Only one direction is closed, and it is the one that matters: **nothing may
 * unsay that a buyer paid.** An approved order is final, so a refusal, a
 * cancellation and a provider retrying out of order all land in (4) and are
 * kept for reconciliation rather than acted on (ADR-0005).
 */
export function paymentEventEffect(
  current: PaymentState,
  outcome: PaymentOutcome,
): PaymentEventEffect {
  if (outcome === "pending") return "unchanged";
  if (current === "pending") return "applied";
  // A second event saying what the state already says is agreement, not a
  // conflict, and reads better in the trail as such.
  if (current === outcome) return "unchanged";
  return current !== "approved" && outcome === "approved"
    ? "applied"
    : "superseded";
}

/**
 * What a verified event leaves for a person to settle, or nothing.
 *
 * The other half of `paymentEventEffect()`, and it exists because that function
 * answers a narrower question than it looks like it does. It says what an event
 * may do to a Payment State; it cannot say whether the fact that the event
 * arrived at all is fine. Two of its answers are ambiguous in exactly that way,
 * and the transaction the event is about is what tells the halves apart:
 *
 * - **A second approval.** For the transaction that already paid the order, it
 *   is the provider repeating itself and means nothing. For *another*
 *   transaction, it means the buyer's money was taken twice — the Payment State
 *   is right to stay where it is, and somebody owes a refund.
 * - **A contradiction.** For the transaction whose verdict currently stands,
 *   the provider has said the opposite of what it said before, and that is
 *   worth a person's attention. For another transaction it is ordinary: an
 *   earlier attempt's refusal arriving after a later attempt was approved is
 *   exactly what a retry looks like from the outside (issue #13).
 *
 * `commerce.payment_event_anomaly` is its twin — change one and change the
 * other.
 */
export function paymentEventAnomaly(input: {
  /** Where the Payment State stood when the event arrived. */
  current: PaymentState;
  outcome: PaymentOutcome;
  effect: PaymentEventEffect;
  /**
   * Whether this event is about the transaction whose event decided the current
   * Payment State. `false` when another one did, and when nothing has yet.
   */
  decidedByThisTransaction: boolean;
}): OrderAnomalyKind | null {
  const { current, outcome, effect, decidedByThisTransaction } = input;
  // An announcement is not a verdict, so it can neither contradict one nor be a
  // second payment.
  if (outcome === "pending") return null;

  if (effect === "superseded") {
    return decidedByThisTransaction ? "contradictory_event" : null;
  }
  if (
    effect === "unchanged" &&
    outcome === "approved" &&
    current === "approved" &&
    !decidedByThisTransaction
  ) {
    return "duplicate_payment";
  }
  return null;
}

/**
 * What can still happen to this order's payment.
 *
 * The rule the checkout, the payment return page and the data plane all answer
 * to, so that what a buyer is offered, what a page says and what a request that
 * never rendered a page is allowed to do cannot disagree. Four answers, and the
 * two in the middle are two different retries rather than one:
 *
 * - `awaiting`: an attempt is outstanding. There is nothing to do but wait for
 *   a verified event, and opening a second payment page is how somebody pays
 *   twice.
 * - `resumable`: nothing was ever opened with the provider — the payment page
 *   did not come back. Issue #10's narrow retry: the buyer never left the
 *   checkout, so what they are paying for is still decided with the cart in
 *   front of them.
 * - `retryable`: the provider refused the payment or the buyer cancelled it.
 *   Issue #13's retry: the Order Snapshot is what is being paid — its products,
 *   its prices, its Paid Deliverable Versions and the Legal Revisions the buyer
 *   accepted — and today's catalogue has no say in it.
 * - `closed`: nothing more will be collected for it. The payment was approved,
 *   or the twenty-four hours it was priced for have run out and the buyer
 *   starts again from what WeCreate publishes today.
 */
export type PaymentProspect =
  | "awaiting"
  | "resumable"
  | "retryable"
  | "closed";

export function paymentProspect(order: OrderSnapshot): PaymentProspect {
  if (order.paymentState === "approved") return "closed";
  if (!isWithinPaymentWindow(order)) return "closed";
  if (isAwaitingPayment(order)) return "awaiting";
  return order.paymentState === "pending" ? "resumable" : "retryable";
}

/**
 * Whether this order may still be handed to a payment provider.
 *
 * Both retries, because the data plane does not care which of them a buyer is
 * making: it is being asked for one more attempt against an order that has not
 * been paid for. `commerce_open_payment_attempt` is this function's twin —
 * change one and change the other.
 */
export function isPayable(order: OrderSnapshot): boolean {
  const prospect = paymentProspect(order);
  return prospect === "resumable" || prospect === "retryable";
}

/** Whether this order is still inside the window its prices were recorded for. */
function isWithinPaymentWindow(order: OrderSnapshot): boolean {
  const age = Date.now() - new Date(order.createdAt).getTime();
  return Number.isFinite(age) && age < ORDER_PAYABLE_SECONDS * 1000;
}

/**
 * Whether an attempt on this order is still outstanding.
 *
 * Two attempts are: one the provider gave a payment page for and no verified
 * event has answered, and one this application opened and never recorded an
 * answer for at all — a request that died between the two. They mean the same
 * thing to a buyer, which is that a payment may be in flight.
 *
 * An attempt that never reached the provider is not outstanding: nothing was
 * opened, so there is nothing to wait for.
 */
function isAwaitingPayment(order: OrderSnapshot): boolean {
  return order.attempts.some(
    (attempt) => attempt.state !== "failed" && attempt.outcome === null,
  );
}
