import { expect, test, type Page } from "@playwright/test";

import {
  FEDAPAY_HOSTED_ORIGIN,
  PROVIDER_FAILURE_EMAIL,
  expectHeading,
  fillGuestDetails,
  interceptHostedPayment,
  onScreen,
  submitCheckout,
} from "./support/checkout";
import {
  CommerceDataPlane,
  openDossier,
  putOnSale,
} from "./support/commerce";
import { arriveWithCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import { Observation } from "./support/observation";
import {
  Outbox,
  accessLink,
  accessRow,
  expectPrivateLink,
  objectPathFor,
  pressDownload,
} from "./support/order-access";
import {
  deliverPaymentEvent,
  transactionFromHostedPage,
} from "./support/payment-events";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * Critical transaction journeys, run on Firefox and WebKit as well as Chromium.
 *
 * The rest of the commerce suite stays on the Chromium pair. These walks are
 * the cross-browser matrix issue #1 asks for at acceptable cost: checkout
 * validation, Variant C payment states, a retry, Order Access, a download,
 * staff support, and a provider that cannot be reached. Real Mobile Safari
 * and a physical Android remain a manual pass.
 */

const LUT = sampleProduct();
const BUYER_EMAIL = "armand@exemple.test";
const DELIVERABLE_PATH = objectPathFor(
  LUT.sku,
  `fichier livré pour ${LUT.sku}`,
  ".zip",
);

let content: ManagedContent;
let commerce: CommerceDataPlane;
let outbox: Outbox;
let observation: Observation;

test.beforeEach(async ({ page, request }) => {
  content = new ManagedContent(request);
  commerce = new CommerceDataPlane(request);
  outbox = new Outbox(request);
  observation = new Observation(request);
  await observation.reset();
  await content.reset();
  await commerce.reset();
  await outbox.reset();
  await interceptHostedPayment(page);
});

test.afterEach(async () => {
  await observation?.reset();
  await content?.reset();
  await commerce?.reset();
  await outbox?.reset();
});

async function sell(page: Page): Promise<void> {
  await content.editDraft({
    legalDocuments: approvedLegalDocuments(),
    boutique: { products: [LUT] },
  });
  await content.publish();
  await putOnSale(page, [LUT.sku]);
}

async function arriveAtCheckout(page: Page): Promise<void> {
  await sell(page);
  await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);
  await page.goto("/commande");
}

test.describe("Transaction journeys", () => {
  test("validates the guest form from the server", async ({ page }) => {
    test.setTimeout(90_000);
    await arriveAtCheckout(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("Nom complet")).toBeVisible();
    await expect(page.getByLabel("Email de livraison")).toBeVisible();

    await submitCheckout(page);
    await expect(page.getByTestId("checkout-errors")).toBeVisible();
    await expect(page.getByTestId("error-fullName")).toBeVisible();
    await expect(page.getByTestId("error-email")).toBeVisible();
    await expect(page.getByTestId("error-telephone")).toBeVisible();
    await expect(page.getByTestId("error-legal")).toBeVisible();
    await expect(page).toHaveURL(/\/commande$/);
  });

  test("retries a refused payment, then opens the files and the dossier", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await arriveAtCheckout(page);
    await fillGuestDetails(page, { email: BUYER_EMAIL });
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    const first = transactionFromHostedPage(page);
    expect(
      await deliverPaymentEvent(request, {
        transaction: first,
        name: "transaction.declined",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement non abouti.");
    await expect(onScreen(page, "payment-retry")).toBeVisible();

    await onScreen(page, "payment-retry").click();
    await page.waitForURL(/\/commande$/);
    await fillGuestDetails(page, { email: BUYER_EMAIL });
    await onScreen(page, "checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    const second = transactionFromHostedPage(page);
    expect(second).not.toBe(first);
    expect(
      await deliverPaymentEvent(request, {
        transaction: second,
        name: "transaction.approved",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    const reference = (
      await page.getByTestId("ticket-reference").innerText()
    ).trim();

    const link = accessLink(await outbox.only(BUYER_EMAIL));
    await page.goto(link);
    await expect(accessRow(page, LUT.sku)).toBeVisible();
    const handed = await pressDownload(page, LUT.sku);
    expectPrivateLink(handed, { objectPath: DELIVERABLE_PATH });

    await openDossier(page, reference);
    await expect(page.getByTestId("buyer-email")).toHaveText(BUYER_EMAIL);
    await expect(page.getByTestId("dossier-payment")).toHaveAttribute(
      "data-state",
      "approved",
    );
  });

  test("keeps the order when the payment page cannot be opened", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await arriveAtCheckout(page);
    await fillGuestDetails(page, { email: PROVIDER_FAILURE_EMAIL });
    await submitCheckout(page);

    await expect(page.getByTestId("checkout-errors")).toContainText(
      "rien n'a été débité",
    );
    await expect(page.getByTestId("checkout-resuming")).toBeVisible();
  });
});
