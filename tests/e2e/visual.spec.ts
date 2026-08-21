import { expect, test } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

/**
 * Visual references for the six public views.
 *
 * Reduced motion is on so the generated hero, the marquee and the scroll
 * reveals cannot drift between runs. Intentional divergence from the handoff
 * — corrected greys, the skip link, the grain overlay — is accepted here;
 * pixel identity with the throwaway HTML is not the assertion.
 */

const VIEWS = [
  { name: "accueil", path: "/" },
  { name: "portfolio", path: "/portfolio" },
  { name: "services", path: "/services" },
  { name: "boutique", path: "/boutique" },
  { name: "a-propos", path: "/a-propos" },
  { name: "contact", path: "/contact" },
] as const;

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
  await content.editDraft({
    portfolio: { projects: SAMPLE_PORTFOLIO_PROJECTS },
  });
  await content.publish();
});

test.afterEach(async () => {
  await content.reset();
});

test.describe("Public visual references", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Snapshots are Chromium-only; Firefox and WebKit cover journeys separately.",
  );

  for (const view of VIEWS) {
    test(`${view.name} matches its reference`, async ({ page }) => {
      await page.goto(view.path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveScreenshot(`${view.name}.png`, {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
