import { expect, test, type Page } from "@playwright/test";

import {
  FEDAPAY_HOSTED_ORIGIN,
  expectHeading,
  fillGuestDetails,
  interceptHostedPayment,
} from "./support/checkout";
import {
  COMMERCE_OPERATOR,
  CONTENT_EDITOR,
  CommerceDataPlane,
  auditEntries,
  dossierGrant,
  enterPassword,
  openDossier,
  orderRow,
  press,
  putOnSale,
  searchOrders,
  signIn,
  uploadDeliverable,
} from "./support/commerce";
import { arriveWithCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import {
  Outbox,
  accessLink,
  accessRow,
  expectPrivateLink,
  objectPathFor,
  pressDownload,
  storedCommerce,
} from "./support/order-access";
import {
  deliverPaymentEvent,
  transactionFromHostedPage,
} from "./support/payment-events";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * The commerce back office resolving a buyer's problem.
 *
 * Everything below drives the same running application a Commerce Operator
 * drives: signing in with a password and a code their own authenticator really
 * produces, finding the order through the list, and pressing what the dossier
 * offers. The buyer's half is just as real — the checkout, the hosted page, a
 * signed webhook, the receipt read out of the inbox and the address followed
 * out of it.
 *
 * Three claims run through all of it, and they are what issue #15 is for:
 *
 * **Support may add facts and may not rewrite them.** A corrected address is a
 * new record beside the Order Snapshot, a granted version is a new record
 * beside the order line, a settled anomaly keeps everything the provider said.
 * Nothing here can reach a payment event, a provider identifier, a Payment
 * State approval, an Order Snapshot or a stored Paid Deliverable Version.
 *
 * **An approved payment and a failed delivery are two different facts.** The
 * back office says both, offers to take the delivery up again, and offers a
 * second payment for nothing and to nobody.
 *
 * **Every mutation is somebody's.** Each one asks for a motive and writes an
 * append-only entry naming the individual who did it — there are no shared
 * accounts here to hide behind.
 */

const LUT = sampleProduct();

/** The buyer these scenarios sell to, and the address they mistyped. */
const BUYER = "armande@exemple.test";
const MISTYPED = "armande@exmple.test";

/** What a buyer is told they have left before opening anything. */
const FULL_ALLOWANCE = "5 téléchargements sur 5 restants";

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

/** One Digital Product on sale: published, licensed, with a file activated. */
async function sellOneProduct(page: Page): Promise<void> {
  await content.editDraft({
    legalDocuments: approvedLegalDocuments(),
    boutique: { products: [LUT] },
  });
  await content.publish();
  await putOnSale(page, [LUT.sku]);
}

/**
 * A buyer who has reached the hosted page.
 *
 * The reference comes out of the address WeCreate handed the provider, which is
 * where a scenario can read it without asking the application for it twice.
 */
async function startPayment(
  page: Page,
  email = BUYER,
): Promise<{ reference: string; transaction: string }> {
  await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);
  await page.goto("/commande");
  await fillGuestDetails(page, { email });
  await page.getByTestId("checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

  const hosted = new URL(page.url());
  return {
    reference: hosted.searchParams.get("reference") as string,
    transaction: transactionFromHostedPage(page),
  };
}

/** The same, paid for: one approval, delivered as far as the mail allows. */
async function buyAndApprove(
  page: Page,
  request: Parameters<typeof deliverPaymentEvent>[0],
  email = BUYER,
): Promise<{ reference: string; transaction: string }> {
  const started = await startPayment(page, email);
  expect(
    await deliverPaymentEvent(request, {
      transaction: started.transaction,
      name: "transaction.approved",
      eventId: `evt-${started.transaction}`,
    }),
  ).toBe(200);
  return started;
}

/** Fill one of the dossier's forms and wait for the server to have answered. */
async function submitSupport(
  page: Page,
  button: string,
  fields: Record<string, string> = {},
): Promise<void> {
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label).fill(value);
  }
  await press(page, page.getByRole("button", { name: button }));
}

/** What the back office is saying after the last action. */
function notice(page: Page) {
  return page.getByTestId("commerce-notice");
}

