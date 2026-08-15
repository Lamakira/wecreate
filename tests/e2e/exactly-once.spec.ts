import { expect, test, type Page } from "@playwright/test";

import { BASE_URL } from "../../playwright.config";
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
  Outbox,
  PRIVATE_LINK_SECONDS,
  accessLink,
  accessRow,
  accessToken,
  pressTogether,
  storedCommerce,
  storedCommerceData,
} from "./support/order-access";
import {
  deliverPaymentEvent,
  readOrderState,
  transactionFromHostedPage,
} from "./support/payment-events";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * What survives when the webhooks double, the events arrive backwards, the mail
 * provider stops answering and two requests race each other.
 *
 * Everything else about this journey is already under test — `payment-webhook`
 * for what a verified event may decide, `payment-retry` for a second attempt,
 * `order-access` for what an approval turns into. What is here is the ticket
 * those three leave behind: that each of them stays true when the failure is
 * not the tidy one. Issue #14 asks for the events to be raced, duplicated and
 * reordered deliberately, and for email, storage and connectivity faults to be
 * injected while the observable outcome is asserted to be exactly once.
 *
 * Three claims run through all of it, and they are in tension on purpose:
 *
 * **Payment truth never moves backwards.** No delivery, no receipt, no store
 * and no repeated webhook may unsay that a buyer paid (ADR-0005, ADR-0009).
 *
 * **A delivery happens once, and is finished rather than abandoned.** A claim
 * two callers cannot both win is what makes the first true; a claim that can be
 * taken up again once it is over is what makes the second (ADR-0010).
 *
 * **What could not be decided automatically is written down.** A second
 * transaction approving one order, an event contradicting a decided payment and
 * a delivery that failed are recorded for the Commerce Operator view issue #15
 * builds — with the provider's own identifiers on them and nothing of the buyer.
 */

const LUT = sampleProduct();

/**
 * A second Digital Product, so at least one scenario buys an order with more
 * than one line.
 *
 * A delivery reaches `delivered` only once *every* grant it owes is durable,
 * and an order with one line cannot tell "all of them" from "the one". The
 * resumed delivery below is where that matters: it has to find both grants
 * exactly as the buyer left them rather than making a second pair.
 */
const EBOOK = sampleProduct({
  id: "ebk-02",
  sku: "EBK-02",
  family: "ebooks",
  slug: "cadrer-en-lumiere-dure",
  title: "Cadrer en lumière dure",
  priceXof: 9000,
});

/** What a buyer is told they have left before opening anything. */
const FULL_ALLOWANCE = "5 téléchargements sur 5 restants";

/** How long the fixture mail provider is asked to hold a request open. */
const STALL_SECONDS = 12;

/**
 * How long a claimed delivery may go unfinished before another caller may take
 * it up. `FULFILLMENT_STALL_SECONDS` in `src/commerce/order-access.ts`, and the
 * scenario below ages past it rather than waiting it out.
 */
const STALLED_CLAIM_SECONDS = 15 * 60;

let content: ManagedContent;
let commerce: CommerceDataPlane;
let outbox: Outbox;

test.beforeEach(async ({ page, request }) => {
  content = new ManagedContent(request);
  commerce = new CommerceDataPlane(request);
  outbox = new Outbox(request);
  await content.reset();
  await commerce.reset();
  // Which also brings the mail provider back, whatever the last scenario did
  // to it.
  await outbox.reset();
  await interceptHostedPayment(page);
});

test.afterEach(async () => {
  await content.reset();
  await commerce.reset();
  await outbox.reset();
});

