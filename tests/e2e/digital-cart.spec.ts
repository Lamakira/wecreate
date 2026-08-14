import { expect, test, type Page } from "@playwright/test";

import type { DigitalProduct } from "../../src/managed-content/types";
import { CommerceDataPlane, putOnSale } from "./support/commerce";
import {
  arriveWithCart,
  arriveWithRawCart,
  cartDrawer,
  cartIndicator,
  openCart,
  storedCart,
  storedCartValue,
} from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * The Digital Cart: one copy of each product a shopper means to buy, carried
 * for thirty days, and checked against what WeCreate actually sells before any
 * of it can be paid for.
 *
 * Three things make this different from an ordinary basket. Quantity is fixed
 * at one, because a licence is per buyer and two copies of the same ebook are
 * not a quantity of two. What is stored is identifiers and nothing else — the
 * titles, the prices and the answer to "is this still on sale" are read back
 * from published content and the commerce system every time the cart is shown,
 * so a cookie a visitor has edited cannot change what anything costs. And a
 * service offer can never be in it at all (ADR-0006): the cart holds Digital
 * Product identities, and a service pack does not have one.
 *
 * Nothing in the shipped catalogue can be bought, so every scenario that needs
 * a purchasable product makes one the way WeCreate would: an approved licence
 * and a published product marked *En vente* on the editorial side, a Paid
 * Deliverable Version uploaded and activated on the commerce side.
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

/** The six products WeCreate ships, none of which may be sold. */
const SHIPPED_PRODUCT_IDS = [
  "ebk-01",
  "ebk-02",
  "ebk-03",
  "lut-01",
  "lut-02",
  "lut-03",
];

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

/**
 * Everything two systems have to agree on before a product is *Disponible*.
 *
 * It leaves the browser signed into the back office, which is harmless: that
 * session is an http-only cookie scoped to `/commerce` and the public site
 * neither reads nor is changed by it.
 */
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

/** What the page tells a crawler, or `""` when it says nothing. */
async function robots(page: Page): Promise<string> {
  const meta = page.locator('meta[name="robots"]');
  if ((await meta.count()) === 0) {
    return "";
  }
  return (await meta.first().getAttribute("content")) ?? "";
}

test.describe("Adding a Digital Product", () => {
  test("opens the cart, names the product and totals it", async ({ page }) => {
    await sell(page, [LUT]);
    await page.goto("/boutique");

    const card = page.getByTestId("product-card");
    await expect(card).toHaveCount(1);
    await card.getByTestId("add-to-cart").click();

    // The confirmation is the cart itself opening, not a message about it.
    const drawer = cartDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-busy", "false");
    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    await expect(drawer.getByTestId("cart-line")).toContainText(
      "Contre-jour doré",
    );
    await expect(drawer.getByTestId("cart-line-price")).toHaveText("14 000 F");
    await expect(drawer.getByTestId("cart-total")).toHaveText("14 000 F");
    await expect(cartIndicator(page)).toHaveAccessibleName("Panier, 1 article");
    await expect(drawer.getByTestId("cart-state")).toHaveText(
      "Votre panier est prêt.",
    );
  });

  test("holds one copy however many times it is added", async ({ page }) => {
    // A Digital Product is licensed to the buyer, so a second copy of the same
    // one is not a quantity of two — it is nothing (issue #1).
    await sell(page, [LUT]);
    await page.goto("/boutique/contre-jour-dore");

    const add = page.getByTestId("add-to-cart");
    await add.click();

    const drawer = cartDrawer(page);
    await expect(drawer).toHaveAttribute("aria-busy", "false");
    await drawer.getByRole("button", { name: "Fermer le panier" }).click();

    // The control now says what pressing it does: the product is already there.
    await expect(add).toHaveText(/Voir dans le panier/);
    await add.click();
    await expect(drawer).toHaveAttribute("aria-busy", "false");

    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    await expect(drawer.getByTestId("cart-total")).toHaveText("14 000 F");
    await expect(cartIndicator(page)).toHaveAccessibleName("Panier, 1 article");
    expect(await storedCartValue(page)).toBe('[["lut-04",14000]]');
  });

  test("is not offered at all on a product WeCreate cannot sell", async ({
    page,
  }) => {
    // The shipped state: no approved licence and no Paid Deliverable Version,
    // so a buy button anywhere here would be one that could not take money.
    await page.goto("/boutique");
    await expect(page.getByTestId("product-card")).toHaveCount(6);
    await expect(page.getByTestId("add-to-cart")).toHaveCount(0);

    await page.goto("/boutique/color-grading-signature");
    await expect(page.getByTestId("product-availability")).toHaveText(
      "Bientôt disponible",
    );
    await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
  });
});

