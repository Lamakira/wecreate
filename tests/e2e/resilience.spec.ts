import { expect, test } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { SAMPLE_HERO_PLAYBACK } from "./support/sample-content";

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

test.describe("The homepage without its optional layers", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("stays complete and still when motion is switched off", async ({
    page,
  }) => {
    await page.goto("/");

    // Everything the page is for is still there.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ce qu'on fait" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Travaux récents/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Voir le portfolio" }),
    ).toBeVisible();

    // Sections that reveal on scroll are revealed, not stuck invisible.
    const opacity = await page
      .getByRole("heading", { level: 2, name: "Ce qu'on fait" })
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBe(1);

    // And the marquee, the one thing that moves continuously, has stopped —
    // measured by whether it actually travels, not by whether an animation
    // object exists.
    const track = page.getByTestId("positioning-marquee-track");
    const before = await track.boundingBox();
    await page.waitForTimeout(500);
    const after = await track.boundingBox();
    expect(after?.x).toBeCloseTo(before?.x ?? 0, 1);
  });

  test("does not render the generated hero background", async ({ page }) => {
    await page.goto("/");

    // The WebGL background is decorative and continuous. It is not merely
    // paused for these visitors — the module is never loaded, so a metered
    // connection is not charged for a renderer it will not use.
    await expect(page.getByTestId("hero-background")).toHaveCount(0);

    // The hero still looks finished: its gradient is the design's baseline.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Voir le portfolio" }),
    ).toBeVisible();
  });

  test("does not download the optional hero loop", async ({ page }) => {
    await content.editDraft({
      homePage: { hero: { playbackAsset: SAMPLE_HERO_PLAYBACK } },
    });
    await content.publish();

    await page.goto("/");

    // Suppressing playback after the download has started would not help a
    // metered connection, so the element is never rendered at all.
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("The homepage before any real work is published", () => {
  test("keeps its sections and says plainly that content is coming", async ({
    page,
  }) => {
    // The shipped state, and the state a freshly configured Sanity project
    // starts in: the editorial chrome exists, but no Portfolio Project or
    // Digital Product has been approved yet. WeCreate never shows placeholder
    // work as if it were real, so the sections state the truth instead.
    await page.goto("/");

    await expect(page.getByTestId("recent-work-empty")).toHaveText(
      "Les projets publiés apparaîtront ici dès leur mise en ligne.",
    );
    await expect(page.getByTestId("shop-preview-empty")).toHaveText(
      "Les produits numériques apparaîtront ici dès leur mise en vente.",
    );

    // The routes into the rest of the site survive the empty state.
    await expect(
      page.getByRole("link", { name: "Tout le portfolio" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Tout voir" })).toBeVisible();
  });
});

test.describe("The homepage without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still tells the visitor who WeCreate is and how to reach them", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nous fabriquons des œuvres qui font vendre.",
    );
    await expect(page.getByRole("region", { name: "La boutique" })).toBeVisible();
    await expect(
      page
        .getByRole("contentinfo")
        .getByRole("link", { name: "WhatsApp +229 01 67 36 67 26" }),
    ).toBeVisible();

    // Scroll-reveal is decoration applied by script; without it, content is
    // simply visible rather than permanently hidden.
    const opacity = await page
      .getByRole("heading", { level: 2, name: "La boutique" })
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBe(1);
  });
});

test.describe("The optional hero loop", () => {
  test.beforeEach(async () => {
    await content.editDraft({
      homePage: { hero: { playbackAsset: SAMPLE_HERO_PLAYBACK } },
    });
    await content.publish();
  });

  test("starts by itself only where a pointer says it is a desktop", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");

    if (isMobile) {
      // A metered mobile connection is never spent without being asked. The
      // poster stands in until the visitor chooses playback.
      await expect(page.locator("video")).toHaveCount(0);
      const start = page.getByTestId("hero-playback-start");
      await expect(start).toBeVisible();

      await start.click();
      await expect(page.getByTestId("hero-playback")).toBeAttached();
    } else {
      await expect(page.getByTestId("hero-playback")).toBeAttached();
      await expect(page.getByTestId("hero-playback-start")).toHaveCount(0);
    }

    // Either way the hero reads the same.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("The generated hero background", () => {
  test("renders behind the hero when motion is allowed", async ({ page }) => {
    await page.goto("/");

    const backdrop = page.getByTestId("hero-background");
    await expect(backdrop).toBeAttached();
    await expect(backdrop.locator("canvas")).toBeAttached();

    // Decorative: it carries no meaning and is kept out of the accessibility
    // tree, so the heading above it is what a screen reader encounters.
    await expect(backdrop).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
