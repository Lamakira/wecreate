/**
 * Collecting money for a Digital Product, in WeCreate's own vocabulary.
 *
 * Everything here describes what the application needs, not what a provider
 * happens to offer: WeCreate asks for a page a buyer can pay on, and is told
 * where it is and what the provider calls the transaction behind it. The FedaPay
 * adapter maps its shapes onto these, and the fixture produces the same ones
 * without a vendor (ADR-0008).
 *
 * One thing is deliberately absent. Nothing about a *payment method* crosses
 * this boundary — no card, no Mobile Money number, no token — because the whole
 * point of a hosted page is that WeCreate never sees any of it (issue #1).
 *
 * And one thing is deliberately narrow. There is no way to *ask* this boundary
 * whether a payment succeeded: the only thing that can say so is an event the
 * provider delivered and this application verified. A browser coming back from
 * the hosted page is not evidence, and neither is anything it carries.
 */

/**
 * Which provider this process pays through.
 *
 * Here rather than beside the interface so anything may name one without
 * reaching for a server-only module: a payment attempt records which provider
 * it was made with, and that record lives in the commerce data plane.
 *
 * `none` is not an error state: it is a checkout with no FedaPay credentials,
 * where the site still runs, the Boutique still works, and the checkout says
 * out loud that online payment is not open yet — exactly as `/studio` and
 * `/commerce` do without their own credentials.
 *
 * The fixture is never reached by accident. It hands buyers to an address that
 * does not exist and reports transactions nobody made, so an unconfigured
 * deployment must not fall back to it: it is used only when something
 * explicitly asks for it.
 */
export type PaymentProviderId = "fedapay" | "fixture" | "none";

/** Who the payment is for. The buyer contact snapshot, as the provider needs it. */
export interface PaymentBuyer {
  fullName: string;
  email: string;
  /** International form, `+` and digits only. */
  telephone: string;
}

export interface HostedPaymentRequest {
  /** WeCreate's own order reference, which is how the two systems agree. */
  reference: string;
  /** Whole XOF. WeCreate charges no fraction of a franc and no other currency. */
  amountXof: number;
  /** What the buyer will read on the provider's page. */
  description: string;
  buyer: PaymentBuyer;
  /** Where the provider sends the browser afterwards. Proof of nothing. */
  returnUrl: string;
}

export interface HostedPayment {
  /** The provider's own identity for this transaction, recorded with the attempt. */
  providerTransactionId: string;
  /** Where the buyer completes payment. Another origin, always. */
  redirectUrl: string;
}

/**
 * One delivery from a payment provider, exactly as it arrived.
 *
 * The body is the raw text and not a parsed object, because a signature is over
 * bytes: re-serialising a parsed body changes it, and a check that passes on
 * something other than what was sent is not a check (issue #1).
 */
export interface PaymentEventDelivery {
  /** The raw request body. */
  body: string;
  /** The request headers, for whatever the provider signs with. */
  headers: Headers;
}

/**
 * What one event says about the money, in WeCreate's own vocabulary.
 *
 * The same four words a Payment State is written in, on purpose: an event
 * carries an outcome and the data plane decides whether the state may move to
 * it. `pending` is a real answer — a provider announcing a transaction it has
 * only just created has said nothing new about whether it was paid.
 */
export type PaymentOutcome = "pending" | "approved" | "failed" | "cancelled";

/** One verified event, in the shape the commerce data plane records. */
export interface PaymentEvent {
  /**
   * Which provider delivered it.
   *
   * Part of the event's identity rather than context around it: two providers
   * numbering their events from one must not collide, and a recorded event has
   * to say who said it without the reader inferring it from a URL.
   */
  provider: PaymentProviderId;
  /**
   * The provider's own identity for this delivery.
   *
   * How a retry is recognised as the same event rather than a second one. It
   * has to be stable across redeliveries, which is why a provider that gives no
   * identity of its own gets one derived from the body it sent rather than from
   * the moment it arrived.
   */
  providerEventId: string;
  /** The provider's own name for what happened, recorded as it was sent. */
  providerEventType: string;
  /** The provider's transaction identity, which is how the order is found. */
  providerTransactionId: string;
  /** When the provider says it happened. */
  occurredAt: string;
  outcome: PaymentOutcome;
}

/**
 * What reading a delivery came to.
 *
 * Four answers, and the caller owes each a different HTTP status. `ignored` is
 * not a refusal: a genuine event this application has no meaning for is
 * acknowledged, because a provider told it failed will redeliver it forever.
 */
export type PaymentEventReading =
  | { status: "verified"; event: PaymentEvent }
  /** The signature was absent, malformed, stale or wrong for this body. */
  | { status: "unsigned" }
  /** Signed by the provider, and not something this boundary can read. */
  | { status: "malformed" }
  /** Signed and readable, and about something WeCreate does not track. */
  | { status: "ignored" };

/**
 * The provider did not create a payment page.
 *
 * Thrown rather than returned, because there is no second outcome to weigh it
 * against: either there is a page to send the buyer to or there is not. The
 * message is written to be stored and logged beside an order reference — it
 * names what failed and never carries a key, a payload or a buyer's details.
 */
export class PaymentProviderUnreachable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PaymentProviderUnreachable";
  }
}
