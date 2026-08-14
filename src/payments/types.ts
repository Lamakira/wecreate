/**
 * Collecting money for a Digital Product, in WeCreate's own vocabulary.
 *
 * Everything here describes what the application needs, not what a provider
 * happens to offer: WeCreate asks for a page a buyer can pay on, and is told
 * where it is and what the provider calls the transaction behind it. The FedaPay
 * adapter maps its shapes onto these, and the fixture produces the same ones
 * without a vendor (ADR-0008).
 *
 * Two things are deliberately absent. Nothing about a *payment method* crosses
 * this boundary — no card, no Mobile Money number, no token — because the whole
 * point of a hosted page is that WeCreate never sees any of it (issue #1). And
 * there is no way to ask this boundary whether a payment succeeded: a browser
 * coming back from the provider is not evidence, and only a verified webhook
 * may move a Payment State (issue #11).
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
