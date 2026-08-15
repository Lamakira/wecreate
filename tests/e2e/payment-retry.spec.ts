import { expect, test, type Page } from "@playwright/test";

import {
  FEDAPAY_HOSTED_ORIGIN,
  PROVIDER_FAILURE_EMAIL,
  expectHeading,
  fillGuestDetails,
  interceptHostedPayment,
  onScreen,
  submitCheckout,
  ticketReference,
} from "./support/checkout";
import {
  CommerceDataPlane,
  activateVersion,
  deliverablePanel,
  putOnSale,
  uploadDeliverable,
} from "./support/commerce";
import { arriveWithCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import {
  Outbox,
  accessLink,
  expectPrivateLink,
  objectPathFor,
  pressDownload,
} from "./support/order-access";
import {
  deliverPaymentEvent,
  readOrderState,
  transactionFromHostedPage,
} from "./support/payment-events";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * Paying again for an order FedaPay refused.
 *
 * A payment that failed or was cancelled is not the end of an order: for
 * twenty-four hours the buyer may try again against the *same* Order Snapshot —
 * the same products, the same prices, the same Paid Deliverable Versions and the
 * same Legal Revisions they accepted — and after that they start again at
 * whatever WeCreate is publishing today (issue #13).
 *
 * Two things the scenarios below exist to hold apart, because getting either
 * wrong charges somebody twice:
 *
 * - **A retry is another attempt, never another order.** The reference does not
 *   move, the prices do not move, and nothing the retry does to the Payment
 *   State happens before a verified webhook says so.
 * - **A payment already in flight suppresses the retry entirely.** Coming back
 *   to the page, reloading it, losing the connection and polling for a
 *   confirmation are all reads: none of them may open a transaction.
 *
 * Time is the fixture data plane's controlled clock, as everywhere else in this
 * suite: the twenty-four hours cannot be waited out, so what is aged is the
 * stored data and what is asserted is still what the application concludes.
 */

const LUT = sampleProduct();

/** One second inside the twenty-four hours an Order Snapshot is priced for. */
const ALMOST_A_DAY = 24 * 60 * 60 - 1;

/** The address the receipt goes to, when a scenario opens what it bought. */
const BUYER_EMAIL = "armand@exemple.test";

/** What `putOnSale()` uploads as version 1, and what this order therefore buys. */
const BOUGHT_FILE = `fichier livré pour ${LUT.sku}`;

let content: ManagedContent;
let commerce: CommerceDataPlane;
let outbox: Outbox;

test.beforeEach(async ({ page, request }) => {
  content = new ManagedContent(request);
  commerce = new CommerceDataPlane(request);
  outbox = new Outbox(request);
  await content.reset();
  await commerce.reset();
  await outbox.reset();
  await interceptHostedPayment(page);
});

test.afterEach(async () => {
  await content.reset();
  await commerce.reset();
  await outbox.reset();
});

/** Put the LUT on sale, both halves of it, and stand a shopper at the checkout. */
async function arriveAtCheckout(page: Page): Promise<void> {
  await content.editDraft({
    legalDocuments: approvedLegalDocuments(),
    boutique: { products: [LUT] },
  });
  await content.publish();
  await putOnSale(page, [LUT.sku]);

  await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);
  await page.goto("/commande");
}

/**
 * Go through the checkout and leave for the hosted page, as a buyer does.
 *
 * Answers with the transaction identity a webhook would name, read out of the
 * fixture's own address rather than out of the application's storage.
 */
async function payFor(page: Page): Promise<string> {
  await arriveAtCheckout(page);
  await fillGuestDetails(page, { email: BUYER_EMAIL });
  await page.getByTestId("checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

  return transactionFromHostedPage(page);
}

/**
 * Follow *Reprendre le paiement* and wait for the checkout to be on screen.
 *
 * The address bar changes before the page does — Next.js keeps the page being
 * left mounted until the next one is ready — so the guest form is what says the
 * buyer has arrived, rather than the URL.
 */
async function followRetry(page: Page): Promise<void> {
  await onScreen(page, "payment-retry").click();
  await page.waitForURL(/\/commande$/);
  await expect(onScreen(page, "guest-form")).toBeVisible();
}

/** Start again from the return page, and answer the provider's page again. */
async function retryFromReturnPage(page: Page): Promise<string> {
  await followRetry(page);

  await fillGuestDetails(page, { email: BUYER_EMAIL });
  await onScreen(page, "checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

  return transactionFromHostedPage(page);
}

function paymentState(page: Page) {
  return page.getByTestId("order-payment-state");
}

test.describe("A payment FedaPay refused", () => {
  test("is offered again against the same order, at the price it recorded", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement non abouti.");
    const reference = await ticketReference(page);

    // WeCreate reprices the product while the buyer is deciding. The Order
    // Snapshot keeps what it recorded: that is the whole of what the
    // twenty-four hours are for.
    await content.editDraft({
      boutique: { products: [sampleProduct({ priceXof: 18000 })] },
    });
    await content.publish();

    const second = await retryFromReturnPage(page);

    expect(second).not.toBe(first);
    const hosted = new URL(page.url());
    expect(hosted.searchParams.get("reference")).toBe(reference);
    expect(hosted.searchParams.get("amount")).toBe("14000");
  });

  test("says on the checkout that continuing is the same order", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    const reference = await ticketReference(page);

    await followRetry(page);

    expect(await ticketReference(page)).toBe(reference);
    await expect(onScreen(page, "checkout-resuming")).toContainText(
      "ne crée pas de seconde commande",
    );
    // The terms this order recorded are the ones it keeps: a retry does not ask
    // for an acceptance again, and could not change the ones it was created
    // under if it did.
    await expect(onScreen(page, "legal-acceptance")).toHaveCount(0);
    await expect(onScreen(page, "checkout-submit")).toContainText("14 000 F");
  });

  test("changes no Payment State until a verified event says so", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    const second = await retryFromReturnPage(page);

    await page.goto("/commande/retour");
    // A transaction is open with the provider and nothing has confirmed it, so
    // the page leads with the verification rather than with the refusal it is
    // still recording.
    await expectHeading(page, "Vérification du paiement.");
    await expect(paymentState(page)).toHaveText("Paiement non abouti");
    await expect(page.getByTestId("payment-retry")).toHaveCount(0);
    expect((await readOrderState(page)).payment).toBe("failed");

    await deliverPaymentEvent(request, {
      transaction: second,
      name: "transaction.approved",
    });

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
  });

  test("takes a second refusal and offers the order again", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    const reference = await ticketReference(page);
    const second = await retryFromReturnPage(page);
    await deliverPaymentEvent(request, {
      transaction: second,
      name: "transaction.canceled",
    });

    await page.goto("/commande/retour");
    // The refusal already recorded stands: only an approval replaces a Payment
    // State that has one, so a second attempt that did not succeed cannot
    // rewrite what the first said. Both mean the same thing to the buyer, and
    // the order is offered again either way.
    await expectHeading(page, "Paiement non abouti.");
    await expect(page.getByTestId("payment-retry")).toBeVisible();

    const third = await retryFromReturnPage(page);
    expect(new Set([first, second, third]).size).toBe(3);
    expect(new URL(page.url()).searchParams.get("reference")).toBe(reference);

    await deliverPaymentEvent(request, {
      transaction: third,
      name: "transaction.approved",
    });
    await page.goto("/commande/retour");
    await expect(paymentState(page)).toHaveText("Paiement approuvé");
  });

  test("tells the page a relaunched payment was refused, without a reload", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    const second = await retryFromReturnPage(page);
    await page.goto("/commande/retour");
    await expect(page.getByTestId("payment-verification")).toBeVisible();

    // FedaPay refuses the second attempt too. The Payment State it lands on is
    // the one already recorded, so nothing about it *changes* — and the page
    // has to settle anyway, or a buyer sits watching *Vérification du paiement*
    // over a payment that was refused minutes ago.
    await deliverPaymentEvent(request, {
      transaction: second,
      name: "transaction.declined",
    });

    await expect(onScreen(page, "checkout-heading")).toHaveText(
      "Paiement non abouti.",
      { timeout: 30_000 },
    );
    await expect(onScreen(page, "payment-retry")).toBeVisible();
  });

  test("delivers the version the order recorded, not the one now on sale", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    // WeCreate replaces the product's file between the two attempts. A Paid
    // Deliverable Version is never edited, so this is version 2 — and the Order
    // Snapshot recorded version 1 when it was created. The Commerce Operator is
    // still signed in from putting the product on sale.
    await page.goto("/commerce");
    await uploadDeliverable(page, {
      sku: LUT.sku,
      fileName: "lut-04-v2.zip",
      contents: "fichier remplacé après la commande",
      mimeType: "application/zip",
    });
    // Reloaded rather than waited on: an upload started from a freshly loaded
    // back office stores the version but does not repaint the panel, and what
    // this scenario is about is which version the order delivers.
    await page.reload();
    await expect(
      deliverablePanel(page, LUT.sku).getByTestId("version"),
    ).toHaveCount(2);
    await activateVersion(page, LUT.sku, 2);

    await page.goto("/commande/retour");
    const second = await retryFromReturnPage(page);
    await deliverPaymentEvent(request, {
      transaction: second,
      name: "transaction.approved",
    });

    // What the buyer opens from the address in their receipt is what they
    // bought, which is the file the order recorded rather than the file on sale
    // the day they finally paid for it.
    await page.goto(accessLink(await outbox.only(BUYER_EMAIL)));
    expectPrivateLink(await pressDownload(page, LUT.sku), {
      objectPath: objectPathFor(LUT.sku, BOUGHT_FILE, ".zip"),
    });
  });

  test("is not a trap for a buyer who would rather buy something else", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    await followRetry(page);

    // Leaving the order gives the checkout back. The order itself stays
    // recorded under its reference.
    await onScreen(page, "order-abandon").click();
    await expectHeading(page, "Où devons-nous livrer vos fichiers ?");
    await expect(onScreen(page, "checkout-resuming")).toHaveCount(0);
  });
});