/** A buyer who has reached the hosted page, with the transaction FedaPay opened. */
async function buyAndLeave(
  page: Page,
  options: { email?: string; buying?: (typeof LUT)[] } = {},
): Promise<{ email: string; transaction: string }> {
  const { email = "armande@exemple.test", buying = [LUT] } = options;

  await content.editDraft({
    legalDocuments: approvedLegalDocuments(),
    boutique: { products: buying },
  });
  await content.publish();
  await putOnSale(
    page,
    buying.map((product) => product.sku),
  );

  await arriveWithCart(
    page,
    buying.map((product) => [product.id, product.priceXof] as const),
  );
  await page.goto("/commande");
  await fillGuestDetails(page, { email });
  await page.getByTestId("checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

  return { email, transaction: transactionFromHostedPage(page) };
}

/** The one order this scenario created, as the data plane holds it. */
async function onlyStoredOrder() {
  const stored = await storedCommerce();
  expect(stored.orders, "one order was created").toHaveLength(1);
  return stored;
}

test.describe("Two approvals arriving at once", () => {
  test("make one approved transition, one grant set and one receipt", async ({
    page,
    request,
  }) => {
    const { email, transaction } = await buyAndLeave(page);

    // The provider's own retry, overlapping its first delivery: two separate
    // events about one transaction, in flight together. Neither is a duplicate
    // of the other by identity, so nothing but the data plane's own locking
    // stands between this and two deliveries.
    const answers = await Promise.all([
      deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId: "evt-race-one",
      }),
      deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId: "evt-race-two",
      }),
    ]);
    expect(answers).toEqual([200, 200]);

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    expect(await readOrderState(page)).toEqual({
      payment: "approved",
      fulfillment: "delivered",
      awaiting: false,
    });

    // One message in the buyer's inbox, and one row on their page.
    await outbox.only(email);
    await expect(page.getByTestId("access-row")).toHaveCount(1);
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText(FULL_ALLOWANCE);

    // And one of everything underneath it. Both events are kept — evidence is
    // never dropped — but only one of them decided anything, and the delivery
    // they share was claimed once.
    const stored = await onlyStoredOrder();
    expect(stored.paymentEvents).toHaveLength(2);
    expect(
      stored.paymentEvents.filter((event) => event.effect === "applied"),
    ).toHaveLength(1);
    expect(stored.grants).toHaveLength(1);
    expect(stored.grants[0].downloadsUsed).toBe(0);
    expect(stored.access).toHaveLength(1);
    expect(stored.anomalies).toHaveLength(0);
  });
});

test.describe("Events that arrive backwards", () => {
  test("keep every piece of evidence and never regress the approval", async ({
    page,
    request,
  }) => {
    const { email, transaction } = await buyAndLeave(page);

    // Announced, approved, and then two verdicts the provider should never have
    // sent after an approval — which is exactly when they have to be harmless.
    for (const [eventId, name] of [
      ["evt-created", "transaction.created"],
      ["evt-approved", "transaction.approved"],
      ["evt-declined", "transaction.declined"],
      ["evt-cancelled", "transaction.canceled"],
    ] as const) {
      expect(
        await deliverPaymentEvent(request, { transaction, name, eventId }),
      ).toBe(200);
    }

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    await expect(page.getByTestId("order-payment-state")).toHaveText(
      "Paiement approuvé",
    );
    await expect(page.getByTestId("order-fulfillment")).toHaveText(
      "Livraison envoyée",
    );
    await outbox.only(email);

    // All four are in the trail, each carrying what it was allowed to do. An
    // event that would have unsaid the payment is kept and did nothing.
    const stored = await onlyStoredOrder();
    expect(
      stored.paymentEvents.map((event) => [event.providerEventId, event.effect]),
    ).toEqual([
      ["evt-created", "unchanged"],
      ["evt-approved", "applied"],
      ["evt-declined", "superseded"],
      ["evt-cancelled", "superseded"],
    ]);

    // Two of them contradicted a payment that was already decided, and a person
    // is meant to look at that rather than the application guessing.
    expect(
      stored.anomalies.filter((one) => one.kind === "contradictory_event"),
    ).toHaveLength(2);
  });
});