test.describe("Removing a product", () => {
  test("updates the count, the total, the empty state and checkout", async ({
    page,
  }) => {
    await sell(page, [LUT, EBOOK]);
    await arriveWithCart(page, [
      [LUT.id, LUT.priceXof],
      [EBOOK.id, EBOOK.priceXof],
    ]);

    await page.goto("/boutique");
    const drawer = await openCart(page);
    await expect(drawer.getByTestId("cart-line")).toHaveCount(2);
    await expect(drawer.getByTestId("cart-total")).toHaveText("23 000 F");

    await drawer
      .getByTestId("cart-line")
      .filter({ hasText: "Cadrage mobile" })
      .getByTestId("cart-line-remove")
      .click();

    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    await expect(drawer.getByTestId("cart-total")).toHaveText("14 000 F");
    await expect(cartIndicator(page)).toHaveAccessibleName("Panier, 1 article");

    await drawer.getByTestId("cart-line-remove").click();

    await expect(drawer.getByText("Votre panier est vide.")).toBeVisible();
    await expect(drawer.getByTestId("cart-total")).toHaveText("0 F");
    await expect(cartIndicator(page)).toHaveAccessibleName("Panier, 0 articles");
    // Checkout is not merely refused, it is not offered: there is nothing to buy.
    await expect(drawer.getByTestId("cart-checkout")).toHaveCount(0);

    // And nothing is left behind in the browser to be restored tomorrow.
    expect(await storedCart(page)).toBeUndefined();
  });
});

test.describe("A cart carried between visits", () => {
  test("comes back after the browser is closed", async ({ page, browser }) => {
    await sell(page, [LUT]);
    await page.goto("/boutique");
    await page.getByTestId("add-to-cart").click();
    await expect(cartDrawer(page).getByTestId("cart-line")).toHaveCount(1);

    // A second browser session holding nothing but this one's cookies: what a
    // shopper has when they come back tomorrow.
    const tomorrow = await browser.newContext({
      storageState: await page.context().storageState(),
    });
    const later = await tomorrow.newPage();
    await later.goto("/");

    // The count is right before anything is asked of the server.
    await expect(cartIndicator(later)).toHaveAccessibleName("Panier, 1 article");

    const drawer = await openCart(later);
    await expect(drawer.getByTestId("cart-line")).toContainText(
      "Contre-jour doré",
    );
    await expect(drawer.getByTestId("cart-total")).toHaveText("14 000 F");

    await tomorrow.close();
  });

  test("lasts thirty days and stores identifiers, never names or people", async ({
    page,
  }) => {
    await sell(page, [LUT]);
    await page.goto("/boutique");
    await page.getByTestId("add-to-cart").click();
    await expect(cartDrawer(page).getByTestId("cart-line")).toHaveCount(1);

    const cookie = await storedCart(page);
    expect(cookie).toBeDefined();
    expect(cookie!.path).toBe("/");
    expect(cookie!.sameSite).toBe("Lax");

    const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);

    // An identifier and the amount the shopper accepted. No title, no address,
    // no Paid Deliverable, nothing about the person carrying it (issue #1).
    const value = decodeURIComponent(cookie!.value);
    expect(value).toBe('[["lut-04",14000]]');
    expect(value).not.toContain("Contre-jour");
    expect(value).not.toContain("lut-04.zip");
  });

  test("is gone once the cookie is, and is kept nowhere else", async ({
    page,
  }) => {
    // What expiry does, thirty days early. The cart is anonymous: nothing on the
    // server remembers who was carrying it, so a cookie that has gone — expired,
    // cleared, or refused — leaves nothing behind to be restored.
    await sell(page, [LUT]);
    await page.goto("/boutique");
    await page.getByTestId("add-to-cart").click();
    await expect(cartDrawer(page).getByTestId("cart-line")).toHaveCount(1);

    await page.context().clearCookies();
    await page.reload();

    await expect(cartIndicator(page)).toHaveAccessibleName("Panier, 0 articles");
    const drawer = await openCart(page);
    await expect(drawer.getByText("Votre panier est vide.")).toBeVisible();
    await expect(drawer.getByTestId("cart-line")).toHaveCount(0);
  });
});

