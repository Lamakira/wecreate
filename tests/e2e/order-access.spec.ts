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
  EMAIL_FAILURE_ADDRESS,
  Outbox,
  PRIVATE_LINK_SECONDS,
  accessLink,
  accessRow,
  accessToken,
  expectPrivateLink,
  objectPathFor,
  pressDownload,
  storedCommerceData,
  tokenDigest,
} from "./support/order-access";
import {
  deliverPaymentEvent,
  readOrderState,
  transactionFromHostedPage,
} from "./support/payment-events";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * What an approved payment turns into: a durable grant, one receipt, and files
 * a buyer can open for thirty days without an account.
 *
 * Everything below drives the same running application a buyer drives. The
 * browser walks the checkout and leaves for the hosted page, the approval
 * arrives as a real signed POST to the real endpoint, the receipt is read out
 * of the buyer's inbox, and the emailed address is followed the way somebody
 * reading their mail follows one. Nothing here reaches inside the application:
 * the payment provider, the email provider and the private store are all faked
 * at WeCreate's own outbound boundaries.
 *
 * Two rules these scenarios exist to hold, and they pull in opposite
 * directions on purpose (ADR-0005):
 *
 * **Delivery never rewrites payment truth.** A receipt that could not be sent
 * and a file that could not be prepared leave the payment approved, the page
 * leading with *Paiement approuvé*, and no second payment anywhere on it.
 *
 * **One approval delivers once.** A redelivered webhook, a contradictory late
 * event and a retried request produce one set of grants and one receipt.
 */

const LUT = sampleProduct();

/** What the Commerce Operator uploads for it, and where those bytes end up. */
const DELIVERABLE_CONTENTS = `fichier livré pour ${LUT.sku}`;
const DELIVERABLE_PATH = objectPathFor(LUT.sku, DELIVERABLE_CONTENTS, ".zip");

/** What a buyer is told they have left before opening anything. */
const FULL_ALLOWANCE = "5 téléchargements sur 5 restants";

/** WeCreate's administrative address, as the shipped contact details give it. */
const SUPPORT_ADDRESS = "wecreate08@gmail.com";

/**
 * What was approved, written the way WeCreate writes a price. The separators
 * are U+00A0, spelled as escapes so a review can see which space this is.
 */
const APPROVED_TOTAL = "14\u00A0000\u00A0F";

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

/** A buyer who has paid, with the address the receipt went to. */
async function buyAndApprove(
  page: Page,
  request: Parameters<typeof deliverPaymentEvent>[0],
  email = "armande@exemple.test",
): Promise<{ email: string }> {
  await content.editDraft({
    legalDocuments: approvedLegalDocuments(),
    boutique: { products: [LUT] },
  });
  await content.publish();
  await putOnSale(page, [LUT.sku]);

  await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);
  await page.goto("/commande");
  await fillGuestDetails(page, { email });
  await page.getByTestId("checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

  const transaction = transactionFromHostedPage(page);
  expect(
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    }),
  ).toBe(200);

  return { email };
}

/** Open the buyer's files the way they do: out of the receipt. */
async function openAccess(page: Page, email: string): Promise<string> {
  const link = accessLink(await outbox.only(email));
  await page.goto(link);
  return link;
}

