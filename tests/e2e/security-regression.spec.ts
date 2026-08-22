import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  TEST_FEDAPAY_SECRET,
  TEST_PAYMENT_WEBHOOK_SECRET,
  TEST_SENTRY_DSN,
} from "../../playwright.config";
import {
  FEDAPAY_HOSTED_ORIGIN,
  collectResponseBodies,
  fillGuestDetails,
  interceptHostedPayment,
  onScreen,
} from "./support/checkout";
import {
  COMMERCE_OPERATOR,
  CommerceDataPlane,
  enterPassword,
  openDossier,
  orderRow,
  press,
  putOnSale,
  searchOrders,
  wrongCode,
} from "./support/commerce";
import { arriveWithCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import { Observation } from "./support/observation";
import {
  WEBHOOK_PATH,
  deliverPaymentEvent,
  deliveryBody,
  transactionFromHostedPage,
} from "./support/payment-events";
import {
  approvedLegalDocuments,
  legalRevision,
  sampleProduct,
} from "./support/sample-content";

/**
 * The production security properties issue #1 asks for, as a black box.
 *
 * Staff MFA, webhook signatures, concurrent downloads and expired access are
 * already covered in `commerce`, `payment-webhook`, `order-access` and
 * `exactly-once`. This file is the rest: rate limits, captured failures,
 * cache leakage, secret leakage, cookies, and personal-data retention.
 *
 * The budgets below are spelled by hand rather than imported from
 * `src/security/rate-limit.ts`. A change to a number has to be deliberate in
 * both places.
 *
 * Each scenario that fills a bucket sets `X-Real-IP` so it does not share
 * `local` with the rest of the suite, and `Observation.reset()` empties every
 * bucket between tests — the acceptance server is one Node process.
 */

const LUT = sampleProduct();
const BUYER_EMAIL = "armand@exemple.test";
const OPERATOR_FACTOR = COMMERCE_OPERATOR.factors[0];

/** Staff login and MFA: eight attempts in fifteen minutes. */
const STAFF_ATTEMPTS = 8;
/** Order Access tokens: twenty guesses in fifteen minutes. */
const TOKEN_ATTEMPTS = 20;
/** Unsigned webhooks: twelve in fifteen minutes. */
const UNSIGNED_ATTEMPTS = 12;
/** Checkout retries (not the first payment): six in an hour. */
const CHECKOUT_RETRIES = 6;

let content: ManagedContent;
let commerce: CommerceDataPlane;
let observation: Observation;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  commerce = new CommerceDataPlane(request);
  observation = new Observation(request);
  await observation.reset();
});

test.afterEach(async () => {
  await observation?.reset();
  await content?.reset();
  await commerce?.reset();
});

async function sell(page: Page): Promise<void> {
  await content.reset();
  await commerce.reset();
  await interceptHostedPayment(page);
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

async function payFor(page: Page): Promise<string> {
  await arriveAtCheckout(page);
  await fillGuestDetails(page, { email: BUYER_EMAIL });
  await page.getByTestId("checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);
  return transactionFromHostedPage(page);
}

async function decline(
  request: Parameters<typeof deliverPaymentEvent>[0],
  transaction: string,
): Promise<void> {
  expect(
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.declined",
    }),
  ).toBe(200);
}

async function retryFromReturnPage(page: Page): Promise<string> {
  await onScreen(page, "payment-retry").click();
  await page.waitForURL(/\/commande$/);
  await expect(onScreen(page, "guest-form")).toBeVisible();
  await fillGuestDetails(page, { email: BUYER_EMAIL });
  await onScreen(page, "checkout-submit").click();
  await page.waitForURL(`${FEDAPAY_HOSTED_ORIGIN}/**`);
  return transactionFromHostedPage(page);
}

/** A value shaped like an Order Access token, and nobody was ever given it. */
function guessedToken(): string {
  return randomBytes(32).toString("base64url");
}