test.describe("Reaching the orders", () => {
  test("shows nothing at all to someone who is not signed in", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    await page.goto("/commerce");
    await press(page, page.getByRole("button", { name: "Se déconnecter" }));

    await page.goto("/commerce/commandes");
    await expect(page).toHaveURL(/\/commerce\/connexion$/);
    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    await expect(page.getByTestId("order-row")).toHaveCount(0);

    // Nor by its address: an order reference is not a credential here, whatever
    // it opens on the buyer's own side.
    await page.goto(`/commerce/commande?reference=${reference}`);
    await expect(page).toHaveURL(/\/commerce\/connexion$/);
    await expect(page.getByTestId("dossier-buyer")).toHaveCount(0);
  });

  test("refuses a password on its own", async ({ page, request }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    await page.goto("/commerce");
    await press(page, page.getByRole("button", { name: "Se déconnecter" }));

    await enterPassword(page, COMMERCE_OPERATOR);

    // Assurance level 1 reads nothing: a buyer's contact details are behind the
    // second factor exactly as the files WeCreate sells are.
    await page.goto(`/commerce/commande?reference=${reference}`);
    await expect(page).toHaveURL(/\/commerce\/connexion$/);
    await expect(page.getByTestId("second-factor-form")).toBeVisible();
    await expect(page.getByTestId("dossier-buyer")).toHaveCount(0);
  });

  test("refuses a Content Editor who is fully authenticated", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    await page.goto("/commerce");
    await press(page, page.getByRole("button", { name: "Se déconnecter" }));

    await signIn(page, CONTENT_EDITOR);

    // Editorial and commerce are separate permissions, even when one person
    // holds both. Nothing about the order is rendered — not a reference, not an
    // address, not a state.
    await page.goto("/commerce/commandes");
    await expect(page.getByTestId("commerce-refusal")).toBeVisible();
    await expect(page.getByTestId("order-row")).toHaveCount(0);

    await page.goto(`/commerce/commande?reference=${reference}`);
    await expect(page.getByTestId("commerce-refusal")).toBeVisible();
    await expect(page.getByTestId("dossier-buyer")).toHaveCount(0);
    expect(await page.content()).not.toContain(BUYER);
  });

  test("refuses a support gesture posted with no session at all", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    const before = await storedCommerce();

    // Straight at the address the forms post to, from a client that has never
    // signed in: a form is not a security boundary, and neither is a page that
    // refuses to render one.
    const answer = await request.post("/commerce/commande/operation", {
      form: {
        operation: "correct-contact",
        reference,
        email: "detournee@exemple.test",
        reason: "sans session",
      },
      maxRedirects: 0,
    });
    expect(answer.status()).toBe(303);
    expect(answer.headers()["location"]).toContain("/commerce/connexion");

    const after = await storedCommerce();
    expect(after.orders[0].correction ?? null).toBeNull();
    expect(after.audit).toEqual(before.audit);
  });

  test("refuses a support gesture from a Content Editor's own browser", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    const before = await storedCommerce();

    await page.goto("/commerce");
    await press(page, page.getByRole("button", { name: "Se déconnecter" }));
    await signIn(page, CONTENT_EDITOR);

    // Fully authenticated, and posting from inside their own browser so the
    // request carries their real session. Editorial and commerce are separate
    // permissions: they are sent to the page that says so, and nothing is
    // written.
    const landed = await page.evaluate(
      async ([at, order]) => {
        const answer = await fetch("/commerce/commande/operation", {
          method: "POST",
          body: new URLSearchParams({
            operation: "correct-contact",
            reference: order,
            email: at,
            reason: "sans le rôle",
          }),
        });
        return answer.url;
      },
      ["detournee@exemple.test", reference],
    );
    expect(landed).toContain("/commerce");
    expect(landed).not.toContain("message=contactCorrected");

    const after = await storedCommerce();
    expect(after.orders[0].correction ?? null).toBeNull();
    expect(after.audit).toEqual(before.audit);
  });

  test("refuses a support gesture from a session that stopped at a password", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    const before = await storedCommerce();

    await page.goto("/commerce");
    await press(page, page.getByRole("button", { name: "Se déconnecter" }));
    await enterPassword(page, COMMERCE_OPERATOR);

    // The right person, the right role, and a session that has only proved a
    // password. Assurance level 2 is required for changing commerce data
    // exactly as it is for reading it.
    const landed = await page.evaluate(
      async ([at, order]) => {
        const answer = await fetch("/commerce/commande/operation", {
          method: "POST",
          body: new URLSearchParams({
            operation: "correct-contact",
            reference: order,
            email: at,
            reason: "sans deuxième facteur",
          }),
        });
        return answer.url;
      },
      ["detournee@exemple.test", reference],
    );
    expect(landed).not.toContain("message=contactCorrected");

    const after = await storedCommerce();
    expect(after.orders[0].correction ?? null).toBeNull();
    expect(after.audit).toEqual(before.audit);
  });

  test("has no gesture at all for the things that may not change", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    const before = await storedCommerce();

    await openDossier(page, reference);

    // Asked for by name, from a signed-in operator's own browser: a payment
    // event, a Payment State, an Order Snapshot line, a stored version. None of
    // these is refused — none of them is a thing this back office has (issue
    // #15), so the route answers as it does to any form it does not recognise.
    for (const operation of [
      "delete-payment-event",
      "set-payment-state",
      "edit-order-line",
      "replace-version",
    ]) {
      const landed = await page.evaluate(
        async ([gesture, order]) => {
          const answer = await fetch("/commerce/commande/operation", {
            method: "POST",
            body: new URLSearchParams({
              operation: gesture,
              reference: order,
              paymentState: "failed",
              email: "detournee@exemple.test",
              reason: "tentative",
            }),
          });
          return answer.url;
        },
        [operation, reference],
      );
      expect(landed, operation).toContain("/commerce/commandes");
      expect(landed, operation).not.toContain("message=");
    }

    const after = await storedCommerce();
    expect(after.paymentEvents).toEqual(before.paymentEvents);
    expect(after.orders).toEqual(before.orders);
    expect(after.audit).toEqual(before.audit);
  });

  test("closes the door again when the operator signs out", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);

    await openDossier(page, reference);
    await expect(page.getByTestId("buyer-email")).toHaveText(BUYER);

    await press(page, page.getByRole("button", { name: "Se déconnecter" }));
    await page.goto(`/commerce/commande?reference=${reference}`);

    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    await expect(page.getByTestId("dossier-buyer")).toHaveCount(0);
    expect(await page.content()).not.toContain(BUYER);
  });
});

