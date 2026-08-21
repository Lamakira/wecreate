import { expect, test } from "@playwright/test";

import { TEST_CF_BEACON_TOKEN } from "../../playwright.config";
import { CommerceDataPlane, putOnSale } from "./support/commerce";
import {
  arriveWithCart,
  cartDrawer,
  openCart,
} from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * Anonymous measurement: Cloudflare Web Analytics for page views and field
 * Core Web Vitals, Cloudflare Zaraz for custom events.
 *
 * The suite compiles a beacon token into the build so it can see the snippet
 * and the events. A deployment without a token serves the same pages with
 * nothing counted, which is the safe default.
 */

const LUT = sampleProduct();

let content: ManagedContent;
let commerce: CommerceDataPlane;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  commerce = new CommerceDataPlane(request);
  await content.reset();
  await commerce.reset();
});

test.afterEach(async () => {
  await content.reset();
  await commerce.reset();
});

async function zarazQueue(page: import("@playwright/test").Page): Promise<unknown[]> {
  return page.evaluate(
    () =>
      (window as unknown as { zaraz?: { q?: unknown[] } }).zaraz?.q ?? [],
  );
}

test.describe("Cloudflare Web Analytics", () => {
  test("loads the privacy-preserving beacon on a public page", async ({
    page,
  }) => {
    await page.goto("/");

    const beacon = page.locator("script[data-cf-beacon]");
    await expect(beacon).toHaveCount(1);
    const payload = JSON.parse((await beacon.getAttribute("data-cf-beacon")) ?? "{}");
    expect(payload.token).toBe(TEST_CF_BEACON_TOKEN);
    expect(payload.spa).toBe(true);
  });

  test("still renders when the beacon is blocked", async ({ page }) => {
    await page.route("https://static.cloudflareinsights.com/**", (route) =>
      route.abort(),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Voir le portfolio" }),
    ).toBeVisible();
  });

  test("does not set an analytics cookie on a first visit", async ({ page }) => {
    await page.goto("/");
    const names = (await page.context().cookies()).map((cookie) => cookie.name);
    expect(names.some((name) => /(_ga|ajs_|cf_z_|mux)/i.test(name))).toBe(
      false,
    );
  });
});

test.describe("Custom events", () => {
  test("records a Service Enquiry destination without the phone number", async ({
    page,
  }) => {
    await page.goto("/contact");

    const popup = page.waitForEvent("popup");
    await page
      .getByTestId("contact-channel")
      .getByRole("link", { name: /WhatsApp/ })
      .click();
    await (await popup).close();

    const queue = await zarazQueue(page);
    expect(queue).toContainEqual([
      "track",
      "service_enquiry",
      { destination: "whatsapp" },
    ]);
    expect(JSON.stringify(queue)).not.toMatch(/\+229|0167366726|wa\.me/);
  });

  test("records a Discovery Call enquiry without the calendar address", async ({
    page,
  }) => {
    await page.goto("/services");

    const popup = page.waitForEvent("popup");
    await page
      .getByTestId("service-enquiry-notice")
      .getByRole("link", { name: /appel découverte/i })
      .click();
    await (await popup).close();

    const queue = await zarazQueue(page);
    expect(queue).toContainEqual([
      "track",
      "service_enquiry",
      { destination: "discovery_call" },
    ]);
    expect(JSON.stringify(queue)).not.toMatch(/calendly|wecreate08/);
  });

  test("records a product addition by catalogue identity, not a person", async ({
    page,
  }) => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments(),
      boutique: { products: [LUT] },
    });
    await content.publish();
    await putOnSale(page, [LUT.sku]);

    await page.goto("/boutique");
    await page.getByTestId("add-to-cart").click();
    await expect(cartDrawer(page).getByTestId("cart-line")).toBeVisible();

    const queue = await zarazQueue(page);
    expect(queue).toContainEqual([
      "track",
      "product_added",
      { product: LUT.id },
    ]);
    expect(JSON.stringify(queue)).not.toMatch(/@|Contre-jour/);
  });

  test("records a checkout start without the cart or a contact", async ({
    page,
  }) => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments(),
      boutique: { products: [LUT] },
    });
    await content.publish();
    await putOnSale(page, [LUT.sku]);
    await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);

    await page.goto("/boutique");
    const drawer = await openCart(page);
    await drawer.getByTestId("cart-checkout").click();
    await expect(page).toHaveURL(/\/commande$/);

    const queue = await zarazQueue(page);
    expect(queue).toContainEqual(["track", "checkout_started", {}]);
    expect(JSON.stringify(queue)).not.toMatch(/@|\+229|lut-04/);
  });

  test("does not treat product-support WhatsApp as a Service Enquiry", async ({
    page,
  }) => {
    await page.goto("/boutique/color-grading-signature");

    const popup = page.waitForEvent("popup");
    await page.getByRole("link", { name: /Poser une question sur WhatsApp/ }).click();
    await (await popup).close();

    const queue = await zarazQueue(page);
    expect(queue).not.toContainEqual(
      expect.arrayContaining(["service_enquiry"]),
    );
  });
});