test.describe("A second transaction approving one order", () => {
  test("is flagged for a person rather than delivered again", async ({
    page,
    request,
  }) => {
    const { email, transaction: first } = await buyAndLeave(page);

    // FedaPay refuses the first attempt, so the buyer pays again against the
    // same Order Snapshot (issue #13) and that one is approved.
    expect(
      await deliverPaymentEvent(request, {
        transaction: first,
        name: "transaction.declined",
        eventId: "evt-first-declined",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await page.getByTestId("payment-retry").click();
    await fillGuestDetails(page, { email });
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);
    const second = transactionFromHostedPage(page);
    expect(second).not.toBe(first);

    expect(
      await deliverPaymentEvent(request, {
        transaction: second,
        name: "transaction.approved",
        eventId: "evt-second-approved",
      }),
    ).toBe(200);

    // And then the first transaction is approved after all: the buyer was
    // charged twice, and only a person can put that right.
    expect(
      await deliverPaymentEvent(request, {
        transaction: first,
        name: "transaction.approved",
        eventId: "evt-first-approved-late",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    await expect(page.getByTestId("order-fulfillment")).toHaveText(
      "Livraison envoyée",
    );

    // Nothing was delivered twice: one receipt, one grant, one allowance.
    await outbox.only(email);
    await expect(page.getByTestId("access-row")).toHaveCount(1);
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText(FULL_ALLOWANCE);

    const stored = await onlyStoredOrder();
    expect(stored.grants).toHaveLength(1);
    expect(stored.access).toHaveLength(1);

    // What a Commerce Operator will be handed: which order, which transaction,
    // which delivery — enough to find the payment in FedaPay's own dashboard
    // and refund it.
    const flagged = stored.anomalies.filter(
      (one) => one.kind === "duplicate_payment",
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0].orderReference).toBe(stored.orders[0].reference);
    expect(flagged[0].providerTransactionId).toBe(first);
    expect(flagged[0].providerEventId).toBe("evt-first-approved-late");
    expect(flagged[0].resolvedAt).toBeNull();
  });

  test("writes down the provider's identifiers and nothing of the buyer", async ({
    page,
    request,
  }) => {
    const { transaction } = await buyAndLeave(page, {
      email: "confidentielle@exemple.test",
    });
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId: "evt-approved",
      }),
    ).toBe(200);
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.canceled",
        eventId: "evt-cancelled-after",
      }),
    ).toBe(200);

    const stored = await onlyStoredOrder();
    expect(stored.anomalies.length).toBeGreaterThan(0);

    // What is written down about a verified event is the provider's own
    // identifiers and nothing it sent: there is no room here for a payload, so
    // the reason a delivery failed is the only prose any of them ever carries.
    for (const one of stored.anomalies) {
      expect(one.orderReference).toBe(stored.orders[0].reference);
      expect(one.detail === null || one.detail.length < 200).toBe(true);
      expect(one.detail ?? "").not.toContain("{");
    }

    // And nothing sensitive reached storage as ordinary metadata: no buyer
    // details on an anomaly, and no raw delivery anywhere.
    const raw = JSON.stringify(stored.anomalies);
    expect(raw).not.toContain("confidentielle@exemple.test");
    expect(raw).not.toContain("+229");
    expect(await storedCommerceData()).not.toContain("v1/transaction");
  });
});