test.describe("Finding one order among others", () => {
  test("lists them newest first and narrows by reference or address", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const first = await buyAndApprove(page, request, "premiere@exemple.test");
    const second = await buyAndApprove(page, request, "seconde@exemple.test");

    await page.goto("/commerce/commandes");
    await expect(page.getByTestId("order-row")).toHaveCount(2);
    await expect(page.getByTestId("order-row").first()).toHaveAttribute(
      "data-reference",
      second.reference,
    );

    // The list says what happened to each order and nothing else about who
    // bought it: a masked address, and no telephone anywhere.
    await expect(orderRow(page, first.reference)).toContainText("p***@exemple.test");
    expect(await page.content()).not.toContain("premiere@exemple.test");

    await searchOrders(page, first.reference);
    await expect(page.getByTestId("order-row")).toHaveCount(1);
    await expect(orderRow(page, first.reference)).toBeVisible();

    // And by the address the buyer is writing in from, which is the other thing
    // an operator has in front of them.
    await searchOrders(page, "seconde@exemple.test");
    await expect(page.getByTestId("order-row")).toHaveCount(1);
    await expect(orderRow(page, second.reference)).toBeVisible();

    await searchOrders(page, "WC-NOBODY");
    await expect(page.getByTestId("orders-empty")).toBeVisible();
  });
});

