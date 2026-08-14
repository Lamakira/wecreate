import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  fedaPayApiOrigin,
  fedaPayEnvironment,
  fedaPayProvider,
} from "../../src/payments/fedapay/provider";
import {
  isSignedFedaPayDelivery,
  parseSignatureHeader,
  readFedaPayEvent,
} from "../../src/payments/fedapay/webhook";

/**
 * What WeCreate and FedaPay have agreed on.
 *
 * The acceptance suite proves the application behaves correctly around a
 * payment provider; it cannot prove that the request the adapter sends is one
 * FedaPay accepts, or that the response it sends back still has a payment page
 * in it. A fake that got the shape wrong would agree with an adapter that got
 * it wrong. Only the vendor can settle that, which is what this suite is for
 * (issue #1).
 *
 * It is the one place in this repository that imports an adapter directly
 * rather than driving the running application, and that is the point: the
 * contract under test is the adapter's, not a page's.
 *
 * **It never creates a live charge.** It refuses to run outside FedaPay's
 * sandbox, and a sandbox transaction is an intent to collect that nobody pays.
 * Run it with sandbox credentials in the environment:
 *
 *     FEDAPAY_SECRET_KEY=sk_sandbox_… pnpm test:contract
 *
 * The two halves of the integration are gated separately, because they need
 * different things: creating a transaction needs an API key, and reading a
 * delivered event needs an endpoint secret and a delivery somebody captured
 * with FedaPay's webhook tooling. Whichever is available runs.
 */

