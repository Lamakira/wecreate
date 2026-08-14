import { expect, test, type Page } from "@playwright/test";

import {
  FEDAPAY_HOSTED_ORIGIN,
  expectHeading,
  fillGuestDetails,
  interceptHostedPayment,
} from "./support/checkout";
import { CommerceDataPlane, putOnSale } from "./support/commerce";
import { arriveWithCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import {
  SIGNATURE_HEADER,
  WEBHOOK_PATH,
  deliver,
  deliverPaymentEvent,
  deliveryBody,
  fetchOrderState,
  readOrderState,
  sign,
  transactionFromHostedPage,
} from "./support/payment-events";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * Payment truth: what a verified provider event may say, and what nothing else
 * may.
 *
 * Everything below drives the same running application a buyer drives. The
 * browser walks the checkout and leaves for the hosted page; the events arrive
 * as real HTTP requests to the real endpoint, signed the way the provider signs
 * them (issue #1). Nothing here reaches inside the application, and nothing
 * mocks a module: the payment provider is faked at WeCreate's own outbound
 * boundary, as Sanity and Supabase are.
 *
 * The single rule these scenarios exist to hold: **only a verified event moves
 * a Payment State.** A browser coming back from the provider, a forged query
 * parameter, an unsigned POST, a connection that dropped — none of them is
 * evidence of anything, and none of them may be shown to a buyer as one.
 */

const LUT = sampleProduct();

let content: ManagedContent;
let commerce: CommerceDataPlane;

test.beforeEach(async ({ page, request }) => {
  content = new ManagedContent(request);
  commerce = new CommerceDataPlane(request);
  await content.reset();
  await commerce.reset();
  await interceptHostedPayment(page);
});

test.afterEach(async () => {
  await content.reset();
  await commerce.reset();
});

/**
 * A buyer who has been through the checkout and is standing on the hosted
 * payment page, with the transaction identity a webhook will name.
 */
async function payFor(page: Page): Promise<string> {
  await content.editDraft({
    legalDocuments: approvedLegalDocuments(),
    boutique: { products: [LUT] },
  });
  await content.publish();
  await putOnSale(page, [LUT.sku]);

  await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);
  await page.goto("/commande");
  await fillGuestDetails(page);
  await page.getByTestId("checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

  return transactionFromHostedPage(page);
}

/** What the return view is showing this browser right now. */
function paymentState(page: Page) {
  return page.getByTestId("order-payment-state");
}

test.describe("A verified event", () => {
  test("is what moves a Payment State to approved", async ({ page, request }) => {
    const transaction = await payFor(page);

    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");

    await expectHeading(page, "Paiement approuvé.");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
    // Two facts, printed separately (ADR-0005). What delivery then does with an
    // approved payment — and what it says when it fails — is
    // `order-access.spec.ts`; what matters here is that the two are tracked
    // apart and that the payment is settled on its own.
    await expect(page.getByTestId("order-fulfillment")).toHaveText(
      "Livraison envoyée",
    );
    // No second payment is offered on any settled surface.
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);
  });

  test("says a refused payment plainly, and offers a way forward", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");

    await expectHeading(page, "Paiement non abouti.");
    await expect(paymentState(page)).toHaveText("Paiement non abouti");
    await expect(page.getByTestId("checkout-stage")).toContainText(
      "rien n'a été débité",
    );
    // A buyer whose payment failed is not stuck: the way back to the Boutique
    // is on the page, and nothing here charges them again.
    await expect(page.getByTestId("payment-next-step")).toBeVisible();
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);
  });

  test("says a cancelled payment plainly", async ({ page, request }) => {
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.canceled",
    });

    await page.goto("/commande/retour");

    await expectHeading(page, "Paiement annulé.");
    await expect(paymentState(page)).toHaveText("Paiement annulé");
    await expect(page.getByTestId("payment-next-step")).toBeVisible();
  });

  test("tells the states apart by words and structure, not by a colour", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });
    await page.goto("/commande/retour");

    // The mark beside the state is decoration for a sighted reader and is
    // hidden from assistive technology: the word carries the meaning, so a
    // reader who cannot see the mark loses nothing (issue #1).
    const mark = page.getByTestId("payment-state-mark");
    await expect(mark).toHaveAttribute("aria-hidden", "true");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
  });
});

test.describe("What the endpoint refuses", () => {
  test("refuses an event whose signature does not match the body", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);

    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        signature: sign("something else entirely"),
      }),
    ).toBe(401);

    await page.goto("/commande/retour");
    await expectHeading(page, "Vérification du paiement.");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
  });

  test("refuses an event carrying no signature at all", async ({ request }) => {
    const response = await request.post(WEBHOOK_PATH, {
      headers: { "content-type": "application/json" },
      data: Buffer.from(
        deliveryBody({ transaction: "unknown", name: "transaction.approved" }),
        "utf8",
      ),
    });
    expect(response.status()).toBe(401);
  });

  test("refuses a signed body that is not an event", async ({ page, request }) => {
    await payFor(page);

    expect(await deliver(request, "{ this is not json")).toBe(400);

    await page.goto("/commande/retour");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
  });

  test("refuses a body larger than an event could be", async ({ page, request }) => {
    await payFor(page);

    // Well past anything a payment event contains, and refused before it is
    // parsed or verified: a signature check over an unbounded body is work an
    // unauthenticated caller gets to ask for.
    const body = JSON.stringify({ padding: "x".repeat(80_000) });
    expect(await deliver(request, body)).toBe(413);

    await page.goto("/commande/retour");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
  });

  test("refuses a body that does not claim to be JSON", async ({ request }) => {
    const body = deliveryBody({ transaction: "x", name: "transaction.approved" });
    const response = await request.post(WEBHOOK_PATH, {
      headers: {
        "content-type": "text/plain",
        [SIGNATURE_HEADER]: sign(body),
      },
      data: Buffer.from(body, "utf8"),
    });
    expect(response.status()).toBe(415);
  });
});