test.describe("What suppresses the retry", () => {
  test("a payment still being verified", async ({ page }) => {
    await payFor(page);

    await page.goto("/commande/retour");
    await expectHeading(page, "Vérification du paiement.");
    await expect(page.getByTestId("payment-retry")).toHaveCount(0);

    await page.goto("/commande");
    await expectHeading(page, "Un paiement est déjà en cours.");
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);
  });

  test("a payment FedaPay approved", async ({ page, request }) => {
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    await expect(page.getByTestId("payment-retry")).toHaveCount(0);

    // And nothing on the checkout re-opens it either: an approved Order
    // Snapshot is finished with, whatever this browser is still carrying.
    await page.goto("/commande");
    await expect(page.getByTestId("checkout-resuming")).toHaveCount(0);
  });

  test("watching the page, losing the connection and coming back", async ({
    page,
    context,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    const second = await retryFromReturnPage(page);

    await page.goto("/commande/retour");
    await expect(page.getByTestId("payment-verification")).toBeVisible();

    // Everything the browser does from here is a read. Nothing on this page may
    // open a transaction, however long it is watched or however badly the
    // connection behaves — so no Server Function is invoked and the provider's
    // hosted page is never reached.
    const acted: string[] = [];
    page.on("request", (sent) => {
      const invokesAnAction = Boolean(sent.headers()["next-action"]);
      if (invokesAnAction || sent.url().startsWith(FEDAPAY_HOSTED_ORIGIN)) {
        acted.push(`${sent.method()} ${sent.url()}`);
      }
    });

    await context.setOffline(true);
    await expect(page.getByTestId("payment-offline")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByTestId("payment-offline")).toHaveCount(0);

    // The confirmation arrives while the buyer is looking at the page, and the
    // page settles on its own rather than being reloaded.
    await deliverPaymentEvent(request, {
      transaction: second,
      name: "transaction.approved",
    });
    await expect(page.getByTestId("checkout-heading")).toHaveText(
      "Paiement approuvé.",
      { timeout: 30_000 },
    );

    expect(acted).toEqual([]);
  });
});

