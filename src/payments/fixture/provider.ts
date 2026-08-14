import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { PaymentProvider } from "../provider";
import {
  PaymentProviderUnreachable,
  type HostedPayment,
  type HostedPaymentRequest,
  type PaymentEventDelivery,
  type PaymentEventReading,
  type PaymentOutcome,
} from "../types";

/**
 * A deterministic payment provider.
 *
 * This is the provider fake the acceptance suite runs the real application
 * against: the same page, the same action, the same Order Snapshot, the same
 * endpoint receiving the same signed delivery, with FedaPay replaced at the
 * boundary rather than anything inside the application mocked. It creates
 * nothing and charges nothing; what it can do is *say* what happened, which is
 * the whole of what a payment provider ever tells this application.
 *
 * The hosted address it hands back is not real and nothing resolves it. A test
 * answers it in the browser, which is how a scenario can follow the redirect a
 * buyer really takes and read what WeCreate asked for.
 *
 * **How it reads a delivery is its own, not FedaPay's.** The signature scheme
 * and the payload reader below look like the adapter's and are deliberately not
 * shared with it: a fake that ran the same code would agree with a wrong
 * reading of FedaPay's wire format, and the suite would prove nothing about the
 * half that faces the vendor. FedaPay's is in the adapter, and only
 * `tests/contract/fedapay.spec.ts` can settle it. What the two share is the
 * *shape* of the problem — a shared secret over the raw body, an event name and
 * a transaction identity — which is what makes this suite's coverage of the
 * endpoint, the data plane and the buyer's page meaningful.
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

/**
 * The events this fixture understands, in the provider's own vocabulary.
 *
 * The same four names FedaPay uses, so a scenario reads as the thing it stands
 * for. Everything else is a genuine event about something WeCreate does not
 * track, and is acknowledged rather than acted on.
 */
const OUTCOMES: Record<string, PaymentOutcome> = {
  "transaction.created": "pending",
  "transaction.approved": "approved",
  "transaction.declined": "failed",
  "transaction.canceled": "cancelled",
};

/** A hexadecimal digest of the raw body, keyed with this run's shared secret. */
function digest(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function isSignedDelivery(body: string, signature: string | null): boolean {
  const secret = process.env.WECREATE_PAYMENT_WEBHOOK_SECRET ?? "";
  // An unconfigured secret verifies nothing, exactly as the real adapter's
  // does: a run without one leaves every payment pending rather than approving
  // orders on the word of whoever found the URL.
  if (!secret || !signature) return false;

  const expected = digest(body, secret);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

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

  readPaymentEvent(delivery: PaymentEventDelivery): PaymentEventReading {
    if (
      !isSignedDelivery(
        delivery.body,
        delivery.headers.get("x-fedapay-signature"),
      )
    ) {
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
    const outcome = OUTCOMES[name];
    if (!name) return { status: "malformed" };
    if (!outcome) return { status: "ignored" };

    const entity = event.entity;
    const transaction =
      typeof entity === "object" && entity !== null
        ? (entity as Record<string, unknown>).id
        : undefined;
    if (typeof transaction !== "string" && typeof transaction !== "number") {
      return { status: "malformed" };
    }

    const created = typeof event.created_at === "string" ? event.created_at : "";
    const parsed = Date.parse(created);

    return {
      status: "verified",
      event: {
        provider: "fixture",
        // A delivery with no identity of its own is identified by its body,
        // which is what makes a redelivery recognisable as the same event.
        providerEventId:
          typeof event.id === "string" && event.id
            ? event.id
            : `sha256:${digest(delivery.body, "fixture-event")}`,
        providerEventType: name,
        providerTransactionId: String(transaction),
        occurredAt: Number.isFinite(parsed)
          ? new Date(parsed).toISOString()
          : new Date().toISOString(),
        outcome,
      },
    };
  },
};