test.describe("Rate limits", () => {
  test("stops a spray of staff passwords", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setExtraHTTPHeaders({ "x-real-ip": "203.0.113.10" });
    await page.goto("/commerce/connexion");

    // A mailbox nobody has an account for, and that a password manager will
    // not overwrite with a saved operator password. The operator's own email
    // is a different bucket; filling it here would trip the next scenario.
    const sprayEmail = "spray@exemple.test";

    for (let attempt = 0; attempt < STAFF_ATTEMPTS; attempt += 1) {
      await page.getByLabel("Adresse e-mail").fill(sprayEmail);
      await page.getByLabel("Mot de passe").fill("incorrect");
      await page.getByLabel("Adresse e-mail").fill(sprayEmail);
      await press(page, page.getByRole("button", { name: "Se connecter" }));
      await expect(page.getByTestId("commerce-notice")).toContainText(
        "Adresse e-mail ou mot de passe refusé",
      );
    }

    await page.getByLabel("Adresse e-mail").fill(sprayEmail);
    await page.getByLabel("Mot de passe").fill("incorrect");
    await page.getByLabel("Adresse e-mail").fill(sprayEmail);
    await press(page, page.getByRole("button", { name: "Se connecter" }));
    await expect(page.getByTestId("commerce-notice")).toContainText(
      "Trop de tentatives. Réessayez dans quelques minutes.",
    );
  });

  test("stops a spray of second-factor codes", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setExtraHTTPHeaders({ "x-real-ip": "203.0.113.11" });
    await enterPassword(page, COMMERCE_OPERATOR);

    for (let attempt = 0; attempt < STAFF_ATTEMPTS; attempt += 1) {
      await page
        .getByLabel("Code de vérification")
        .fill(wrongCode(OPERATOR_FACTOR));
      await press(page, page.getByRole("button", { name: "Vérifier" }));
      await expect(page.getByTestId("commerce-notice")).toContainText(
        "Code refusé",
      );
    }

    await page
      .getByLabel("Code de vérification")
      .fill(wrongCode(OPERATOR_FACTOR));
    await press(page, page.getByRole("button", { name: "Vérifier" }));
    await expect(page.getByTestId("commerce-notice")).toContainText(
      "Trop de tentatives. Réessayez dans quelques minutes.",
    );
  });

  test("stops a spray of Order Access tokens without saying that one exists", async ({
    request,
  }) => {
    const headers = { "x-real-ip": "203.0.113.12" };

    for (let attempt = 0; attempt < TOKEN_ATTEMPTS; attempt += 1) {
      const response = await request.get(`/commande/acces/${guessedToken()}`, {
        headers,
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      expect(response.headers()["location"]).toBe("/commande/acces");
      expect(response.headers()["set-cookie"] ?? "").toMatch(/wc_acces=/);
    }

    const overflow = await request.get(`/commande/acces/${guessedToken()}`, {
      headers,
      maxRedirects: 0,
    });
    expect(overflow.status()).toBe(303);
    expect(overflow.headers()["location"]).toBe("/commande/acces");
    expect(overflow.headers()["set-cookie"] ?? "").not.toMatch(/wc_acces=/);

    const events = await observation.events();
    const guessing = events.filter((event) => event.kind === "token-guessing");
    expect(guessing.length).toBe(1);
    expect(guessing[0]?.message).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });

  test("answers 429 once unsigned webhooks fill the bucket", async ({
    request,
  }) => {
    const headers = { "x-real-ip": "203.0.113.13" };
    const body = deliveryBody({
      transaction: "unknown",
      name: "transaction.approved",
    });

    for (let attempt = 0; attempt < UNSIGNED_ATTEMPTS; attempt += 1) {
      const response = await request.post(WEBHOOK_PATH, {
        headers: { "content-type": "application/json", ...headers },
        data: Buffer.from(body, "utf8"),
      });
      expect(response.status()).toBe(401);
    }

    const overflow = await request.post(WEBHOOK_PATH, {
      headers: { "content-type": "application/json", ...headers },
      data: Buffer.from(body, "utf8"),
    });
    expect(overflow.status()).toBe(429);

    const events = await observation.events();
    const failures = events.filter(
      (event) => event.kind === "signature-failure",
    );
    expect(failures.length).toBe(UNSIGNED_ATTEMPTS + 1);
    for (const event of failures) {
      expect(event.message).not.toContain(TEST_PAYMENT_WEBHOOK_SECRET);
      expect(event.message).not.toContain(TEST_FEDAPAY_SECRET);
    }
  });

  test("caps retries on one order without refusing it", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await page.setExtraHTTPHeaders({ "x-real-ip": "203.0.113.14" });

    const first = await payFor(page);
    await decline(request, first);
    await page.goto("/commande/retour");

    for (let attempt = 0; attempt < CHECKOUT_RETRIES; attempt += 1) {
      const transaction = await retryFromReturnPage(page);
      await decline(request, transaction);
      await page.goto("/commande/retour");
      await expect(onScreen(page, "payment-retry")).toBeVisible();
    }

    await onScreen(page, "payment-retry").click();
    await page.waitForURL(/\/commande$/);
    await expect(onScreen(page, "guest-form")).toBeVisible();
    await fillGuestDetails(page, { email: BUYER_EMAIL });
    await onScreen(page, "checkout-submit").click();

    await expect(onScreen(page, "checkout-errors")).toContainText(
      "Trop de tentatives de paiement sur cette commande",
    );

    const orderCookies = await page.context().cookies();
    expect(orderCookies.some((cookie) => cookie.name === "wc_order")).toBe(
      true,
    );

    const events = await observation.events();
    expect(
      events.some((event) => event.kind === "unusual-payment-retries"),
    ).toBe(true);
  });
});

