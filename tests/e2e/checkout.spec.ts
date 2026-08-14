import { expect, test, type Page } from "@playwright/test";

import type { DigitalProduct } from "../../src/managed-content/types";
import {
  FEDAPAY_HOSTED_ORIGIN,
  PROVIDER_FAILURE_EMAIL,
  collectResponseBodies,
  expectHeading,
  fillGuestDetails,
  interceptHostedPayment,
  submitCheckout,
  ticketReference,
} from "./support/checkout";
import { CommerceDataPlane, putOnSale } from "./support/commerce";
import { arriveWithCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";
import { TEST_FEDAPAY_SECRET } from "../../playwright.config";

/**
 * Guest checkout: the last thing WeCreate decides before a buyer leaves for
 * FedaPay, and the record it keeps of what was decided.
 *
 * Everything a browser sends here is a suggestion. The products, their prices,
 * whether each may be sold at all and which terms are in force are all resolved
 * again on the server at the moment the order is created, and what is written
 * into the Order Snapshot is that answer — never the cart's, and never the
 * form's. The buyer then leaves for a page WeCreate does not host, and comes
 * back to a route that can report what the server has observed and nothing more.
 *
 * The payment provider is faked at the application's own outbound boundary, as
 * Sanity and Supabase are. Nothing below mocks a page, an action or a query.
 */

/** The purchasable product these scenarios sell, and a second one beside it. */
const LUT = sampleProduct();
const EBOOK = sampleProduct({
  id: "ebk-04",
  sku: "EBK-04",
  family: "ebooks",
  slug: "cadrage-mobile",
  title: "Cadrage mobile",
  format: "PDF",
  summary: "Cadrer proprement au téléphone, en six règles.",
  priceXof: 9000,
});

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

/** Everything two systems have to agree on before a product may be bought. */
async function sell(page: Page, products: DigitalProduct[]): Promise<void> {
  await content.editDraft({
    legalDocuments: approvedLegalDocuments(),
    boutique: { products },
  });
  await content.publish();
  await putOnSale(
    page,
    products.map((product) => product.sku),
  );
}

/** A shopper standing at the checkout with one product in their cart. */
async function arriveAtCheckout(
  page: Page,
  products: DigitalProduct[] = [LUT],
): Promise<void> {
  await sell(page, products);
  await arriveWithCart(
    page,
    products.map((product) => [product.id, product.priceXof] as [string, number]),
  );
  await page.goto("/commande");
}

/** What the page tells a crawler, or `""` when it says nothing. */
async function robots(page: Page): Promise<string> {
  const meta = page.locator('meta[name="robots"]');
  if ((await meta.count()) === 0) return "";
  return (await meta.first().getAttribute("content")) ?? "";
}

test.describe("The checkout a buyer arrives at", () => {
  test("shows the order as a ticket and asks for four things", async ({
    page,
  }) => {
    await arriveAtCheckout(page, [LUT, EBOOK]);

    // The black ticket: what is being bought, at what WeCreate charges today.
    const ticket = page.getByTestId("checkout-ticket");
    await expect(ticket).toBeVisible();
    await expect(ticket.getByTestId("ticket-total")).toHaveText("23 000 F");
    await expect(ticket.getByTestId("ticket-count")).toHaveText(
      "2 produits numériques",
    );

    await expectHeading(page, "Où devons-nous livrer vos fichiers ?");

    // Exactly what issue #1 allows a guest checkout to ask for. A postal
    // address is not here, and neither is anything about a company beyond its
    // name — nor a password, because there is no account to create.
    await expect(page.getByLabel("Nom complet")).toBeVisible();
    await expect(page.getByLabel("Email de livraison")).toBeVisible();
    await expect(page.getByLabel("Téléphone international")).toBeVisible();
    await expect(page.getByLabel(/Entreprise/)).toBeVisible();
    // Four fields, plus one acceptance per document a buyer must accept, and
    // nothing else a buyer could fill in.
    await expect(
      page.getByTestId("guest-form").locator("input:not([type=hidden])"),
    ).toHaveCount(6);
    await expect(page.getByLabel(/adresse|postale|code postal/i)).toHaveCount(0);
  });

  test("asks for the terms in force, and infers no marketing consent", async ({
    page,
  }) => {
    await arriveAtCheckout(page);

    // The CGV and the delivery/refund terms, and nothing else: privacy
    // information is given rather than consented to beside a payment.
    const acceptances = page.getByTestId("legal-acceptance");
    await expect(acceptances).toHaveCount(2);
    await expect(page.getByTestId("guest-form")).toContainText(
      "Conditions générales de vente",
    );
    await expect(page.getByTestId("guest-form")).toContainText(
      "Livraison numérique et remboursement",
    );

    await expect(page.getByTestId("checkout-no-marketing")).toContainText(
      "aucune inscription",
    );

    // Each document is readable before it is accepted, at its own address.
    await expect(
      page
        .getByTestId("guest-form")
        .getByRole("link", { name: /Conditions générales de vente/ }),
    ).toHaveAttribute("href", "/legal/conditions-generales-de-vente");
  });

  test("stays out of search results", async ({ page }) => {
    await arriveAtCheckout(page);
    expect(await robots(page)).toContain("noindex");
  });
});

test.describe("What the server refuses", () => {
  test("names every missing field in French, from the server", async ({
    page,
  }) => {
    await arriveAtCheckout(page);

    // The form does not validate in the browser at all, so this submission
    // really does reach the server and the refusal really is its answer.
    await submitCheckout(page);

    await expect(page.getByTestId("checkout-errors")).toBeVisible();
    await expect(page.getByTestId("error-fullName")).toHaveText(
      "Indiquez votre nom complet.",
    );
    await expect(page.getByTestId("error-email")).toHaveText(
      "Indiquez une adresse email valide.",
    );
    await expect(page.getByTestId("error-telephone")).toHaveText(
      "Indiquez un téléphone au format international, par exemple +229 01 97 00 00 00.",
    );
    await expect(page.getByTestId("error-legal")).toHaveText(
      "Acceptez les conditions indiquées pour continuer.",
    );

    // Nothing was created and nothing was left behind: the buyer is still here.
    await expect(page).toHaveURL(/\/commande$/);
    await expect(page.getByTestId("guest-form")).toBeVisible();
  });

  test("refuses a telephone that is not international", async ({ page }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page, { telephone: "97 80 80 80" });
    await submitCheckout(page);

    await expect(page.getByTestId("error-telephone")).toBeVisible();
    await expect(page.getByTestId("guest-form")).toBeVisible();
    // What the buyer typed comes back, so nothing has to be typed twice.
    await expect(page.getByLabel("Nom complet")).toHaveValue("Armand Kpodjedo");
  });

  test("refuses a buyer who has not accepted the terms", async ({ page }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page, { acceptLegal: false });
    await page.getByTestId("legal-acceptance").first().check();
    await submitCheckout(page);

    await expect(page.getByTestId("error-legal")).toBeVisible();
    await expect(page.getByTestId("guest-form")).toBeVisible();
  });
});

