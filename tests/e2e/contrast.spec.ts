import { expect, test } from "@playwright/test";

import {
  collectText,
  expectHeroMeetsAa,
  expectMeetsAa,
} from "./support/contrast";
import { arriveWithCart, openCart } from "./support/digital-cart";
import { ManagedContent } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

/**
 * Text contrast, measured rather than assumed.
 *
 * The regression guard for a palette that needed correcting: the design
 * handoff's `#777` micro-labels reach 4.42:1 at best on this site's own
 * surfaces and 4.48:1 on its light band, and its `#555` footer text 2.8:1. None
 * meet WCAG 2.2 AA, and no single grey could — against both `#0A0A0A` and
 * `#FFFFFF` the best any grey manages is 4.39:1, which is why dark and light
 * surfaces carry separate tokens.
 *
 * Two techniques, because the page has two kinds of ground:
 *
 * - Flat surfaces are read from computed styles. Deterministic, and needs no
 *   screenshots.
 * - The hero is sampled from painted pixels, because its ground is a WebGL
 *   shader under a gradient scrim and no computed style describes it.
 */

test.describe("Text contrast", () => {
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

  test("every flat surface on the homepage meets WCAG AA", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(800);

    const texts = (await collectText(page)).filter((text) => !text.inHero);
    expect(texts.length).toBeGreaterThan(20);

    expectMeetsAa(texts);
  });

  test("the services page meets WCAG AA, light comparison band included", async ({
    page,
  }) => {
    // Services carries the site's second white band. Its table headers, row
    // labels and pack meta lines are the tertiary greys the palette had to
    // correct, on both grounds at once.
    await page.goto("/services");
    await page.waitForTimeout(800);

    const texts = await collectText(page);
    expect(texts.length).toBeGreaterThan(40);

    expectMeetsAa(texts);
  });

  test("À propos meets WCAG AA, light method band included", async ({ page }) => {
    // The trust page carries the site's third white band, and the greys that
    // needed correcting appear on both grounds at once: the method's step
    // numbers on white, the team and equipment meta lines on black.
    await page.goto("/a-propos");
    await page.waitForTimeout(800);

    const texts = await collectText(page);
    expect(texts.length).toBeGreaterThan(30);

    expectMeetsAa(texts);
  });

  test("the Boutique meets WCAG AA, on the white band it runs on", async ({
    page,
  }) => {
    // The Boutique is the site's one wholly light page: filters, cards, prices
    // and availability all sit on white, which is the ground `wc-text-muted` was
    // corrected for and cannot serve. The product page carries the same greys
    // again beside the licence and support blocks.
    await page.goto("/boutique");
    await page.waitForTimeout(800);

    expectMeetsAa(await collectText(page));

    await page.goto("/boutique/color-grading-signature");
    await page.waitForTimeout(800);

    const product = await collectText(page);
    expect(product.length).toBeGreaterThan(15);

    expectMeetsAa(product);
  });

  test("the Digital Cart drawer meets WCAG AA, refusals included", async ({
    page,
  }) => {
    // The drawer carries the site's only refusing control — a checkout action
    // that keeps its place and says why it will not move — plus the notices
    // beside a withdrawn product. All of it is tertiary grey on the panel's own
    // dark ground, and all of it is text a shopper has to read to get unstuck.
    await arriveWithCart(page, [
      ["ebk-01", 15000],
      ["pas-un-produit", 1],
    ]);
    await page.goto("/boutique");
    await openCart(page);
    await page.waitForTimeout(800);

    const texts = await collectText(page);
    expect(texts.length).toBeGreaterThan(20);

    expectMeetsAa(texts);
  });

  test("Contact meets WCAG AA", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForTimeout(800);

    const texts = await collectText(page);
    expect(texts.length).toBeGreaterThan(25);

    expectMeetsAa(texts);
  });

  test("a legal document meets WCAG AA, notices and history included", async ({
    page,
  }) => {
    // Legal pages carry text nothing else on the site does: the bordered
    // notices, the effective-date list with its micro-label terms, and the
    // revision identities in tertiary grey. All of it is text a visitor may
    // need to read carefully rather than skim.
    await page.goto("/legal/conditions-generales-de-vente");
    await page.waitForTimeout(800);

    const texts = await collectText(page);
    expect(texts.length).toBeGreaterThan(20);

    expectMeetsAa(texts);
  });

  test("the portfolio and its project dialog meet WCAG AA", async ({ page }) => {
    await page.goto("/portfolio");
    await page.getByRole("link", { name: /Résidence Aurora/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Résidence Aurora" }),
    ).toBeVisible();
    await page.waitForTimeout(800);

    // The dialog's own ground is `rgba(0,0,0,.94)` over the page, so its text is
    // measured with the dialog open rather than as a separate page.
    const texts = await collectText(page);
    expect(texts.length).toBeGreaterThan(10);

    expectMeetsAa(texts);
  });

  test("the hero meets WCAG AA over its generated background", async ({
    page,
  }) => {
    test.slow();

    await page.goto("/");
    await page.waitForTimeout(1500);

    await expectHeroMeetsAa(page);
  });
});