test.describe("One order's dossier", () => {
  test("shows the snapshot, both states, the attempts, the events and the grants", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference, transaction } = await buyAndApprove(page, request);

    await openDossier(page, reference);

    await expect(page.getByTestId("order-standing")).toHaveText(
      "Paiement approuvé.",
    );
    await expect(page.getByTestId("dossier-payment")).toHaveAttribute(
      "data-state",
      "approved",
    );
    await expect(page.getByTestId("dossier-fulfillment")).toHaveAttribute(
      "data-state",
      "delivered",
    );

    // The Order Snapshot, at the prices and versions of the day it was made.
    await expect(page.getByTestId("dossier-line")).toHaveCount(1);
    await expect(page.getByTestId("line-version")).toHaveText("version 1 achetée");
    await expect(page.getByTestId("dossier-total")).toHaveText("14 000 F");

    // Who it is for, and where WeCreate is writing.
    await expect(page.getByTestId("buyer-email")).toHaveText(BUYER);
    await expect(page.getByTestId("buyer-telephone")).toHaveText("+2290197808080");
    await expect(page.getByTestId("deliver-to")).toContainText(BUYER);
    await expect(page.getByTestId("contact-correction")).toHaveCount(0);

    // What WeCreate has written to them, which is everything this application
    // knows about that: a receipt was addressed, and when.
    await expect(page.getByTestId("email-intent")).toContainText("Dernier envoi");

    // What was attempted, and what the provider actually said about it.
    await expect(page.getByTestId("dossier-attempt")).toHaveCount(1);
    await expect(page.getByTestId("dossier-attempt")).toContainText(transaction);
    await expect(page.getByTestId("dossier-event")).toHaveCount(1);
    await expect(page.getByTestId("dossier-event")).toHaveAttribute(
      "data-effect",
      "applied",
    );

    // What the buyer may open, and how much of it is left.
    await expect(dossierGrant(page, LUT.sku).getByTestId("grant-versions")).toHaveText(
      "version 1 achetée",
    );
    await expect(dossierGrant(page, LUT.sku).getByTestId("grant-allowance")).toHaveText(
      FULL_ALLOWANCE,
    );
    await expect(page.getByTestId("anomalies-empty")).toBeVisible();
  });
});

test.describe("An approved payment whose delivery failed", () => {
  /** A paid order whose receipt could not be sent, on its own dossier. */
  async function approvedButUndelivered(
    page: Page,
    request: Parameters<typeof deliverPaymentEvent>[0],
  ): Promise<string> {
    await sellOneProduct(page);
    await outbox.outage("refuse");
    const { reference } = await buyAndApprove(page, request);
    await outbox.outage("off");

    await openDossier(page, reference);
    return reference;
  }

  test("says so in words, and offers no second payment anywhere", async ({
    page,
    request,
  }) => {
    await approvedButUndelivered(page, request);

    await expect(page.getByTestId("order-standing")).toContainText(
      "Paiement approuvé, livraison à reprendre",
    );
    await expect(page.getByTestId("order-standing")).toContainText(
      "ne demandez pas un second paiement",
    );
    await expect(page.getByTestId("dossier-payment")).toHaveAttribute(
      "data-state",
      "approved",
    );
    await expect(page.getByTestId("dossier-fulfillment")).toHaveAttribute(
      "data-state",
      "failed",
    );
    await expect(page.getByTestId("dossier-prospect")).toContainText(
      "Rien de plus ne sera encaissé",
    );

    // The one control offered is the delivery. There is nothing on this surface
    // that pays, retries a payment or refunds one — for this order or any other.
    await expect(page.getByTestId("retry-delivery")).toBeVisible();
    await expect(page.getByTestId("payment-retry")).toHaveCount(0);
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /payer|paiement|rembours/i }),
    ).toHaveCount(0);

    // And the delivery that failed is waiting for a person, as an anomaly.
    await expect(page.getByTestId("dossier-anomaly")).toHaveCount(1);
    await expect(page.getByTestId("dossier-anomaly")).toHaveAttribute(
      "data-kind",
      "fulfillment_failed",
    );
  });

  test("is taken up again through the same fulfillment boundary", async ({
    page,
    request,
  }) => {
    const reference = await approvedButUndelivered(page, request);
    const before = await storedCommerce();

    await press(page, page.getByRole("button", { name: "Reprendre la livraison" }));

    await expect(notice(page)).toContainText("Livraison reprise");
    await expect(page.getByTestId("dossier-fulfillment")).toHaveAttribute(
      "data-state",
      "delivered",
    );
    await expect(page.getByTestId("retry-delivery")).toHaveCount(0);

    // The buyer has exactly one message, and it opens their order.
    const receipt = await outbox.only(BUYER);
    await page.goto(accessLink(receipt));
    await expect(accessRow(page, LUT.sku).getByTestId("access-allowance")).toHaveText(
      FULL_ALLOWANCE,
    );

    // Payment truth was not touched by any of it: the same events, the same
    // verdict, the same approval.
    const after = await storedCommerce();
    expect(after.paymentEvents).toEqual(before.paymentEvents);
    expect(after.orders[0].paymentState).toBe("approved");
    expect(after.orders[0].lines).toEqual(before.orders[0].lines);

    // And the operator's own act is in the trail, with the state on either side.
    await openDossier(page, reference);
    const retried = auditEntries(page, "order-delivery.retried");
    await expect(retried).toHaveCount(1);
    await expect(retried).toContainText(COMMERCE_OPERATOR.email);
    await expect(retried).toContainText("Avant : Livraison à reprendre");
    await expect(retried).toContainText("Après : Livraison envoyée");
  });
});