test.describe("A cart the shop no longer recognises", () => {
  test("drops identifiers that are not Digital Products, and says so", async ({
    page,
  }) => {
    await sell(page, [LUT]);
    await arriveWithCart(page, [
      // A service pack, an invented address, and the same real product twice.
      ["entreprises-presence", 350000],
      ["../../etc/passwd", 1],
      [LUT.id, LUT.priceXof],
      [LUT.id, LUT.priceXof],
    ]);

    await page.goto("/");
    const drawer = await openCart(page);

    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    await expect(drawer.getByTestId("cart-unresolved")).toContainText(
      "2 articles de votre panier ne sont plus au catalogue",
    );
    await expect(drawer.getByTestId("cart-total")).toHaveText("14 000 F");

    // The cookie is repaired rather than left to be re-read every visit.
    expect(await storedCartValue(page)).toBe('[["lut-04",14000]]');
  });

  test("treats a cookie that is not ours as an empty cart", async ({ page }) => {
    await arriveWithRawCart(page, "{\"id\":\"lut-04\";;");

    await page.goto("/boutique");
    // The page is unaffected: a malformed cart may not break the site it is on.
    await expect(page.getByTestId("product-card")).toHaveCount(6);

    const drawer = await openCart(page);
    await expect(drawer.getByText("Votre panier est vide.")).toBeVisible();
    await expect(cartIndicator(page)).toHaveAccessibleName("Panier, 0 articles");
  });

  test("refuses to sell a product that is not on sale", async ({ page }) => {
    // Nothing is purchasable in the shipped catalogue, so this identifier could
    // only have been put here by hand. It resolves, and it stays refused.
    await arriveWithCart(page, [["ebk-01", 15000]]);

    await page.goto("/boutique");
    const drawer = await openCart(page);

    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    await expect(drawer.getByTestId("cart-line-unavailable")).toContainText(
      "Bientôt disponible",
    );
    // Not counted in what checkout would charge, and not allowed past it.
    await expect(drawer.getByTestId("cart-total")).toHaveText("0 F");
    await expect(drawer.getByTestId("cart-state")).toHaveText(
      "Retirez les produits indisponibles pour continuer.",
    );

    // Forced, because the control is refusable rather than inert: it keeps its
    // place in the tab order so a keyboard user can reach it and be told why,
    // which means a visitor really can press it. Pressing it goes nowhere.
    const checkout = drawer.getByTestId("cart-checkout");
    await expect(checkout).toHaveAttribute("aria-disabled", "true");
    await checkout.click({ force: true });
    await expect(page).toHaveURL(/\/boutique$/);
    await expect(drawer).toBeVisible();
  });

  test("keeps an archived product visible, and holds up the checkout", async ({
    page,
  }) => {
    await sell(page, [LUT]);
    await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);

    await page.goto("/");
    await expect(
      (await openCart(page)).getByTestId("cart-state"),
    ).toHaveText("Votre panier est prêt.");

    // WeCreate withdraws it while the shopper is still deciding.
    await content.editDraft({
      boutique: { products: [sampleProduct({ isArchived: true })] },
    });
    await content.publish();

    await page.reload();
    const drawer = await openCart(page);

    // Still named, so the shopper can see what changed rather than watching a
    // line disappear.
    await expect(drawer.getByTestId("cart-line")).toContainText(
      "Contre-jour doré",
    );
    await expect(drawer.getByTestId("cart-line-unavailable")).toContainText(
      "Plus disponible",
    );
    await expect(drawer.getByTestId("cart-total")).toHaveText("0 F");
    await expect(drawer.getByTestId("cart-checkout")).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await drawer.getByTestId("cart-line-remove").click();
    await expect(drawer.getByText("Votre panier est vide.")).toBeVisible();
  });
});