test.describe("What the checkout resolves again for itself", () => {
  test("refuses a cart whose price has moved since it was accepted", async ({
    page,
  }) => {
    await sell(page, [LUT]);
    await arriveWithCart(page, [[LUT.id, 14000]]);

    await content.editDraft({
      boutique: { products: [sampleProduct({ priceXof: 18000 })] },
    });
    await content.publish();

    await page.goto("/commande");

    // No form at all: a price the buyer has not seen may not be charged, and
    // accepting it is a decision taken in the cart rather than skipped here.
    await expectHeading(page, "Votre panier demande une vérification.");
    await expect(page.getByTestId("guest-form")).toHaveCount(0);
    await expect(page.getByTestId("checkout-blocker")).toHaveText(
      "Acceptez les nouveaux prix pour continuer.",
    );
  });

  test("refuses a product WeCreate has withdrawn since it was added", async ({
    page,
  }) => {
    await sell(page, [LUT]);
    await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);

    await content.editDraft({
      boutique: { products: [sampleProduct({ isArchived: true })] },
    });
    await content.publish();

    await page.goto("/commande");

    await expectHeading(page, "Votre panier demande une vérification.");
    await expect(page.getByTestId("guest-form")).toHaveCount(0);
    await expect(page.getByTestId("checkout-blocker")).toHaveText(
      "Retirez les produits indisponibles pour continuer.",
    );
  });

  test("refuses a submission whose file was withdrawn while it was typed", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page);

    // WeCreate withdraws the Paid Deliverable while the buyer is filling the
    // form. Everything is resolved again when the button is pressed, so the
    // refusal happens before an Order Snapshot exists rather than after.
    await commerce.reset();
    await submitCheckout(page);

    await expect(page.getByTestId("checkout-errors")).toBeVisible();
    await expect(page.getByTestId("checkout-ticket")).toContainText(
      "Panier numérique",
    );
    // No order was created, so nothing is waiting to be paid.
    await expect(page.getByTestId("ticket-reference")).toHaveCount(0);
  });

  test("is not open at all while WeCreate's terms are unapproved", async ({
    page,
  }) => {
    // The shipped state, and the state a fresh checkout is in: every legal
    // document is placeholder text, so no sale may happen under it.
    await arriveWithCart(page, [["ebk-01", 15000]]);
    await page.goto("/commande");

    await expectHeading(page, "La commande n'est pas encore ouverte.");
    await expect(page.getByTestId("guest-form")).toHaveCount(0);
  });

  test("says so plainly when the cart is empty", async ({ page }) => {
    // Past the legal gate, so what is left is the buyer's own cart. The gate is
    // answered first on purpose: with no approved terms nothing may be sold,
    // whatever is in the cart.
    await sell(page, [LUT]);
    await page.goto("/commande");

    await expectHeading(page, "Votre panier est vide.");
    await expect(page.getByTestId("guest-form")).toHaveCount(0);
    await expect(page.getByTestId("checkout-ticket")).toHaveCount(0);
  });
});