test.describe("Correcting where an order goes", () => {
  test("keeps the buyer's own snapshot and delivers to the correction", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    await outbox.outage("refuse");
    const { reference } = await buyAndApprove(page, request, MISTYPED);
    await outbox.outage("off");

    await openDossier(page, reference);
    await expect(page.getByTestId("buyer-email")).toHaveText(MISTYPED);

    await submitSupport(page, "Enregistrer la correction", {
      "E-mail corrigé": BUYER,
      "Motif de la correction": "adresse mal saisie, confirmée par téléphone",
    });
    await expect(notice(page)).toContainText("Correction enregistrée");

    // The Order Snapshot still says what the buyer typed. The correction is the
    // separate fact beside it, with its motive and the name of who made it.
    await expect(page.getByTestId("buyer-email")).toHaveText(MISTYPED);
    await expect(page.getByTestId("contact-correction")).toContainText(BUYER);
    await expect(page.getByTestId("contact-correction")).toContainText(
      COMMERCE_OPERATOR.email,
    );
    await expect(page.getByTestId("contact-correction")).toContainText(
      "adresse mal saisie",
    );
    await expect(page.getByTestId("deliver-to")).toContainText(BUYER);

    const stored = await storedCommerce();
    expect(stored.orders[0].buyer.email).toBe(MISTYPED);
    expect(stored.orders[0].correction?.email).toBe(BUYER);
    expect(stored.orders[0].correction?.correctedByEmail).toBe(
      COMMERCE_OPERATOR.email,
    );

    // The trail names the change and keeps no copy of either address.
    const corrections = auditEntries(page, "order-contact.corrected");
    await expect(corrections).toHaveCount(1);
    await expect(corrections).toContainText("a***@exmple.test");
    await expect(corrections).toContainText("a***@exemple.test");
    expect(await corrections.innerText()).not.toContain(BUYER);

    // And the next delivery goes where the correction says.
    await press(page, page.getByRole("button", { name: "Reprendre la livraison" }));
    await expect(notice(page)).toContainText("Livraison reprise");
    const receipt = await outbox.only(BUYER);
    expect(receipt.to).toBe(BUYER);

    // A number nobody answers on is a second telephone call and a second
    // correction. It records the telephone and carries the address forward:
    // correcting one does not undo the other.
    await submitSupport(page, "Enregistrer la correction", {
      "E-mail corrigé": "",
      "Téléphone corrigé": "+229 01 97 11 22 33",
      "Motif de la correction": "numéro erroné",
    });
    await expect(notice(page)).toContainText("Correction enregistrée");
    await expect(page.getByTestId("buyer-telephone")).toHaveText("+2290197808080");
    await expect(page.getByTestId("contact-correction")).toContainText(
      "+2290197112233",
    );
    await expect(page.getByTestId("deliver-to")).toContainText(BUYER);

    const corrected = await storedCommerce();
    expect(corrected.orders[0].buyer.telephone).toBe("+2290197808080");
    expect(corrected.orders[0].correction?.telephone).toBe("+2290197112233");
    expect(corrected.orders[0].correction?.email).toBe(BUYER);
  });

  test("refuses an address the checkout would have refused", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);
    await openDossier(page, reference);

    await submitSupport(page, "Enregistrer la correction", {
      "E-mail corrigé": "pas-une-adresse",
      "Motif de la correction": "erreur de frappe",
    });
    await expect(notice(page)).toContainText("adresse e-mail valide");
    await expect(page.getByTestId("contact-correction")).toHaveCount(0);

    // A motive is not optional: every support mutation is signed by somebody
    // and says why.
    await submitSupport(page, "Enregistrer la correction", {
      "E-mail corrigé": "autre@exemple.test",
      "Motif de la correction": "",
    });
    await expect(notice(page)).toContainText("Indiquez le motif");

    const stored = await storedCommerce();
    expect(stored.orders[0].correction).toBeNull();
    expect(stored.audit.filter((one) => one.action === "order-contact.corrected"))
      .toHaveLength(0);
  });
});