test.describe("The first approved payment", () => {
  test("grants access, sends one receipt, and says delivery is done", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    await expect(page.getByTestId("order-fulfillment")).toHaveText(
      "Livraison envoyée",
    );
    expect(await readOrderState(page)).toEqual({
      payment: "approved",
      fulfillment: "delivered",
    });

    // One row per Digital Product, with the two things a buyer needs to plan
    // around: until when, and how many times.
    const row = accessRow(page, LUT.sku);
    await expect(page.getByTestId("access-row")).toHaveCount(1);
    await expect(row.getByTestId("access-title")).toHaveText(LUT.title);
    await expect(row.getByTestId("access-allowance")).toHaveText(FULL_ALLOWANCE);
    await expect(row.getByTestId("access-expiry")).toContainText("2026");

    // Payment truth first, and no second payment on a settled surface.
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);

    const receipt = await outbox.only(email);
    expect(receipt.subject).toContain("Reçu");
    const reference = (await page.getByTestId("ticket-reference").innerText()).trim();
    expect(receipt.body).toContain(reference);
    // The approved amount, the support address, the access rules in words, and
    // the one address that opens the files.
    expect(receipt.body).toContain(APPROVED_TOTAL);
    expect(receipt.body).toContain(SUPPORT_ADDRESS);
    expect(receipt.body).toContain("30 jours");
    expect(receipt.body).toContain("5 téléchargements");
    expect(receipt.body).toContain("/commande/acces/");
    // A receipt and an order confirmation, and it says which it is not.
    expect(receipt.body).toContain("facture fiscale");
  });

  test("delivers once however many times the approval is redelivered", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);
    const first = await outbox.only(email);

    // The provider did not hear the first acknowledgement and tries again with
    // the same event identity, then sends a second approval of its own.
    await deliverPaymentEvent(request, {
      transaction: transactionFromHostedPage(page),
      name: "transaction.approved",
      eventId: "evt-repeated-approval",
    });
    await deliverPaymentEvent(request, {
      transaction: transactionFromHostedPage(page),
      name: "transaction.approved",
      eventId: "evt-repeated-approval",
    });

    const second = await outbox.only(email);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);

    await page.goto("/commande/retour");
    // One grant, with its allowance untouched: a second delivery is not a
    // second purchase.
    await expect(page.getByTestId("access-row")).toHaveCount(1);
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText(FULL_ALLOWANCE);
  });

  test("is not undone by a contradicting event that arrives after it", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);

    await deliverPaymentEvent(request, {
      transaction: transactionFromHostedPage(page),
      name: "transaction.canceled",
    });

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    await expect(page.getByTestId("order-fulfillment")).toHaveText(
      "Livraison envoyée",
    );
    await outbox.only(email);
  });
});

test.describe("When delivery fails", () => {
  test("leads with the approved payment and offers a way to be helped", async ({
    page,
    request,
  }) => {
    await buyAndApprove(page, request, EMAIL_FAILURE_ADDRESS);

    await page.goto("/commande/retour");

    // Payment truth is untouched by a delivery that did not work (ADR-0005).
    await expectHeading(page, "Paiement approuvé.");
    await expect(page.getByTestId("order-payment-state")).toHaveText(
      "Paiement approuvé",
    );
    await expect(page.getByTestId("order-fulfillment")).toHaveText(
      "Livraison à reprendre",
    );

    // Never a second payment, and never a dead end.
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);
    const recovery = page.getByTestId("fulfillment-recovery");
    await expect(recovery).toBeVisible();
    await expect(recovery).toContainText(SUPPORT_ADDRESS);

    // The grant was made before the receipt was attempted, so what the buyer
    // owns is on the page even though the message never left.
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText(FULL_ALLOWANCE);
    expect(await outbox.messages()).toHaveLength(0);
  });
});

