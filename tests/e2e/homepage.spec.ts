import { expect, test } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
  // No Portfolio Project ships in application source, so a populated reel is
  // something a test publishes, exactly as an editor would. It is not its own
  // list either: *Travaux récents* is the first few Portfolio Projects, so
  // publishing the portfolio is what fills it. `resilience.spec.ts` covers the
  // unpopulated state.
  //
  // Nothing seeds the Boutique teaser: the six Digital Products are WeCreate's
  // own and ship as content, and the teaser shows the ones marked featured.
  await content.editDraft({
    portfolio: { projects: SAMPLE_PORTFOLIO_PROJECTS },
  });
  await content.publish();
});

test.afterEach(async () => {
  await content.reset();
});

test.describe("Homepage", () => {
  test("opens with WeCreate's positioning and two ways into the site", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(
      "WeCreate — Production vidéo cinématographique",
    );

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Nous fabriquons des œuvres qui font vendre.");
    // The accent word is italicised inside the same heading, so the phrase is
    // announced once rather than split into fragments.
    await expect(heading.locator("em")).toHaveText("œuvres");

    await expect(
      page.getByText("Production vidéo cinématographique", { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Voir le portfolio" }),
    ).toHaveAttribute("href", "/portfolio");
    await expect(
      page.getByRole("link", { name: "Découvrir la boutique" }),
    ).toHaveAttribute("href", "/boutique");
  });

  test("presents the three service universes", async ({ page }) => {
    await page.goto("/");

    const section = page.getByRole("region", { name: "Ce qu'on fait" });
    await expect(section.getByRole("listitem")).toHaveCount(3);

    for (const universe of ["Entreprises", "Immobilier", "Mariage"]) {
      await expect(
        section.getByRole("heading", { level: 3, name: universe }),
      ).toBeVisible();
    }

    await expect(
      section.getByRole("link", { name: /Entreprises/ }),
    ).toHaveAttribute("href", "/services");
  });

  test("shows recent Portfolio Projects with their client and engagement", async ({
    page,
  }) => {
    await page.goto("/");

    const section = page.getByRole("region", { name: /Travaux récents/ });
    await expect(section.getByRole("listitem")).toHaveCount(6);
    await expect(section.getByText("Résidence Aurora")).toBeVisible();
    await expect(section.getByText("Aurora Stays · Visite premium")).toBeVisible();
    await expect(
      section.getByRole("link", { name: /Résidence Aurora/ }),
    ).toHaveAttribute("href", "/portfolio/residence-aurora");
    await expect(
      section.getByRole("link", { name: "Tout le portfolio" }),
    ).toHaveAttribute("href", "/portfolio");
  });

  test("states the four proof points on the light band", async ({ page }) => {
    await page.goto("/");

    const section = page.getByRole("region", { name: "La différence WeCreate" });
    await expect(section.getByRole("listitem")).toHaveCount(4);
    await expect(
      section.getByText("Livraison en 5 jours ouvrés après le tournage. Sans relance."),
    ).toBeVisible();
  });

  test("teases Digital Products in whole XOF without offering a purchase", async ({
    page,
  }) => {
    await page.goto("/");

    const section = page.getByRole("region", { name: "La boutique" });
    await expect(section.getByRole("listitem")).toHaveCount(3);

    // 15000 XOF, written the French way with a non-breaking thousands separator.
    await expect(
      section.getByText("15\u00A0000\u00A0F", { exact: true }),
    ).toBeVisible();

    // Nothing is purchase-enabled before the Commerce Launch Gate, so the
    // teaser must not offer to add anything to the Digital Cart.
    await expect(
      section.getByRole("button", { name: /panier|ajouter/i }),
    ).toHaveCount(0);
    await expect(
      section.getByRole("link", { name: "Color Grading Signature — Voir le détail" }),
    ).toHaveAttribute("href", "/boutique/color-grading-signature");
  });

  test("closes with the brand quote and a route into a conversation", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByText(
        "« Ils n'ont pas filmé nos appartements. Ils les ont rendus désirables. »",
      ),
    ).toBeVisible();

    const finalCta = page.getByRole("region", { name: /Parlons de votre projet/ });
    await expect(
      finalCta.getByRole("link", { name: "WhatsApp", exact: true }),
    ).toHaveAttribute("href", "https://wa.me/2290167366726");
    await expect(
      finalCta.getByRole("link", { name: "Nous contacter" }),
    ).toHaveAttribute("href", "/contact");
  });

  test("fills the viewport, background and all", async ({ page }) => {
    await page.goto("/");

    // The hero is the first thing a visitor sees and it owns the whole screen:
    // it starts at the very top, behind the translucent header, and runs to the
    // bottom edge with no band of anything else showing.
    const measurements = await page.evaluate(() => {
      const hero = document
        .querySelector('[data-testid="hero"]')!
        .getBoundingClientRect();
      return {
        viewportHeight: window.innerHeight,
        heroTop: Math.round(hero.top),
        heroHeight: Math.round(hero.height),
      };
    });

    expect(measurements.heroTop).toBe(0);
    expect(measurements.heroHeight).toBeGreaterThanOrEqual(
      measurements.viewportHeight,
    );
  });

  test("reveals a section once it scrolls into view", async ({ page }) => {
    // Worth asserting explicitly: the reveal starts at `opacity: 0`, and
    // Playwright counts a fully transparent element as visible. Without this,
    // a reveal that never completed would pass every other test in this file
    // while showing the visitor a blank page.
    await page.goto("/");

    const heading = page.getByRole("heading", { level: 2, name: "La boutique" });
    await heading.scrollIntoViewIfNeeded();

    await expect
      .poll(
        () =>
          heading.evaluate((element) => {
            const revealed = element.closest(".wc-reveal") ?? element;
            return Number(getComputedStyle(revealed).opacity);
          }),
        { timeout: 10_000 },
      )
      .toBe(1);
  });

  test("never contacts a transactional service from the browser", async ({
    page,
    baseURL,
  }) => {
    // Public browsing must stay off Supabase and every other transactional
    // dependency (ADR-0003), and must not hand a third party the visitor's
    // connection either. Everything the page needs comes from our own origin.
    const origin = new URL(baseURL!).origin;
    const foreignRequests: string[] = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(origin)) {
        foreignRequests.push(request.url());
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });

    expect(foreignRequests).toEqual([]);
  });
});