test.describe("When the twenty-four hours are up", () => {
  test("the order is retryable up to the boundary and not past it", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.declined",
    });

    await commerce.age(ALMOST_A_DAY);
    await page.goto("/commande/retour");
    await expect(page.getByTestId("payment-retry")).toBeVisible();

    await commerce.age(1);
    await page.goto("/commande/retour");
    await expect(page.getByTestId("payment-retry")).toHaveCount(0);
    await expect(page.getByTestId("payment-next-step")).toContainText(
      "boutique",
    );
  });

  test("the buyer starts again from what WeCreate publishes today", async ({
    page,
    request,
  }) => {
    const transaction = await payFor(page);
    // Read from the address WeCreate handed the provider rather than from a
    // page of ours, so this scenario can publish while the browser is sitting
    // on the hosted page and nothing of ours is being fetched behind it.
    const abandoned = new URL(page.url()).searchParams.get("reference");
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.declined",
    });

    // The price moved while the order sat there, and the order is now past the
    // window that held it. What the buyer accepted a day ago is no longer what
    // WeCreate sells.
    await content.editDraft({
      boutique: { products: [sampleProduct({ priceXof: 18000 })] },
    });
    await content.publish();
    await commerce.age(ALMOST_A_DAY + 1);

    await page.goto("/commande");
    await expectHeading(page, "Votre panier demande une vérification.");
    await expect(onScreen(page, "checkout-blocker")).toHaveText(
      "Acceptez les nouveaux prix pour continuer.",
    );

    await arriveWithCart(page, [[LUT.id, 18000]]);
    await page.goto("/commande");
    await expect(onScreen(page, "checkout-resuming")).toHaveCount(0);
    await fillGuestDetails(page);
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    const hosted = new URL(page.url());
    expect(hosted.searchParams.get("amount")).toBe("18000");
    expect(hosted.searchParams.get("reference")).not.toBe(abandoned);
  });
});

test.describe("When FedaPay cannot be reached on the retry", () => {
  test("stays diagnosable, and is safe to press again", async ({
    page,
    request,
  }) => {
    const first = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction: first,
      name: "transaction.declined",
    });

    await page.goto("/commande/retour");
    const reference = await ticketReference(page);
    await followRetry(page);

    await fillGuestDetails(page, { email: PROVIDER_FAILURE_EMAIL });
    await submitCheckout(page);

    await expect(onScreen(page, "checkout-errors")).toContainText(
      "rien n'a été débité",
    );
    expect(await ticketReference(page)).toBe(reference);

    // Pressing again pays the same order rather than making a second one, and
    // the attempt that did reach the provider is not repeated.
    await fillGuestDetails(page);
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    const hosted = new URL(page.url());
    expect(hosted.searchParams.get("reference")).toBe(reference);
    expect(transactionFromHostedPage(page)).not.toBe(first);
  });
});