test.describe("Service offers and the Digital Cart", () => {
  test("can never be put in it, by a control or by a cookie", async ({
    page,
  }) => {
    // The design prototype sold a 350,000 F service pack through this cart.
    // Issue #1 removed it: a service offer ends in a conversation (ADR-0006).
    await page.goto("/services");
    await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /WhatsApp/ }).first()).toBeVisible();

    await arriveWithCart(page, [
      ["mariage-wedding-film-signature", 2000000],
      ["entreprises-domination", 1200000],
    ]);
    await page.goto("/services");

    const drawer = await openCart(page);
    await expect(drawer.getByTestId("cart-line")).toHaveCount(0);
    await expect(drawer.getByText("Votre panier est vide.")).toBeVisible();
    await expect(drawer.getByTestId("cart-total")).toHaveText("0 F");
    expect(await storedCart(page)).toBeUndefined();
  });
});

test.describe("A price that changed while the cart waited", () => {
  test("shows the new amount and requires it to be accepted", async ({
    page,
  }) => {
    await sell(page, [LUT]);
    await arriveWithCart(page, [[LUT.id, 14000]]);

    await content.editDraft({
      boutique: { products: [sampleProduct({ priceXof: 18000 })] },
    });
    await content.publish();

    await page.goto("/");
    const drawer = await openCart(page);

    // The new price is what is shown and what is totalled; the old one is named
    // so the shopper can see what moved.
    await expect(drawer.getByTestId("cart-line-price")).toHaveText("18 000 F");
    await expect(drawer.getByTestId("cart-line-price-change")).toContainText(
      "Nouveau prix depuis votre dernière visite.",
    );
    await expect(drawer.getByTestId("cart-total")).toHaveText("18 000 F");
    await expect(drawer.getByTestId("cart-checkout")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(drawer.getByTestId("cart-state")).toHaveText(
      "Acceptez les nouveaux prix pour continuer.",
    );

    await drawer.getByTestId("cart-acknowledge-prices").click();

    await expect(drawer.getByTestId("cart-price-change-notice")).toHaveCount(0);
    await expect(drawer.getByTestId("cart-state")).toHaveText(
      "Votre panier est prêt.",
    );
    await expect(drawer.getByTestId("cart-checkout")).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // What was accepted is what is remembered, so the question is not asked twice.
    expect(await storedCartValue(page)).toBe('[["lut-04",18000]]');
  });

  test("refuses to accept an amount the shopper never saw", async ({ page }) => {
    await sell(page, [LUT]);
    await arriveWithCart(page, [[LUT.id, 14000]]);

    await content.editDraft({
      boutique: { products: [sampleProduct({ priceXof: 18000 })] },
    });
    await content.publish();

    await page.goto("/");
    const drawer = await openCart(page);
    await expect(drawer.getByTestId("cart-line-price")).toHaveText("18 000 F");

    // WeCreate publishes again while the drawer is open, so the amount on
    // screen is no longer the amount on sale. Accepting must not agree to the
    // one the shopper has never been shown.
    await content.editDraft({
      boutique: { products: [sampleProduct({ priceXof: 22000 })] },
    });
    await content.publish();

    await drawer.getByTestId("cart-acknowledge-prices").click();

    await expect(drawer.getByTestId("cart-line-price")).toHaveText("22 000 F");
    await expect(drawer.getByTestId("cart-price-change-notice")).toBeVisible();
    await expect(drawer.getByTestId("cart-state")).toHaveText(
      "Acceptez les nouveaux prix pour continuer.",
    );
    expect(await storedCartValue(page)).toBe('[["lut-04",14000]]');

    // Asked again with the figure that is actually on sale, and accepted.
    await drawer.getByTestId("cart-acknowledge-prices").click();
    await expect(drawer.getByTestId("cart-state")).toHaveText(
      "Votre panier est prêt.",
    );
    expect(await storedCartValue(page)).toBe('[["lut-04",22000]]');
  });
});

test.describe("Leaving for checkout", () => {
  test("reaches the checkout route, which stays out of search results", async ({
    page,
  }) => {
    await sell(page, [LUT]);
    await arriveWithCart(page, [[LUT.id, LUT.priceXof]]);

    await page.goto("/boutique");
    const drawer = await openCart(page);
    await drawer.getByTestId("cart-checkout").click();

    await expect(page).toHaveURL(/\/commande$/);
    // Guest checkout, with the cart that arrived resolved into a ticket. What
    // the checkout then does with it is `checkout.spec.ts`.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Où devons-nous livrer vos fichiers ?",
    );
    await expect(page.getByTestId("ticket-total")).toHaveText("14 000 F");
    expect(await robots(page)).toContain("noindex");

    // The cart came along, and the drawer closed behind it.
    await expect(cartDrawer(page)).toBeHidden();
    await expect(cartIndicator(page)).toHaveAccessibleName("Panier, 1 article");
  });
});