test.describe("Leaving for FedaPay", () => {
  test("creates the order and hands the buyer to the hosted page", async ({
    page,
  }) => {
    await arriveAtCheckout(page, [LUT, EBOOK]);
    await fillGuestDetails(page, { company: "Studio Adjovi" });

    await expect(page.getByTestId("checkout-submit")).toContainText("23 000 F");
    await page.getByTestId("checkout-submit").click();

    // The buyer really leaves WeCreate: the payment method is collected by the
    // provider, on the provider's own page.
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);
    const hosted = new URL(page.url());
    expect(hosted.origin).toBe(FEDAPAY_HOSTED_ORIGIN);
    // In whole francs, and the amount the server computed rather than one the
    // browser sent.
    expect(hosted.searchParams.get("amount")).toBe("23000");
    expect(hosted.searchParams.get("currency")).toBe("XOF");
    expect(hosted.searchParams.get("reference")).toMatch(/^WC-[0-9A-Z-]+$/);
  });

  test("keeps the provider's secret on the server", async ({ page }) => {
    const served = collectResponseBodies(page);
    await arriveAtCheckout(page);
    await fillGuestDetails(page);
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    for (const body of served.bodies) {
      expect(body).not.toContain(TEST_FEDAPAY_SECRET);
    }
  });
});

test.describe("The Order Snapshot", () => {
  test("keeps the title and the price it was created with", async ({ page }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page);
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    // WeCreate renames and reprices the product while the buyer is away.
    await content.editDraft({
      boutique: {
        products: [sampleProduct({ title: "Contre-jour doré II", priceXof: 21000 })],
      },
    });
    await content.publish();

    await page.goto("/commande/retour");

    const ticket = page.getByTestId("checkout-ticket");
    await expect(ticket.getByTestId("ticket-line")).toContainText(
      "Contre-jour doré",
    );
    await expect(ticket.getByTestId("ticket-line")).not.toContainText(
      "Contre-jour doré II",
    );
    await expect(ticket.getByTestId("ticket-total")).toHaveText("14 000 F");
  });

  test("records where the order is going, without printing it back", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page, { email: "armand@exemple.test" });
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    await page.goto("/commande/retour");

    // Enough for the buyer to recognise their own address, and not enough for
    // anyone else to read it.
    await expect(page.getByTestId("order-delivery")).toContainText(
      "a***@exemple.test",
    );
    expect(await page.content()).not.toContain("armand@exemple.test");
  });
});

