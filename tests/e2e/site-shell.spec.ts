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

  test("reaches every page in the navigation", async ({ page, isMobile }) => {
    await page.goto("/");

    if (isMobile) {
      await page.getByTestId("navigation-menu-button").click();
    }
    const nav = page.getByRole("navigation", {
      name: isMobile ? "Navigation mobile" : "Navigation principale",
    });
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

  test("marks the page the visitor is on", async ({ page, isMobile }) => {
    await page.goto("/portfolio");

    if (isMobile) {
      await page.getByTestId("navigation-menu-button").click();
    }
    const nav = page.getByRole("navigation", {
      name: isMobile ? "Navigation mobile" : "Navigation principale",
    });
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

  test("lines every band up with the header logo", async ({ page }) => {
    await page.goto("/");

    // The logo sets the page's left edge. Header, hero, each section and the
    // footer all have to start there — they are separate full-width bands, and
    // it is easy for one of them to acquire its own padding and drift a few
    // dozen pixels out on a wide screen without anyone noticing.
    const leftEdgeOf = async (locator: ReturnType<typeof page.locator>) => {
      const box = await locator.first().boundingBox();
      return Math.round(box!.x);
    };

    const logo = await leftEdgeOf(
      page.getByRole("banner").getByRole("link", { name: "WeCreate — accueil" }),
    );

    const bands = {
      "hero heading": page.getByRole("heading", { level: 1 }),
      "section heading": page.getByRole("heading", {
        level: 2,
        name: "Ce qu'on fait",
      }),
      "light band heading": page.getByRole("heading", {
        level: 2,
        name: "La différence WeCreate",
      }),
      "footer logo": page.getByRole("contentinfo").locator("img").first(),
      "footer legal line": page.getByText("WeCreate — Calavi Tankpè, Bénin"),
    };

    for (const [name, locator] of Object.entries(bands)) {
      await locator.scrollIntoViewIfNeeded();
      expect(await leftEdgeOf(locator), `${name} should start at the logo`).toBe(
        logo,
      );
    }
  });

  test("starts page content below the fixed header", async ({ page }) => {
    // The header is fixed, so it covers whatever is beneath it. Page content is
    // pushed clear by a padding token, and the two drift apart easily — the
    // header's height changes with its breakpoint and its call CTA.
    await page.goto("/portfolio");

    const measurements = await page.evaluate(() => ({
      headerHeight: document.querySelector("header")!.getBoundingClientRect()
        .height,
      offset: Number.parseFloat(
        getComputedStyle(document.querySelector("main")!).paddingTop,
      ),
    }));

    expect(measurements.offset).toBeGreaterThanOrEqual(
      measurements.headerHeight,
    );
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

  test("puts all six links and the call CTA in the menu panel", async ({
    page,
  }) => {
    await page.goto("/");

    // Six links do not fit across a phone, so the header shows a menu button
    // instead of clipping them. Nothing is merely scrolled out of sight.
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }),
    ).toBeHidden();

    const menuButton = page.getByTestId("navigation-menu-button");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await menuButton.click();

    const panel = page.getByTestId("navigation-drawer");
    await expect(panel).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    // Every link is on screen at a tap size, not behind an invisible swipe.
    const links = panel.getByRole("navigation").getByRole("link");
    await expect(links).toHaveCount(6);
    for (const name of ["Accueil", "Contact"]) {
      const link = links.filter({ hasText: name });
      await expect(link).toBeInViewport();
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    // The call CTA is dropped from the header below 1120px; the panel is where
    // it goes, so it is never simply lost.
    await expect(
      panel.getByRole("link", { name: "Réserver un appel" }),
    ).toBeVisible();
  });

  test("closes the menu after following a link", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("navigation-menu-button").click();
    await page
      .getByTestId("navigation-drawer")
      .getByRole("link", { name: "Services" })
      .click();

    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByTestId("navigation-drawer")).toBeHidden();
  });

  test("returns focus to the menu button when dismissed", async ({ page }) => {
    await page.goto("/");

    const menuButton = page.getByTestId("navigation-menu-button");
    await menuButton.click();
    await expect(
      page.getByTestId("navigation-drawer").getByRole("button"),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("navigation-drawer")).toBeHidden();
    await expect(menuButton).toBeFocused();
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