test.describe("The cart without animation", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("opens, reads and closes exactly the same", async ({ page }) => {
    await arriveWithCart(page, [["ebk-01", 15000]]);
    await page.goto("/");

    const drawer = await openCart(page);
    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    // The panel fades in. With motion switched off the fade is reduced to
    // nothing, and the one thing that must not survive that is a drawer left
    // sitting at the animation's opening frame.
    await expect(drawer).toHaveCSS("opacity", "1");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});

test.describe("The cart drawer for a keyboard", () => {
  test("keeps focus inside it and hands it back on Escape", async ({ page }) => {
    await arriveWithCart(page, [["ebk-01", 15000]]);
    await page.goto("/");

    const indicator = cartIndicator(page);
    const drawer = await openCart(page);
    await expect(
      drawer.getByRole("button", { name: "Fermer le panier" }),
    ).toBeFocused();

    // A cart with products in it has more to tab through than an empty one —
    // the product link, its removal, the checkout action — and none of it may
    // land on the page behind.
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("Tab");
      await expect(drawer.locator(":focus")).toHaveCount(1);
    }

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(indicator).toBeFocused();
  });

  test("stays a trap after the control being used disappears", async ({
    page,
  }) => {
    // Removing a line takes the button that was pressed with it, so focus falls
    // to the document body. Tab from there has to come back into the drawer, or
    // the next press walks onto the catalogue behind it.
    await sell(page, [LUT, EBOOK]);
    await arriveWithCart(page, [
      [LUT.id, LUT.priceXof],
      [EBOOK.id, EBOOK.priceXof],
    ]);
    await page.goto("/boutique");

    const drawer = await openCart(page);
    const remove = drawer
      .getByTestId("cart-line")
      .filter({ hasText: "Cadrage mobile" })
      .getByTestId("cart-line-remove");

    await remove.focus();
    await page.keyboard.press("Enter");
    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);

    await page.keyboard.press("Tab");
    await expect(drawer.locator(":focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(cartIndicator(page)).toBeFocused();
  });
});

test.describe("The cart drawer on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "Covers the mobile layout only.");

  test("scrolls its products while checkout stays anchored", async ({
    page,
  }) => {
    // Six products is more than a phone's drawer can show at once, which is the
    // case the anchored action exists for.
    await arriveWithCart(
      page,
      SHIPPED_PRODUCT_IDS.map((id) => [id, 15000] as [string, number]),
    );
    await page.goto("/boutique");

    const drawer = await openCart(page);
    await expect(drawer.getByTestId("cart-line")).toHaveCount(6);

    const list = page.getByTestId("digital-cart-drawer-body");
    const overflow = await list.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    );
    expect(overflow).toBeGreaterThan(0);

    const checkout = drawer.getByTestId("cart-checkout");
    await expect(checkout).toBeInViewport();
    const anchored = (await checkout.boundingBox())!.y;

    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(
      0,
    );
    await expect(checkout).toBeInViewport();
    // Anchored, not pixel-perfect: what matters is that it did not travel with
    // the list. A phone's device pixel ratio leaves sub-pixel rounding behind.
    expect(
      Math.abs((await checkout.boundingBox())!.y - anchored),
    ).toBeLessThan(2);

    // The page behind is held still, so dismissing the drawer does not land the
    // visitor somewhere else in the catalogue.
    expect(
      await page.evaluate(() => document.body.style.overflow),
    ).toBe("hidden");
  });

  test("lays the drawer out without scrolling sideways", async ({ page }) => {
    await arriveWithCart(page, [["ebk-01", 15000]]);
    await page.goto("/boutique");
    await openCart(page);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("The cart drawer on a wide screen", () => {
  test.skip(({ isMobile }) => isMobile, "Covers the desktop layout only.");

  test("closes when the page behind it is pressed", async ({ page }) => {
    await arriveWithCart(page, [["ebk-01", 15000]]);
    await page.goto("/");

    const indicator = cartIndicator(page);
    const drawer = await openCart(page);

    // Dismissing by pressing outside is a deliberate control, not an accident
    // of layout: the backdrop is its own element and it closes the panel.
    await page.mouse.click(100, 400);
    await expect(drawer).toBeHidden();
    await expect(indicator).toBeFocused();
  });
});
