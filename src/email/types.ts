/**
 * Sending a buyer their receipt, in WeCreate's own vocabulary.
 *
 * Everything here describes what the application needs, not what a provider
 * happens to offer: WeCreate has one message to send to one address, and asks
 * for it to be sent exactly once. The Resend adapter maps its shapes onto
 * these, and the fixture keeps them without a vendor (ADR-0008).
 *
 * Three things are deliberately absent, and each is a decision issue #1 made:
 * there are no lists, no templates and no marketing of any kind — a purchase
 * never implies consent to be written to again; there is no attachment, because
 * a Paid Deliverable is reached through Order Access rather than mailed; and
 * there is no way to *ask* whether a message arrived. Delivery is the
 * provider's business, and a Fulfillment State records only what WeCreate could
 * observe: that the send was accepted, or that it was not.
 */

/**
 * Which provider this process sends through.
 *
 * `none` is not an error state: it is a deployment with no Resend credentials,
 * where the site still runs and an approved payment is fulfilled as far as it
 * can be — the grants are made and the Fulfillment State says the delivery has
 * to be taken up again. Silence would be worse: a buyer whose receipt was never
 * sent must be visible as one.
 *
 * The fixture is never reached by accident, for the reason the commerce one is
 * not: it accepts every address and delivers to nobody, so an unconfigured
 * deployment must not fall back to it.
 */
export type EmailProviderId = "resend" | "fixture" | "none";

/**
 * One transactional message, ready to send.
 *
 * `idempotencyKey` is what stops a provider's retry, a re-run and a second
 * webhook from becoming three receipts in a buyer's inbox. It is derived from a
 * stable fulfillment event rather than from the moment of sending (issue #1),
 * so the same delivery asked for twice is asked for with the same key and the
 * provider recognises it.
 *
 * The body is plain text. A receipt is read on a phone on a Benin mobile
 * connection, it has to survive every mail client WeCreate's buyers use, and
 * nothing in it needs a layout — so there is no HTML half to keep in step with
 * it and no image to fail to load.
 */
export interface TransactionalEmail {
  to: string;
  subject: string;
  body: string;
  idempotencyKey: string;
}

/**
 * The provider did not accept the message.
 *
 * Thrown rather than returned, for the reason `PaymentProviderUnreachable` is:
 * there is no second outcome to weigh it against. The message names what
 * failed, in words safe to store and log beside an order reference — never a
 * key, a payload, a token or the buyer's address.
 */
export class EmailProviderUnreachable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "EmailProviderUnreachable";
  }
}