test.describe("When FedaPay cannot be reached", () => {
  test("keeps the order, says nothing was charged and takes the retry", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page, { email: PROVIDER_FAILURE_EMAIL });
    await submitCheckout(page);

    await expect(page.getByTestId("checkout-errors")).toContainText(
      "rien n'a été débité",
    );

    // The order exists, and it is the one the buyer keeps.
    const reference = await ticketReference(page);
    expect(reference).toMatch(/^WC-[0-9A-Z-]+$/);
    await expect(page.getByTestId("checkout-resuming")).toContainText(
      "ne crée pas de seconde commande",
    );

    // Pressing again pays for the same order rather than making a second one.
    await submitCheckout(page);
    expect(await ticketReference(page)).toBe(reference);
    await expect(page.getByTestId("checkout-ticket")).toContainText("14 000 F");
  });

  test("resumes the same order when the buyer comes back", async ({ page }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page, { email: PROVIDER_FAILURE_EMAIL });
    await submitCheckout(page);
    const reference = await ticketReference(page);

    // Reloading the checkout finds the order that is already recorded, and says
    // that continuing pays it rather than replacing it.
    await page.goto("/commande");
    expect(await ticketReference(page)).toBe(reference);
    await expect(page.getByTestId("checkout-resuming")).toBeVisible();
    await expect(page.getByTestId("guest-form")).toBeVisible();
  });
});

test.describe("An order already with FedaPay", () => {
  test("offers no second payment, and points at the verification", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page);
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    // The buyer abandons the hosted page and comes back to the checkout.
    // WeCreate cannot know whether they paid, so it must not open a second
    // payment page for the same order — that is how somebody pays twice.
    await page.goto("/commande");

    await expectHeading(page, "Un paiement est déjà en cours.");
    await expect(page.getByTestId("guest-form")).toHaveCount(0);
    await expect(page.getByTestId("checkout-submit")).toHaveCount(0);
    await expect(page.getByTestId("follow-payment")).toHaveAttribute(
      "href",
      "/commande/retour",
    );
  });

  test("is not a trap for a buyer who changed their mind", async ({ page }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page);
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);
    await page.goto("/commande");

    // An order kept for a day must not hold somebody who wants to buy something
    // else. Leaving it gives them the checkout back; the order stays recorded.
    await page.getByTestId("order-abandon").click();

    await expectHeading(page, "Où devons-nous livrer vos fichiers ?");
    await expect(page.getByTestId("guest-form")).toBeVisible();
  });
});

test.describe("Coming back from FedaPay", () => {
  test("reports what the server observed, and nothing the browser claims", async ({
    page,
  }) => {
    await arriveAtCheckout(page);
    await fillGuestDetails(page);
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);

    // The provider's own callback parameters, and a forged approval beside
    // them. Neither is evidence of anything.
    await page.goto("/commande/retour?id=99&status=approved&transaction_id=99");

    await expectHeading(page, "Vérification du paiement.");
    await expect(page.getByTestId("order-payment-state")).toHaveText(
      "En attente de confirmation",
    );
    await expect(page.getByTestId("checkout-stage")).toContainText(
      "Vous pouvez fermer cette page",
    );
    expect(await robots(page)).toContain("noindex");
  });

  test("has nothing to show a browser carrying no order", async ({ page }) => {
    await page.goto("/commande/retour");
    await expectHeading(page, "Aucune commande à afficher.");
    await expect(page.getByTestId("checkout-ticket")).toHaveCount(0);
  });
});

test.describe("The checkout on a wide screen", () => {
  test.skip(({ isMobile }) => isMobile, "Covers the desktop layout only.");

  test("itemises the order beside the working surface", async ({ page }) => {
    await arriveAtCheckout(page, [LUT, EBOOK]);

    const ticket = page.getByTestId("checkout-ticket");
    await expect(ticket.getByTestId("ticket-lines")).toBeVisible();
    await expect(ticket.getByTestId("ticket-line")).toHaveCount(2);
    await expect(
      ticket.getByTestId("ticket-line").filter({ hasText: "Contre-jour doré" }),
    ).toContainText("14 000 F");
  });
});

test.describe("The checkout on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "Covers the mobile layout only.");

  test("compresses the ticket so the active step is in the first viewport", async ({
    page,
  }) => {
    await arriveAtCheckout(page, [LUT, EBOOK]);

    // Issue #1: "compress the black ticket to total and snapshot duration so
    // active payment truth appears in the first viewport". The products stay
    // one tap away, in the cart drawer the buyer arrived through.
    await expect(page.getByTestId("ticket-lines")).toBeHidden();
    await expect(page.getByTestId("ticket-total")).toBeInViewport();
    await expect(page.getByTestId("checkout-heading")).toBeInViewport();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