test.describe("Deliveries that repeat, arrive late, or mean nothing", () => {
  test("acknowledges a duplicate delivery without acting on it twice", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    const eventId = "evt-repeated-delivery";

    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId,
      }),
    ).toBe(200);
    // The provider retries because it did not hear the first answer. The same
    // event, the same identity, and nothing happens a second time.
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId,
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
  });

  test("treats a redelivery as the same event, whatever its body now says", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    const eventId = "evt-one-identity";

    // The provider announces the transaction. Recorded, and it decides nothing.
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.created",
        eventId,
      }),
    ).toBe(200);

    // The same event identity comes back carrying an approval. It is not a
    // second event and it does not get to be one: this is what makes a
    // provider's retries safe, and it is the assertion that fails first if
    // deduplication is ever dropped.
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId,
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expectHeading(page, "Vérification du paiement.");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");

    // And a genuinely new event still lands, so what is being refused is the
    // repeated identity rather than the second delivery.
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
      eventId: "evt-another-identity",
    });
    await page.goto("/commande/retour");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
  });

  test("never unsays an approved payment with an event that arrives after it", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });

    // Out of order, which a provider retrying over a slow link really does.
    // It is acknowledged and recorded; it does not rewrite what was decided.
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.canceled",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
  });

  test("acknowledges an event it has no meaning for, and changes nothing", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);

    const body = JSON.stringify({
      id: "evt-unknown",
      name: "payout.completed",
      entity: { id: transaction },
    });
    // Acknowledged rather than refused: a provider that is told 400 retries
    // forever for an event this application will never care about.
    expect(await deliver(request, body)).toBe(200);

    await page.goto("/commande/retour");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
  });

  test("leaves a payment pending when the provider only says it started", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);

    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.created",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expectHeading(page, "Vérification du paiement.");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
  });

  test("acknowledges an event for a transaction it knows nothing about", async ({
    page,
    request,
  }) => {
    await payFor(page);

    expect(
      await deliverPaymentEvent(request, {
        transaction: "transaction-from-another-deployment",
        name: "transaction.approved",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
  });
});

test.describe("What the browser cannot claim", () => {
  test("cannot approve a payment from the address bar", async ({ page }) => {
    await payFor(page);

    await page.goto(
      "/commande/retour?status=approved&transaction_id=1&id=1&approved=true",
    );

    await expectHeading(page, "Vérification du paiement.");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
  });

  test("cannot unsay an approved payment from the address bar", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });

    await page.goto("/commande/retour?status=failed&cancelled=1");

    await expectHeading(page, "Paiement approuvé.");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
  });
});

test.describe("The order-state boundary", () => {
  test("answers the two states this browser's order is in, and nothing else", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await page.goto("/commande/retour");

    expect(await readOrderState(page)).toEqual({
      payment: "pending",
      fulfillment: "not_started",
    });

    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });

    expect(await readOrderState(page)).toEqual({
      payment: "approved",
      fulfillment: "delivered",
    });
  });

  test("tells a browser carrying no order nothing at all", async ({ page }) => {
    await page.goto("/commande/retour");

    expect(await readOrderState(page)).toEqual({
      payment: "unknown",
      fulfillment: "unknown",
    });
  });

  test("leaks no order, buyer or amount to whoever asks", async ({ page }) => {
    await payFor(page);
    await page.goto("/commande/retour");

    const { body, cacheControl } = await fetchOrderState(page);

    // Two states and nothing else. No reference, no email, no total, no
    // product: a status poll is not a way to read an order.
    expect(body).not.toContain("WC-");
    expect(body).not.toContain("exemple.test");
    expect(body).not.toContain("14000");
    expect(body).not.toContain(LUT.title);
    // Payment truth changes underneath this address by definition, so nothing
    // between here and the browser may keep an answer.
    expect(cacheControl).toContain("no-store");
  });
});

test.describe("The buyer waiting for confirmation", () => {
  test("sees the page follow the payment without being reloaded", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await page.goto("/commande/retour");

    await expectHeading(page, "Vérification du paiement.");
    await expect(page.getByTestId("payment-verification")).toBeVisible();
    await expect(page.getByTestId("checkout-stage")).toContainText(
      "Vous pouvez fermer cette page",
    );

    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });

    // The buyer did nothing: the page is polling, and it stops as soon as the
    // server has an answer.
    await expectHeading(page, "Paiement approuvé.");
    await expect(page.getByTestId("payment-verification")).toHaveCount(0);
  });

  test("finds the answer when they close the page and come back", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await page.goto("/commande/retour");
    // Issue #1: the buyer may close the page, and confirmation continues
    // without it.
    await page.goto("/boutique");

    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
  });

  test("is never told a dropped connection is a failed payment", async ({
    page,
    context,
    request,
  }) => {
    const transaction = await payFor(page);
    await page.goto("/commande/retour");
    await expect(page.getByTestId("payment-verification")).toBeVisible();

    await context.setOffline(true);
    // Say so, because a page that silently stops checking is worse than one
    // that says it will resume. What it must never do is call this a failure.
    await expect(page.getByTestId("payment-offline")).toBeVisible();
    await expectHeading(page, "Vérification du paiement.");
    await expect(paymentState(page)).toHaveText("En attente de confirmation");
    await expect(page.getByTestId("checkout-stage")).not.toContainText(
      "non abouti",
    );

    await context.setOffline(false);
    await expect(page.getByTestId("payment-offline")).toHaveCount(0);

    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });
    await expectHeading(page, "Paiement approuvé.");
  });
});
