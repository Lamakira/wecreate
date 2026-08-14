import { expect, test } from "@playwright/test";

import {
  fedaPayApiOrigin,
  fedaPayEnvironment,
  fedaPayProvider,
} from "../../src/payments/fedapay/provider";

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
 */

const CONFIGURED = Boolean(process.env.FEDAPAY_SECRET_KEY);

test.skip(
  !CONFIGURED,
  "Set FEDAPAY_SECRET_KEY from a FedaPay sandbox account to run the contract suite.",
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

test.describe("Creating a hosted payment", () => {
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