test.describe("Captured failures", () => {
  test("scrubs an email, a telephone, a token and a secret out of a client report", async ({
    request,
  }) => {
    const token = guessedToken();
    const response = await request.post("/api/observation", {
      headers: {
        "content-type": "application/json",
        "x-real-ip": "203.0.113.20",
      },
      data: {
        kind: "signature-failure",
        message: `failed for ${BUYER_EMAIL} +22997000000 bearer abc.def ${token} ${TEST_FEDAPAY_SECRET} ${TEST_SENTRY_DSN}`,
      },
    });
    expect(response.status()).toBe(200);

    const events = await observation.events();
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("client-error");
    expect(events[0]?.message).not.toContain(BUYER_EMAIL);
    expect(events[0]?.message).toContain("[redacted-email]");
    expect(events[0]?.message).toContain("[redacted-telephone]");
    expect(events[0]?.message).toContain("bearer [redacted]");
    expect(events[0]?.message).toContain("[redacted-token]");
    expect(events[0]?.message).toContain("[redacted]");
    expect(events[0]?.message).not.toContain(TEST_FEDAPAY_SECRET);
    expect(events[0]?.message).not.toContain(TEST_SENTRY_DSN);
  });

  test("does not let a client pick the alert kind", async ({ request }) => {
    await request.post("/api/observation", {
      headers: { "content-type": "application/json" },
      data: { kind: "signature-failure", message: "please page someone" },
    });

    const events = await observation.events();
    expect(events[0]?.kind).toBe("client-error");
  });
});

test.describe("Cache, cookies and secrets", () => {
  test("keeps transaction and staff surfaces out of shared caches", async ({
    request,
  }) => {
    for (const path of ["/commande", "/commerce/connexion", "/studio"]) {
      const response = await request.get(path);
      const cacheControl = response.headers()["cache-control"] ?? "";
      expect(cacheControl, path).toMatch(/no-store/);
      expect(cacheControl, path).toMatch(/private/);
    }

    const publicPage = await request.get("/");
    const cacheControl = publicPage.headers()["cache-control"] ?? "";
    expect(cacheControl).not.toMatch(/no-store/i);
  });

  test("keeps payment and monitoring secrets out of what the browser is served", async ({
    page,
  }) => {
    const served = collectResponseBodies(page);
    await page.goto("/commande");
    await page.goto("/commerce/connexion");

    const blob = served.bodies.join("\n");
    expect(blob).not.toContain(TEST_FEDAPAY_SECRET);
    expect(blob).not.toContain(TEST_PAYMENT_WEBHOOK_SECRET);
    expect(blob).not.toContain(TEST_SENTRY_DSN);
  });

  test("sets the order and staff cookies as httpOnly and SameSite=Lax", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await payFor(page);
    const cookies = await page.context().cookies();
    const order = cookies.find((cookie) => cookie.name === "wc_order");
    expect(order?.httpOnly).toBe(true);
    expect(order?.sameSite).toBe("Lax");
    // Set while putting the product on sale, scoped to `/commerce`.
    const session = cookies.find(
      (cookie) => cookie.name === "wc_commerce_session",
    );
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
  });
});

test.describe("Personal-data retention", () => {
  test("forgets a buyer's contact after the configured period", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });
    await page.goto("/commande/retour");
    const reference = (
      await page.getByTestId("ticket-reference").innerText()
    ).trim();

    await commerce.age(31 * 24 * 60 * 60);
    const applied = await commerce.applyRetention();
    expect(applied.status).toBe("configured");
    expect(applied.days).toBe(30);
    expect(applied.forgotten).toBeGreaterThan(0);

    await openDossier(page, reference);
    await expect(page.getByTestId("buyer-forgotten")).toBeVisible();
    await expect(page.getByTestId("dossier-buyer")).toHaveCount(0);
    await expect(page.getByTestId("correct-contact")).toHaveCount(0);
    expect(await page.content()).not.toContain(BUYER_EMAIL);

    await searchOrders(page, BUYER_EMAIL);
    await expect(orderRow(page, reference)).toHaveCount(0);

    await searchOrders(page, reference);
    await expect(orderRow(page, reference)).toHaveCount(1);
  });

  test("does not forget anyone while the privacy policy is unapproved", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const transaction = await payFor(page);
    await deliverPaymentEvent(request, {
      transaction,
      name: "transaction.approved",
    });
    await page.goto("/commande/retour");
    const reference = (
      await page.getByTestId("ticket-reference").innerText()
    ).trim();

    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "confidentialite"
          ? {
              ...document,
              revisions: [
                legalRevision("confidentialite-placeholder", "2026-01-15", {
                  status: "placeholder",
                }),
              ],
            }
          : document,
      ),
    });
    await content.publish();

    await commerce.age(31 * 24 * 60 * 60);
    const gated = await commerce.applyRetention();
    expect(gated.status).toBe("gated");
    expect(gated.forgotten).toBeUndefined();

    await openDossier(page, reference);
    await expect(page.getByTestId("buyer-email")).toHaveText(BUYER_EMAIL);
    await expect(page.getByTestId("buyer-forgotten")).toHaveCount(0);
  });
});