test.describe("Replacing the address that opens an order", () => {
  test("kills the previous link, keeps the allowance, and names who did it", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);

    const first = accessLink(await outbox.only(BUYER));
    await page.goto(first);
    await expect(accessRow(page, LUT.sku).getByTestId("access-allowance")).toHaveText(
      FULL_ALLOWANCE,
    );

    await openDossier(page, reference);
    await submitSupport(page, "Renvoyer les accès", {
      "Motif du renvoi": "message perdu, redemandé par l'acheteuse",
    });
    await expect(notice(page)).toContainText("Nouveaux accès envoyés");

    // A second message, and it says out loud that nothing was charged again.
    const messages = await outbox.messages();
    expect(messages).toHaveLength(2);
    const resent = messages[1];
    expect(resent.subject).toContain("Vos accès");
    expect(resent.body).toContain("Rien n'a été encaissé une seconde fois");

    // The address that was emailed before no longer opens anything.
    await page.goto(first);
    await expectHeading(page, "Accès expiré ou introuvable.");
    await expect(page.getByTestId("access-row")).toHaveCount(0);

    // The one that replaced it opens exactly what the buyer already owned:
    // reissuing replaces a credential, never an allowance.
    await page.goto(accessLink(resent));
    await expect(accessRow(page, LUT.sku).getByTestId("access-allowance")).toHaveText(
      FULL_ALLOWANCE,
    );

    await openDossier(page, reference);
    const reissues = auditEntries(page, "order-access.reissued");
    await expect(reissues).toHaveCount(1);
    await expect(reissues).toContainText(COMMERCE_OPERATOR.email);
    await expect(reissues).toContainText("message perdu");
  });

  test("has nothing to replace before a payment has been approved", async ({
    page,
  }) => {
    await sellOneProduct(page);
    const { reference } = await startPayment(page);

    // A buyer who has reached the hosted page and not paid owns nothing yet, so
    // there is no credential to replace and no delivery to take up. The dossier
    // offers neither, and says what is actually happening instead.
    await openDossier(page, reference);
    await expect(page.getByTestId("access-absent")).toBeVisible();
    await expect(page.getByTestId("email-intent")).toHaveText(
      "Aucun message n'est encore parti pour cette commande.",
    );
    await expect(page.getByTestId("reissue-access")).toHaveCount(0);
    await expect(page.getByTestId("retry-delivery")).toHaveCount(0);
    await expect(page.getByTestId("dossier-prospect")).toContainText(
      "Un paiement est en cours",
    );
  });
});