test.describe("When the mail provider stops answering", () => {
  test("the delivery is taken up again and finishes", async ({
    page,
    request,
  }) => {
    // Two products, so "every grant this order owes" is a claim with something
    // to be wrong about: a resumed delivery has to find both exactly as the
    // buyer left them rather than making a second pair.
    await outbox.outage("refuse");
    const { email, transaction } = await buyAndLeave(page, {
      buying: [LUT, EBOOK],
    });

    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId: "evt-approved",
      }),
    ).toBe(200);

    // Payment truth is untouched by a delivery that did not work, and what the
    // buyer owns was granted before the message was ever attempted.
    await page.goto("/commande/retour");
    await expectHeading(page, "Paiement approuvé.");
    expect(await readOrderState(page)).toEqual({
      payment: "approved",
      fulfillment: "failed",
      awaiting: false,
    });
    expect(await outbox.messages()).toHaveLength(0);
    await expect(page.getByTestId("access-row")).toHaveCount(2);
    for (const bought of [LUT, EBOOK]) {
      await expect(
        accessRow(page, bought.sku).getByTestId("access-allowance"),
      ).toHaveText(FULL_ALLOWANCE);
    }

    // The whole of what this surface may offer a buyer whose delivery failed:
    // one way to be helped, and no way at all to pay again — not the checkout's
    // control and not the retry an unpaid order would have had.
    await expect(page.getByTestId("fulfillment-recovery")).toBeVisible();
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);
    await expect(page.getByTestId("payment-retry")).toHaveCount(0);

    // The provider redelivers the same event once the mail is flowing again.
    // Nothing about the order has changed, so the delivery resumes from what
    // was already durable rather than starting a second one.
    await outbox.outage("off");
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId: "evt-approved",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    expect(await readOrderState(page)).toEqual({
      payment: "approved",
      fulfillment: "delivered",
      awaiting: false,
    });

    const receipt = await outbox.only(email);
    const stored = await onlyStoredOrder();
    // One grant per line and not one more, with both allowances whole: the
    // resumed delivery kept what was already durable rather than remaking it.
    expect(stored.grants.map((grant) => grant.sku).sort()).toEqual(
      [EBOOK.sku, LUT.sku].sort(),
    );
    expect(stored.grants.every((grant) => grant.downloadsUsed === 0)).toBe(true);
    expect(stored.access).toHaveLength(1);

    // The buyer who paid and was not written to is written down for the
    // Commerce Operator view issue #15 builds, and stays outstanding until a
    // person closes it. The delivery that succeeded afterwards is not an
    // anomaly: nobody has anything to decide about it.
    expect(stored.anomalies.map((one) => one.kind)).toEqual([
      "fulfillment_failed",
    ]);
    expect(stored.anomalies[0].resolvedAt).toBeNull();

    // And the address in the message that did go out is the one that works.
    await page.goto(accessLink(receipt));
    await expectHeading(page, "Vos fichiers.");
    await expect(page.getByTestId("access-row")).toHaveCount(2);
    for (const bought of [LUT, EBOOK]) {
      await expect(
        accessRow(page, bought.sku).getByTestId("access-allowance"),
      ).toHaveText(FULL_ALLOWANCE);
    }
  });

  test("a claim nobody finished is not taken up while it is still running", async ({
    page,
    request,
  }) => {
    // One request is deliberately held open for the length of the outage.
    test.setTimeout(120_000);
    await outbox.outage("stall", STALL_SECONDS);
    const { email, transaction } = await buyAndLeave(page);

    // Left in flight on purpose: this is the request that claimed the delivery
    // and is now waiting on a mail provider that will not answer.
    const stalled = deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
      eventId: "evt-approved",
    });

    await page.goto("/commande/retour");
    await expect
      .poll(async () => (await readOrderState(page)).fulfillment)
      .toBe("processing");

    // A second delivery while the first is still running finds the claim taken
    // and does nothing — which is the whole of "one approval delivers once".
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId: "evt-approved-again",
      }),
    ).toBe(200);
    expect(await outbox.messages()).toHaveLength(0);
    expect((await onlyStoredOrder()).grants).toHaveLength(1);

    // Once that claim is old enough to be abandoned, the next delivery takes it
    // up. This is the application that stopped between claiming and finishing.
    await commerce.age(STALLED_CLAIM_SECONDS + 60);
    await outbox.outage("off");
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
        eventId: "evt-approved-a-third-time",
      }),
    ).toBe(200);

    await page.goto("/commande/retour");
    expect(await readOrderState(page)).toEqual({
      payment: "approved",
      fulfillment: "delivered",
      awaiting: false,
    });
    await outbox.only(email);

    // The abandoned request eventually gives up, and finds the delivery is no
    // longer its to settle: a late failure may not unsay a finished one.
    expect(await stalled).toBe(200);
    await page.goto("/commande/retour");
    expect(await readOrderState(page)).toEqual({
      payment: "approved",
      fulfillment: "delivered",
      awaiting: false,
    });

    const stored = await onlyStoredOrder();
    expect(stored.grants).toHaveLength(1);
    expect(stored.grants[0].downloadsUsed).toBe(0);
    expect(stored.access).toHaveLength(1);
  });
});