test.describe("Creating a hosted payment", () => {
  test.skip(
    !process.env.FEDAPAY_SECRET_KEY,
    "Set FEDAPAY_SECRET_KEY from a FedaPay sandbox account to run these.",
  );

  test.beforeAll(() => {
    // A guard rather than a skip: being pointed at the live API is a mistake to
    // stop, not a reason to quietly pass.
    expect(
      fedaPayEnvironment(),
      "the contract suite refuses to run against the live FedaPay API",
    ).toBe("sandbox");
    expect(fedaPayApiOrigin()).toBe("https://sandbox-api.fedapay.com");
  });

  test("is accepted, and answers with a payment page", async () => {
    const hosted = await fedaPayProvider.createHostedPayment({
      reference: "WC-CONTRACT-TEST",
      // Small, whole, and in the only currency WeCreate charges.
      amountXof: 1000,
      description: "Contrôle de contrat WeCreate · sandbox",
      buyer: {
        fullName: "Contrat Sandbox",
        email: "contrat@exemple.test",
        // A Benin number, so the country the adapter derives from the dialling
        // code is one FedaPay accepts beside it.
        telephone: "+22997000000",
      },
      returnUrl: "https://example.test/commande/retour",
    });

    // Reaching here at all is most of the point: a request FedaPay did not
    // accept — a wrong field name, a missing customer, an amount it will not
    // take, an unauthenticated call — never returns. What is left to assert is
    // that the two values the checkout depends on parsed out of the answer: an
    // identity to record with the attempt, and somewhere to send the buyer.
    expect(hosted.providerTransactionId).toMatch(/^\S+$/);
    expect(hosted.redirectUrl).toMatch(/^https:\/\//);
    expect(new URL(hosted.redirectUrl).hostname).toContain("fedapay");
  });
});

/**
 * Reading a delivery FedaPay really sent.
 *
 * This is the half of the integration a sandbox transaction cannot reach: a
 * webhook goes to a public address, so nothing in a test run can provoke one.
 * What *can* be settled here is the thing that would otherwise be settled in
 * production — whether the signature scheme the adapter implements is FedaPay's,
 * and whether the body underneath it still parses.
 *
 * So this suite runs against a delivery somebody captured with FedaPay's own
 * webhook tooling, exactly as it arrived. Capture one and point these two
 * variables at it:
 *
 *     FEDAPAY_WEBHOOK_SECRET=wh_sandbox_…
 *     FEDAPAY_WEBHOOK_DELIVERY=/path/to/delivery.json
 *     pnpm test:contract
 *
 * `delivery.json` is `{ "signature": "<X-FEDAPAY-SIGNATURE>", "body": "<raw body>" }`
 * — see README.md, *Setting up FedaPay*. The body has to be the bytes that were
 * sent: a re-serialised copy is a different body, and a signature over it would
 * prove nothing.
 */
const DELIVERY_FILE = process.env.FEDAPAY_WEBHOOK_DELIVERY;
const WEBHOOK_SECRET = process.env.FEDAPAY_WEBHOOK_SECRET ?? "";

test.describe("Reading a delivered event", () => {
  test.skip(
    !DELIVERY_FILE || !WEBHOOK_SECRET,
    "Set FEDAPAY_WEBHOOK_SECRET and FEDAPAY_WEBHOOK_DELIVERY from a captured sandbox delivery to run these.",
  );

  function captured(): { signature: string; body: string } {
    return JSON.parse(readFileSync(DELIVERY_FILE as string, "utf8")) as {
      signature: string;
      body: string;
    };
  }

  /** The moment the capture was signed, so its age is not what is under test. */
  function whenSigned(signature: string): number {
    const { timestamp } = parseSignatureHeader(signature);
    expect(
      Number.isFinite(timestamp),
      "the captured signature names the timestamp it was signed with",
    ).toBe(true);
    return timestamp * 1000;
  }

  test("verifies against the endpoint secret that signed it", () => {
    const { signature, body } = captured();

    expect(
      isSignedFedaPayDelivery(body, signature, WEBHOOK_SECRET, whenSigned(signature)),
    ).toBe(true);
  });

  test("refuses the same delivery under a different secret, or a changed body", () => {
    const { signature, body } = captured();
    const signedAt = whenSigned(signature);

    expect(
      isSignedFedaPayDelivery(body, signature, "wh_not_this_one", signedAt),
    ).toBe(false);
    expect(
      isSignedFedaPayDelivery(`${body} `, signature, WEBHOOK_SECRET, signedAt),
    ).toBe(false);
  });

  test("refuses it once it is too old to be a live delivery", () => {
    const { signature, body } = captured();

    // The capture is by definition stale by now, which is the assertion: the
    // timestamp is inside what was signed, so a replay cannot be made current.
    expect(isSignedFedaPayDelivery(body, signature, WEBHOOK_SECRET)).toBe(false);
  });

  test("parses into an event the commerce data plane can record", () => {
    const { signature, body } = captured();

    const reading = readFedaPayEvent(
      { body, headers: new Headers({ "x-fedapay-signature": signature }) },
      // The clock held at the moment FedaPay signed it. A capture is stale by
      // definition — the test above is what proves a stale one is refused —
      // and without holding the clock this test would skip itself forever and
      // the parsing it exists to check would never run.
      { at: whenSigned(signature), secret: WEBHOOK_SECRET },
    );

    expect(reading.status).toBe("verified");
    if (reading.status !== "verified") return;

    // The three values everything downstream depends on: which order this is
    // about, what happened, and how a redelivery is recognised.
    expect(reading.event.providerTransactionId).toMatch(/^\S+$/);
    expect(reading.event.providerEventId).toMatch(/^\S+$/);
    // One of the four names the adapter maps. A capture of anything else is a
    // fine delivery and the wrong sample for this suite — `status` would be
    // `ignored` above and this assertion says which capture to take instead.
    expect([
      "transaction.created",
      "transaction.approved",
      "transaction.declined",
      "transaction.canceled",
    ]).toContain(reading.event.providerEventType);
    expect(Number.isFinite(Date.parse(reading.event.occurredAt))).toBe(true);
    expect(["pending", "approved", "failed", "cancelled"]).toContain(
      reading.event.outcome,
    );
  });
});
