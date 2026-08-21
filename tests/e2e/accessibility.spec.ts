import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { arriveWithCart, openCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

/**
 * Automated WCAG checks on representative public states.
 *
 * Colour contrast is owned by `contrast.spec.ts`, which samples painted hero
 * pixels axe cannot see. Keyboard operation of drawers, filters, comparison
 * and legal history lives in those pages' own specs. This file is the axe
 * sweep across the six public views plus a dialog, a filter, a table and the
 * cart drawer — the representative states issue #16 asks for.
 */

const PUBLIC_VIEWS = [
  "/",
  "/portfolio",
  "/services",
  "/boutique",
  "/boutique/color-grading-signature",
  "/a-propos",
  "/contact",
  "/legal/conditions-generales-de-vente",
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

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .disableRules(["color-contrast"])
    .analyze();

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual(
    [],
  );
}

test.describe("Automated accessibility", () => {
  for (const path of PUBLIC_VIEWS) {
    test(`${path} has no WCAG 2.2 AA violations axe can see`, async ({
      page,
    }) => {
      await page.goto(path);
      await expectNoAxeViolations(page);
    });
  }

  test("the portfolio dialog has no WCAG 2.2 AA violations axe can see", async ({
    page,
  }) => {
    await page.goto("/portfolio");
    await page.getByRole("link", { name: /Résidence Aurora/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Résidence Aurora" }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a narrowed Boutique and an open cart have no WCAG 2.2 AA violations axe can see", async ({
    page,
  }) => {
    await arriveWithCart(page, [["ebk-01", 15000]]);
    await page.goto("/boutique");
    await page.getByRole("button", { name: "Ebooks & Guides" }).click();
    await openCart(page);
    await expectNoAxeViolations(page);
  });
});
