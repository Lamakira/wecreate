import { expect, test } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

/**
 * Critical public journeys, run on Firefox and WebKit as well as Chromium.
 *
 * The rest of the suite stays on the Chromium desktop/mobile pair. These
 * walks are the cross-browser matrix issue #1 asks for at acceptable cost.
 * Real Mobile Safari and a physical Android are documented as a manual pass
 * (GitHub Student Pack: BrowserStack Automate Mobile, LambdaTest Live).
 */

const VIEWS = [
  "/",
  "/portfolio",
  "/services",
  "/boutique",
  "/a-propos",
  "/contact",
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

test.describe("Public journeys", () => {
  test("reaches every public view and reads a product", async ({ page }) => {
    test.setTimeout(90_000);
    for (const path of VIEWS) {
      const response = await page.goto(path);
      expect(response?.ok(), path).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
    }

    await page.goto("/boutique");
    await page.getByRole("link", { name: /Color Grading Signature/ }).click();
    await expect(page).toHaveURL(/\/boutique\/color-grading-signature$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Color Grading Signature",
    );
  });

  test("opens a Portfolio Project and a Service Enquiry destination", async ({
    page,
  }) => {
    await page.goto("/portfolio");
    await page.getByRole("link", { name: /Résidence Aurora/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Résidence Aurora" }),
    ).toBeVisible();
    await expect(page.getByTestId("project-player")).toBeVisible();

    await page.goto("/contact");
    const whatsapp = page
      .getByTestId("contact-channel")
      .getByRole("link", { name: /WhatsApp/ });
    await expect(whatsapp).toHaveAttribute("href", "https://wa.me/2290167366726");
    await expect(whatsapp).toHaveAttribute("target", "_blank");
  });

  test("keeps checkout out of search results", async ({ page }) => {
    await page.goto("/commande");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
