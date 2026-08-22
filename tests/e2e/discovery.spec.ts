import { expect, test } from "@playwright/test";

import { ManagedContent, enterPreview, leavePreview } from "./support/managed-content";
import { approvedLegalDocuments } from "./support/sample-content";
import { graphOfType, jsonLdGraphs, robotsMeta } from "./support/seo";

/**
 * Public discovery: what a crawler, a keyboard, and a zoomed viewport get.
 *
 * Contrast, motion, drawers and filters live in the page specs that own those
 * surfaces. This file is the remaining launch bar: skip link, preview
 * exclusion, robots/sitemap completeness, structured data, and reflow at the
 * WCAG 1.4.10 width.
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
  // Shipped legal text is a placeholder, kept out of the sitemap. The public
  // views this file walks include a legal page a crawler should see, so the
  // suite seeds the approved revision an editor would publish past the gate.
  await content.editDraft({ legalDocuments: approvedLegalDocuments() });
  await content.publish();
});

test.afterEach(async () => {
  await content.reset();
});

test.describe("Skip to content", () => {
  test("is the first tab stop and jumps past the header", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu" });
    await expect(skip).toBeFocused();

    await skip.press("Enter");
    await expect(page).toHaveURL(/#contenu$/);
    await expect(page.locator("#contenu")).toBeVisible();
  });
});

test.describe("Preview stays out of search results", () => {
  test("marks an ordinary public page noindex while preview is open", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await robotsMeta(page)).not.toContain("noindex");

    await enterPreview(page, "/");
    expect(await robotsMeta(page)).toContain("noindex");
    await expect(page.getByTestId("draft-mode-banner")).toBeVisible();

    await leavePreview(page);
    await page.goto("/");
    expect(await robotsMeta(page)).not.toContain("noindex");
  });
});

test.describe("Crawling rules", () => {
  test("lists the public views and keeps staff and transaction surfaces out", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap:");
    expect(robots).toContain("Disallow: /studio/");
    expect(robots).toContain("Disallow: /commerce/");
    expect(robots).toContain("Disallow: /commande/");
    expect(robots).toContain("Disallow: /api/");

    const sitemap = await (await request.get("/sitemap.xml")).text();
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );
    expect(paths).toEqual(expect.arrayContaining([...PUBLIC_VIEWS]));
    expect(sitemap).not.toContain("/studio");
    expect(sitemap).not.toContain("/commerce");
    expect(sitemap).not.toContain("/commande");
  });

  test("keeps checkout, payment return and Order Access out of the index", async ({
    page,
  }) => {
    for (const path of ["/commande", "/commande/retour", "/commande/acces"]) {
      await page.goto(path);
      expect(await robotsMeta(page), path).toContain("noindex");
    }
  });
});

test.describe("Metadata and structured data", () => {
  test("gives the homepage a canonical URL, Open Graph locale and local business graph", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https?:\/\/[^/]+\/?$/,
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      "content",
      "fr_BJ",
    );
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "WeCreate",
    );

    const business = graphOfType(await jsonLdGraphs(page), "LocalBusiness");
    expect(business.name).toBe("WeCreate");
    expect(business.email).toBe("wecreate08@gmail.com");
    expect(business.telephone).toBe("+2290167366726");
    const address = business.address as Record<string, string>;
    expect(address.addressLocality).toBe("Calavi Tankpè");
    expect(address.addressCountry).toBe("BJ");
    expect(business.sameAs).toEqual([
      "https://instagram.com/wecreate.bj",
      "https://tiktok.com/@wecreate.bj",
    ]);
  });

  test("describes a Digital Product as an offer without inventing reviews", async ({
    page,
  }) => {
    await page.goto("/boutique/color-grading-signature");

    const product = graphOfType(await jsonLdGraphs(page), "Product");
    expect(product.name).toBe("Color Grading Signature");
    expect(product.sku).toBe("EBK-01");
    expect(product.aggregateRating).toBeUndefined();
    expect(product.review).toBeUndefined();

    const offer = product.offers as Record<string, string>;
    expect(offer["@type"]).toBe("Offer");
    expect(offer.priceCurrency).toBe("XOF");
    expect(offer.price).toBe("15000");
    expect(offer.availability).toBe("https://schema.org/PreOrder");
  });
});

test.describe("Reflow", () => {
  test("keeps the six public views readable at 320 CSS pixels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });

    for (const path of PUBLIC_VIEWS) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1 }),
        path,
      ).toBeVisible();

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `${path} should not require sideways scrolling`,
      ).toBeLessThanOrEqual(1);
    }
  });
});
