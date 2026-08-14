import "server-only";

import type {
  HostedPayment,
  HostedPaymentRequest,
  PaymentEventDelivery,
  PaymentEventReading,
  PaymentProviderId,
} from "./types";

export type { PaymentProviderId } from "./types";

/**
 * The single outbound boundary between WeCreate and whoever collects the money
 * (ADR-0008).
 *
 * Two methods, and they are the two directions money news travels: WeCreate
 * asks for a page a buyer can pay on, and the provider later tells WeCreate what
 * happened on it. Checkout.js and anything that would put a payment form on
 * WeCreate's own pages are explicitly out of scope (issue #1), and this
 * interface has nowhere to put them.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;

  /**
   * Create a transaction and return where the buyer pays.
   *
   * Throws `PaymentProviderUnreachable` when there is no page to send them to.
   * There is no "maybe" outcome: a checkout either has somewhere to send the
   * buyer or records a failed attempt and offers to try again.
   */
  createHostedPayment(request: HostedPaymentRequest): Promise<HostedPayment>;

  /**
   * Read one delivered event, having first proved the provider sent it.
   *
   * Verification belongs here rather than in the route handler because the
   * signature scheme is the provider's, and so is the shape underneath it: the
   * endpoint decides what to do with an answer, and never how one is reached
   * (ADR-0008).
   *
   * It returns rather than throws, because every answer is one this application
   * has a considered response to — including "signed, readable, and about
   * something WeCreate does not track".
   */
  readPaymentEvent(delivery: PaymentEventDelivery): PaymentEventReading;
}

/** Which provider this process pays through. See `PaymentProviderId`. */
export function resolvePaymentProviderId(): PaymentProviderId {
  const configured = process.env.WECREATE_PAYMENT_PROVIDER;
  if (configured === "fixture" || configured === "fedapay") {
    return configured;
  }
  return process.env.FEDAPAY_SECRET_KEY ? "fedapay" : "none";
}

/** The provider in use, or `undefined` on a deployment that cannot take money. */
export async function getPaymentProvider(): Promise<PaymentProvider | undefined> {
  switch (resolvePaymentProviderId()) {
    case "fixture": {
      const { fixturePaymentProvider } = await import("./fixture/provider");
      return fixturePaymentProvider;
    }
    case "fedapay": {
      // Imported lazily so a deployment with no payment provider never loads
      // the adapter or requires its environment variables to be present.
      const { fedaPayProvider } = await import("./fedapay/provider");
      return fedaPayProvider;
    }
    default:
      return undefined;
  }
}