test.describe("Granting a later version than the order bought", () => {
  test("changes what the buyer may open and not what they paid for", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference } = await buyAndApprove(page, request);

    // WeCreate corrects the file after this order was made. Uploading it is not
    // selling it, and it is certainly not giving it to anybody yet.
    const corrected = "seconde version du pack";
    await page.goto("/commerce");
    await uploadDeliverable(page, {
      sku: LUT.sku,
      fileName: "lut-04-v2.zip",
      contents: corrected,
      mimeType: "application/zip",
    });

    await openDossier(page, reference);
    const grant = dossierGrant(page, LUT.sku);
    await expect(grant.getByTestId("grant-versions")).toHaveText("version 1 achetée");
    // Only forwards: the version this order already has is not on offer.
    await expect(grant.getByRole("option", { name: /Version 1/ })).toHaveCount(0);

    await grant
      .getByLabel("Version à accorder")
      .selectOption({ label: "Version 2 - lut-04-v2.zip" });
    await grant.getByLabel("Motif de la version accordée").fill("fichier corrigé");
    await press(page, grant.getByRole("button", { name: "Accorder cette version" }));
    await expect(notice(page)).toContainText("Version accordée");

    // The grant opens the new one. The Order Snapshot goes on recording the one
    // that was bought, here and in storage.
    await expect(
      dossierGrant(page, LUT.sku).getByTestId("grant-versions"),
    ).toHaveText("version 1 achetée, version 2 accordée");
    await expect(page.getByTestId("line-version")).toHaveText("version 1 achetée");

    const stored = await storedCommerce();
    expect(stored.orders[0].lines[0].paidDeliverableVersion).toBe(1);

    const upgrades = auditEntries(page, "order-access.upgraded");
    await expect(upgrades).toHaveCount(1);
    await expect(upgrades).toContainText("Avant : version 1");
    await expect(upgrades).toContainText("Après : version 2");
    await expect(upgrades).toContainText("fichier corrigé");

    // And the buyer is handed the file they were given, at no cost to their
    // allowance beyond the download they just spent.
    await page.goto(accessLink(await outbox.only(BUYER)));
    expectPrivateLink(await pressDownload(page, LUT.sku), {
      objectPath: objectPathFor(LUT.sku, corrected, ".zip"),
    });
  });
});

test.describe("Annotating a payment nobody could settle automatically", () => {
  test("records what a person decided, and issues no refund", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    const { reference, transaction: first } = await startPayment(page);

    // Refused, paid again against the same Order Snapshot, and then the first
    // transaction is approved after all: the buyer was charged twice.
    expect(
      await deliverPaymentEvent(request, {
        transaction: first,
        name: "transaction.declined",
        eventId: "evt-first-declined",
      }),
    ).toBe(200);
    await page.goto("/commande/retour");
    await page.getByTestId("payment-retry").click();
    await fillGuestDetails(page, { email: BUYER });
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);
    const second = transactionFromHostedPage(page);
    expect(
      await deliverPaymentEvent(request, {
        transaction: second,
        name: "transaction.approved",
        eventId: "evt-second-approved",
      }),
    ).toBe(200);
    expect(
      await deliverPaymentEvent(request, {
        transaction: first,
        name: "transaction.approved",
        eventId: "evt-first-approved-late",
      }),
    ).toBe(200);

    await openDossier(page, reference);
    const anomaly = page.locator(
      '[data-testid="dossier-anomaly"][data-kind="duplicate_payment"]',
    );
    await expect(anomaly).toHaveCount(1);
    await expect(anomaly).toHaveAttribute("data-settled", "false");
    await expect(anomaly).toContainText(first);

    // The whole of what this application does about it: a person reads it,
    // decides, and writes down what they decided. Nothing here refunds anybody.
    await expect(
      page.getByRole("button", { name: /rembours/i }),
    ).toHaveCount(0);
    await expect(page.getByTestId("dossier-anomalies")).toContainText(
      "Aucun remboursement n'est déclenché ici",
    );

    // The one thing outstanding on this order, which is the second payment.
    await page.getByLabel("Anomalie traitée").selectOption({ index: 1 });
    await submitSupport(page, "Enregistrer la note", {
      "Note de réconciliation": "remboursé à la main dans FedaPay le 15 août",
    });
    await expect(notice(page)).toContainText("Note enregistrée");

    const settled = page.locator(
      '[data-testid="dossier-anomaly"][data-kind="duplicate_payment"]',
    );
    await expect(settled).toHaveAttribute("data-settled", "true");
    await expect(settled.getByTestId("anomaly-resolution")).toContainText(
      "remboursé à la main dans FedaPay",
    );
    await expect(settled.getByTestId("anomaly-resolution")).toContainText(
      COMMERCE_OPERATOR.email,
    );

    const notes = auditEntries(page, "order.annotated");
    await expect(notes).toHaveCount(1);
    await expect(notes).toContainText("Second paiement approuvé");

    // Every event the provider sent is still there, exactly as it arrived: the
    // refusal, the approval that paid the order, and the late approval that
    // charged the buyer a second time.
    const stored = await storedCommerce();
    expect(stored.paymentEvents.map((event) => event.effect)).toEqual([
      "applied",
      "applied",
      "unchanged",
    ]);
    expect(stored.orders[0].paymentState).toBe("approved");
  });

  test("refuses to settle the same anomaly twice", async ({ page, request }) => {
    await sellOneProduct(page);
    await outbox.outage("refuse");
    const { reference } = await buyAndApprove(page, request);
    await outbox.outage("off");

    await openDossier(page, reference);
    const anomalyId = (await storedCommerce()).anomalies[0].id;

    // The one thing outstanding on this order, which is the failed delivery.
    await page.getByLabel("Anomalie traitée").selectOption({ index: 1 });
    await submitSupport(page, "Enregistrer la note", {
      "Note de réconciliation": "acheteuse prévenue par téléphone",
    });
    await expect(notice(page)).toContainText("Note enregistrée");
    await expect(page.getByTestId("dossier-anomaly")).toHaveAttribute(
      "data-settled",
      "true",
    );

    // The anomaly this settled is settled: a second answer to it is refused
    // rather than written over the first. Posted directly, because the form
    // stops offering one that has been dealt with.
    await page
      .locator('[data-testid="annotate-order"]')
      .evaluate((form: HTMLFormElement, id: string) => {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "anomalyId";
        hidden.value = id;
        form.append(hidden);
      }, anomalyId);
    await submitSupport(page, "Enregistrer la note", {
      "Note de réconciliation": "deuxième avis",
    });
    await expect(notice(page)).toContainText("déjà été traitée");
  });
});