test.describe("Downloads under load", () => {
  test("spend one between them, and never more than was bought", async ({
    page,
    request,
  }) => {
    const { email, transaction } = await buyAndLeave(page);
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
      }),
    ).toBe(200);
    const token = await tokenFromReceipt(email);
    await page.goto(accessLink(await outbox.only(email)));

    // Five presses at once, carrying this buyer's access, with nothing handed
    // over yet. One of them produces the address and spends the download; the
    // rest are the same download, because it is live by the time they ask.
    const handed = await pressTogether(request, {
      token,
      sku: LUT.sku,
      times: 5,
      origin: BASE_URL,
    });
    expect(handed.every((address) => address.startsWith("https://stockage."))).toBe(
      true,
    );

    await page.goto("/commande/acces");
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText("4 téléchargements sur 5 restants");

    const stored = await onlyStoredOrder();
    expect(stored.grants[0].downloadsUsed).toBe(1);

    // Take the rest the same way, each in its own window, and the allowance
    // stops at nothing rather than going past it.
    for (let taken = 0; taken < 4; taken += 1) {
      await commerce.age(PRIVATE_LINK_SECONDS + 60);
      await pressTogether(request, {
        token,
        sku: LUT.sku,
        times: 4,
        origin: BASE_URL,
      });
    }

    await page.goto("/commande/acces");
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText("0 téléchargement sur 5 restant");

    const exhausted = await onlyStoredOrder();
    expect(exhausted.grants[0].downloadsUsed).toBe(5);
    expect(exhausted.grants[0].downloadsUsed).toBeLessThanOrEqual(
      exhausted.grants[0].downloadsAllowed,
    );
  });

  test("cost nothing when the store cannot answer for the file", async ({
    page,
    request,
  }) => {
    const { email, transaction } = await buyAndLeave(page);
    expect(
      await deliverPaymentEvent(request, {
        transaction,
        name: "transaction.approved",
      }),
    ).toBe(200);
    const token = await tokenFromReceipt(email);
    await page.goto(accessLink(await outbox.only(email)));

    await commerce.emptyPrivateStore();
    const handed = await pressTogether(request, {
      token,
      sku: LUT.sku,
      times: 3,
      origin: BASE_URL,
    });
    expect(handed.some((address) => address.includes("stockage"))).toBe(false);
    expect(new Set(handed)).toEqual(
      new Set(["/commande/acces?probleme=unavailable"]),
    );

    // Retryable technical uncertainty, said as such, and never a payment that
    // failed: the allowance is whole and the order is where it was.
    await page.goto(handed[0]);
    await expect(page.getByTestId("access-problem")).toContainText(
      "aucun téléchargement n'a été décompté",
    );
    await expect(
      accessRow(page, LUT.sku).getByTestId("access-allowance"),
    ).toHaveText(FULL_ALLOWANCE);

    const stored = await onlyStoredOrder();
    expect(stored.grants[0].downloadsUsed).toBe(0);
    expect(stored.orders[0].paymentState).toBe("approved");
    expect(stored.orders[0].fulfillmentState).toBe("delivered");
  });
});

/** The buyer's own credential, out of the address their receipt carried. */
async function tokenFromReceipt(email: string): Promise<string> {
  return accessToken(accessLink(await outbox.only(email)));
}
