import { expect, test } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";

test.beforeEach(async ({ request }) => {
  await new ManagedContent(request).reset();
});

test.describe("Site shell", () => {
  test("keeps the header in view while the page scrolls", async ({ page }) => {
    await page.goto("/");

    const header = page.getByRole("banner");
    await expect(header).toBeVisible();

    await page.mouse.wheel(0, 2000);
    await expect(header).toBeInViewport();
    await expect(
      page.getByRole("link", { name: "WeCreate — accueil" }),
    ).toBeVisible();
  });

  test("reaches every page in the navigation", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    const links = await nav.getByRole("link").all();
    expect(links).toHaveLength(6);

    const destinations = await Promise.all(
      links.map((link) => link.getAttribute("href")),
    );
    expect(destinations).toEqual([
      "/",
      "/portfolio",
      "/services",
      "/boutique",
      "/a-propos",
      "/contact",
    ]);

    // A navigation that 404s is not a navigation. Every destination resolves
    // and renders inside the shell, whether or not its ticket has landed.
    for (const href of destinations) {
      const response = await page.goto(href!);
      expect(response?.status(), `${href} should resolve`).toBe(200);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
    }
  });

  test("marks the page the visitor is on", async ({ page }) => {
    await page.goto("/portfolio");

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: "Portfolio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Accueil" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("announces the Digital Cart count and opens the drawer", async ({
    page,
  }) => {
    await page.goto("/");

    const indicator = page.getByTestId("digital-cart-indicator");
    await expect(indicator).toHaveAccessibleName("Panier, 0 articles");

    await indicator.click();

    const drawer = page.getByTestId("digital-cart-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(drawer.getByText("Votre panier est vide.")).toBeVisible();

    // Focus lands inside the dialog and stays there: tabbing round the panel
    // must not land on the page behind it.
    await expect(
      drawer.getByRole("button", { name: "Fermer le panier" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(drawer.locator(":focus")).toHaveCount(1);

    // Escape closes it, and focus returns to the control that opened it rather
    // than to the top of the document.
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(indicator).toBeFocused();
  });

  test("carries WeCreate's contact routes in the footer", async ({ page }) => {
    await page.goto("/");

    const footer = page.getByRole("contentinfo");
    await expect(
      footer.getByRole("link", { name: "WhatsApp +229 01 67 36 67 26" }),
    ).toHaveAttribute("href", "https://wa.me/2290167366726");
    await expect(
      footer.getByRole("link", { name: "wecreate08@gmail.com" }),
    ).toHaveAttribute("href", "mailto:wecreate08@gmail.com");
    await expect(
      footer.getByText("Calavi Tankpè, Bénin", { exact: true }),
    ).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Instagram @wecreate.bj" }),
    ).toBeVisible();
  });

  test("serves the brand typefaces from WeCreate's own origin", async ({
    request,
  }) => {
    // Self-hosted rather than fetched from a third party, so a Benin mobile
    // connection makes one fewer DNS lookup and TLS handshake before text
    // paints.
    for (const font of [
      "/fonts/inter-latin.woff2",
      "/fonts/playfair-display-latin.woff2",
      "/fonts/playfair-display-italic-latin.woff2",
    ]) {
      const response = await request.get(font);
      expect(response.status(), `${font} should be served`).toBe(200);
      expect(response.headers()["content-type"]).toContain("font/woff2");
    }
  });
});

test.describe("Site shell on a narrow screen", () => {
  test.skip(({ isMobile }) => !isMobile, "Covers the mobile layout only.");

  test("keeps the six navigation links reachable without the call CTA", async ({
    page,
  }) => {
    await page.goto("/");

    // Below 1120px the call CTA is dropped. Navigation is never collapsed
    // behind a menu button, so all six links stay operable — the strip scrolls
    // horizontally instead.
    await expect(
      page.getByRole("link", { name: "Réserver un appel" }),
    ).toBeHidden();

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link")).toHaveCount(6);

    const contact = nav.getByRole("link", { name: "Contact" });
    await contact.scrollIntoViewIfNeeded();
    await expect(contact).toBeInViewport();
  });

  test("lays the homepage out without sideways scrolling", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