test.describe("What the back office cannot do", () => {
  test("leaves the payment truth, the snapshot and the trail exactly as they were", async ({
    page,
    request,
  }) => {
    await sellOneProduct(page);
    await outbox.outage("refuse");
    const { reference } = await buyAndApprove(page, request, MISTYPED);
    await outbox.outage("off");

    const before = await storedCommerce();

    // Every support action this back office has, one after the other, on one
    // order.
    await openDossier(page, reference);
    await submitSupport(page, "Enregistrer la correction", {
      "E-mail corrigé": BUYER,
      "Motif de la correction": "adresse corrigée",
    });
    await press(page, page.getByRole("button", { name: "Reprendre la livraison" }));
    await submitSupport(page, "Renvoyer les accès", {
      "Motif du renvoi": "lien perdu",
    });
    await submitSupport(page, "Enregistrer la note", {
      "Note de réconciliation": "dossier clos",
    });

    const after = await storedCommerce();

    // Not one payment event moved, and none was added: the provider's own
    // record is the one thing no support action may touch.
    expect(after.paymentEvents).toEqual(before.paymentEvents);

    // Nor the Order Snapshot: same products, same prices, same Paid Deliverable
    // Versions, same contact details as the buyer typed them.
    expect(after.orders[0].lines).toEqual(before.orders[0].lines);
    expect(after.orders[0].buyer).toEqual(before.orders[0].buyer);
    expect(after.orders[0].paymentState).toBe("approved");

    // The allowance is the buyer's, and three deliveries did not multiply it.
    expect(after.grants).toHaveLength(1);
    expect(after.grants[0].downloadsAllowed).toBe(5);
    expect(after.grants[0].downloadsUsed).toBe(0);
    expect(after.access).toHaveLength(1);

    // And every one of those gestures is in the trail, under one individual's
    // name. Nothing was removed from it: it only ever grew.
    expect(after.audit.length).toBeGreaterThan(before.audit.length);
    expect(after.audit.slice(0, before.audit.length)).toEqual(before.audit);
    expect(
      after.audit
        .slice(before.audit.length)
        .every((entry) => entry.actorEmail === COMMERCE_OPERATOR.email),
    ).toBe(true);
    expect(
      after.audit.map((entry) => entry.action).slice(before.audit.length),
    ).toEqual([
      "order-contact.corrected",
      "order-delivery.retried",
      "order-access.reissued",
      "order.annotated",
    ]);
  });
});