test.describe("Order Access", () => {
  test("opens the buyer's files from the address in the receipt", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);
    const link = await openAccess(page, email);

    await expectHeading(page, "Vos fichiers.");
    const row = accessRow(page, LUT.sku);
    await expect(row.getByTestId("access-title")).toHaveText(LUT.title);
    await expect(row.getByTestId("access-allowance")).toHaveText(FULL_ALLOWANCE);

    // The token is spent on arrival: what the buyer is now looking at, and
    // might copy or share, does not carry it.
    expect(new URL(page.url()).pathname).toBe("/commande/acces");
    expect(await page.content()).not.toContain(
      new URL(link).pathname.split("/").pop(),
    );
  });

  test("is kept as a digest and never as the token itself", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);
    const token = accessToken(accessLink(await outbox.only(email)));

    // The durable outcome, read out of the data plane's own storage: what a
    // leak of it would give somebody. The digest is there, so access can still
    // be found; the credential is not, anywhere, in any form.
    const stored = await storedCommerceData();
    expect(stored).toContain(tokenDigest(token));
    expect(stored).not.toContain(token);

    // And it is genuinely the credential — the same one still opens the order.
    await page.goto(`/commande/acces/${token}`);
    await expectHeading(page, "Vos fichiers.");
  });

  test("stays out of search results", async ({ page, request }) => {
    const { email } = await buyAndApprove(page, request);
    await openAccess(page, email);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("hands a temporary private address for the version that was bought", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);
    await openAccess(page, email);

    const handed = await pressDownload(page, LUT.sku);

    // Somewhere else entirely, naming the immutable version this order
    // recorded, and stopping fifteen minutes from now.
    expectPrivateLink(handed, { objectPath: DELIVERABLE_PATH });
  });

  test("counts a file that was handed over, not a button that was pressed", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);
    await openAccess(page, email);
    const allowance = accessRow(page, LUT.sku).getByTestId("access-allowance");

    await pressDownload(page, LUT.sku);
    await page.goto("/commande/acces");
    await expect(allowance).toHaveText("4 téléchargements sur 5 restants");

    // Asking again while the address is still good is the same download, not
    // another one: a buyer who lost the tab has not lost part of what they paid
    // for.
    await pressDownload(page, LUT.sku);
    await page.goto("/commande/acces");
    await expect(allowance).toHaveText("4 téléchargements sur 5 restants");

    // Once it has expired, the next one is genuinely another download.
    await commerce.age(PRIVATE_LINK_SECONDS + 60);
    await pressDownload(page, LUT.sku);
    await page.goto("/commande/acces");
    await expect(allowance).toHaveText("3 téléchargements sur 5 restants");
  });

  test("refuses a sixth download and still says what is left", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);
    await openAccess(page, email);

    for (let taken = 0; taken < 5; taken += 1) {
      await pressDownload(page, LUT.sku);
      await commerce.age(PRIVATE_LINK_SECONDS + 60);
      await page.goto("/commande/acces");
    }
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText("0 téléchargement sur 5 restant");

    // No address at all: the buyer is back on WeCreate, and told why.
    expect(await pressDownload(page, LUT.sku)).not.toContain("stockage");
    await expect(page.getByTestId("access-problem")).toBeVisible();
  });

  test("refuses a product this order did not buy", async ({ page, request }) => {
    const { email } = await buyAndApprove(page, request);
    await openAccess(page, email);

    // The same browser and the same access, asking for a product nobody bought
    // under it — the one thing a buyer can change about that submission is the
    // field naming the product, so that is what is changed. Sent from inside
    // the page, because the access cookie is this browser's and the question is
    // precisely what *this browser* may have.
    const landed = await page.evaluate(async () => {
      const answer = await fetch("/commande/acces/telechargement", {
        method: "POST",
        body: new URLSearchParams({ sku: "EBK-01" }),
      });
      return answer.url;
    });
    expect(landed).not.toContain("stockage");

    await page.goto(landed);
    await expect(page.getByTestId("access-problem")).toContainText(
      "ne fait pas partie de cette commande",
    );
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText(FULL_ALLOWANCE);
  });

  test("says nothing at all to a token that is not one of ours", async ({
    page,
    request,
  }) => {
    await buyAndApprove(page, request);

    await page.goto("/commande/acces/nsAaqLxG1oPnyaHtOfW3nyEyDMkTRqp_9nmM7ilFNW4");

    await expectHeading(page, "Accès expiré ou introuvable.");
    expect(await page.content()).not.toContain(LUT.title);
  });

  test("stops working thirty days after the payment was approved", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);
    const link = accessLink(await outbox.only(email));

    await commerce.age(31 * 24 * 60 * 60);
    await page.goto(link);

    await expectHeading(page, "Accès expiré ou introuvable.");
    expect(await page.content()).not.toContain(LUT.title);
  });

  test("survives the product being archived after the purchase", async ({
    page,
    request,
  }) => {
    const { email } = await buyAndApprove(page, request);

    // Withdrawn from sale, and still identifiable in the order that bought it
    // and in the grant that opens it — CONTEXT.md says so in as many words, and
    // user story 71 asks for it.
    //
    // Issue #12 also lists archived products among the things that "never
    // disclose the Paid Deliverable", and the two are not in tension: a grant
    // hangs off an order line and the version that line recorded, so archiving
    // a product cannot be turned into a way to reach a file nobody bought. What
    // it must not do is take back one somebody did.
    await content.editDraft({
      boutique: { products: [sampleProduct({ isArchived: true })] },
    });
    await content.publish();

    await openAccess(page, email);
    await expect(accessRow(page, LUT.sku).getByTestId("access-title")).toHaveText(
      LUT.title,
    );
    expectPrivateLink(await pressDownload(page, LUT.sku), {
      objectPath: DELIVERABLE_PATH,
    });
  });
});
