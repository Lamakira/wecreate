import { randomUUID } from "node:crypto";

import type { PaymentProvider } from "../provider";
import {
  PaymentProviderUnreachable,
  type HostedPayment,
  type HostedPaymentRequest,
} from "../types";

/**
 * A deterministic payment provider.
 *
 * This is the provider fake the acceptance suite runs the real application
 * against: the same page, the same action, the same Order Snapshot, with
 * FedaPay replaced at the boundary rather than anything inside the application
 * mocked. It creates nothing, charges nothing and confirms nothing — payment
 * truth arrives by webhook (issue #11), and this cannot produce one.
 *
 * The hosted address it hands back is not real and nothing resolves it. A test
 * answers it in the browser, which is how a scenario can follow the redirect a
 * buyer really takes and read what WeCreate asked for.
 */

/** Where this provider says its page is. Deliberately not a resolvable host. */
const HOSTED_ORIGIN = "https://hosted.fedapay.test";

/**
 * The buyer whose payment page never opens.
 *
 * A documented way to be unreachable, which is the same trick a real payment
 * sandbox plays with a card number that always declines. Transaction creation
 * failing is a state the checkout has to handle — issue #10 asks for a
 * diagnosable order, a safe retry and no duplicate Order Snapshot — and it
 * cannot be demonstrated by unplugging anything.
 */
export const UNREACHABLE_BUYER_EMAIL = "panne-fedapay@exemple.test";

export const fixturePaymentProvider: PaymentProvider = {
  id: "fixture",

  async createHostedPayment(
    request: HostedPaymentRequest,
  ): Promise<HostedPayment> {
    if (request.buyer.email.trim().toLowerCase() === UNREACHABLE_BUYER_EMAIL) {
      throw new PaymentProviderUnreachable(
        "POST /v1/transactions answered 502",
      );
    }

    const providerTransactionId = randomUUID();
    // Everything WeCreate asked for, in the address, so a scenario can assert
    // what was sent without reaching inside the application.
    const redirect = new URL(`${HOSTED_ORIGIN}/pay`);
    redirect.searchParams.set("reference", request.reference);
    redirect.searchParams.set("amount", String(request.amountXof));
    redirect.searchParams.set("currency", "XOF");
    redirect.searchParams.set("transaction", providerTransactionId);
    redirect.searchParams.set("callback", request.returnUrl);

    return { providerTransactionId, redirectUrl: redirect.toString() };
  },
};
