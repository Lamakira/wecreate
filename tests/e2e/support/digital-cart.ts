import { expect, type Cookie, type Page } from "@playwright/test";

import { BASE_URL } from "../../../playwright.config";

/**
 * The Digital Cart as a browser carries it between visits.
 *
 * The one place the acceptance suite touches a cookie rather than a control,
 * and for two reasons that are themselves under test. A cart that survives a
 * closed browser for thirty days cannot be demonstrated by clicking; and a
 * cookie a visitor has edited is exactly the input the shop has to be safe
 * against, so a test has to be able to write one the application never wrote.
 *
 * The value below is the wire format spelled out by hand rather than imported
 * from `src/`, so a change to how the cart is stored has to be a deliberate
 * change to this file too.
 */

export const CART_COOKIE = "wc_cart";

/** One line as the cookie holds it: an identifier, and the price accepted for it. */
export type StoredCartLine = [id: string, acknowledgedPriceXof: number];

/** Arrive carrying a cart, the way a shopper coming back tomorrow does. */
export async function arriveWithCart(
  page: Page,
  lines: readonly StoredCartLine[],
): Promise<void> {
  await arriveWithRawCart(page, JSON.stringify(lines));
}

/** The same, for a value no application would ever have written. */
export async function arriveWithRawCart(
  page: Page,
  value: string,
): Promise<void> {
  await page.context().addCookies([
    {
      name: CART_COOKIE,
      // Percent-encoded, which is how a cookie carries a value containing
      // anything but the simplest characters — and what the server decodes.
      value: encodeURIComponent(value),
      url: BASE_URL,
    },
  ]);
}

/** The cart cookie this browser is holding, if any. */
export async function storedCart(page: Page): Promise<Cookie | undefined> {
  return (await page.context().cookies()).find(
    (cookie) => cookie.name === CART_COOKIE,
  );
}

/** What the stored cart says, as it was written. */
export async function storedCartValue(page: Page): Promise<string | undefined> {
  const cookie = await storedCart(page);
  return cookie ? decodeURIComponent(cookie.value) : undefined;
}

export function cartDrawer(page: Page) {
  return page.getByTestId("digital-cart-drawer");
}

export function cartIndicator(page: Page) {
  return page.getByTestId("digital-cart-indicator");
}

/** Open the cart the way a shopper does, and wait for the shop to answer. */
export async function openCart(page: Page) {
  await cartIndicator(page).click();
  const drawer = cartDrawer(page);
  await expect(drawer).toBeVisible();

  // The panel fades and slides in over 0.45s. Measuring anything inside it
  // before that finishes reads a position it is about to leave, which is a
  // flake rather than a finding.
  await drawer.evaluate((panel) =>
    Promise.all(panel.getAnimations().map((animation) => animation.finished)),
  );

  await expect(drawer).toHaveAttribute("aria-busy", "false");
  return drawer;
}
