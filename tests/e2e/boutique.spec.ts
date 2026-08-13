import { expect, test, type Page } from "@playwright/test";

import { ManagedContent, enterPreview, leavePreview } from "./support/managed-content";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * The Boutique: WeCreate's Digital Products, browsed and understood.
 *
 * Two things separate these pages from the rest of the site. What is on offer is
 * decided in two systems at once — WeCreate's intent to sell is Managed Content,
 * the file a buyer receives is not — so a product is *bientôt disponible* until
 * both agree, and nothing here can be bought while the licence is provisional
 * text and no Paid Deliverable Version exists. And a product outlives its own
 * listing: archiving withdraws it, renaming it moves it, and in both cases the
 * page a past order links to still has to answer.
 */

const BOUTIQUE = "/boutique";
const EBOOK = "/boutique/color-grading-signature";

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

/** What the page tells a crawler, or `""` when it says nothing. */
async function robots(page: Page): Promise<string> {
  const meta = page.locator('meta[name="robots"]');
  if ((await meta.count()) === 0) {
    return "";
  }
  return (await meta.first().getAttribute("content")) ?? "";
}

/** Every Boutique address the sitemap advertises. */
async function sitemapProductPaths(page: Page): Promise<string[]> {
  const response = await page.request.get("/sitemap.xml");
  const body = await response.text();
  return [...body.matchAll(/<loc>([^<]*\/boutique\/[^<]*)<\/loc>/g)].map(
    (match) => new URL(match[1]).pathname,
  );
}

test.describe("Browsing the Boutique", () => {
  test("offers WeCreate's six products and only its two families", async ({
    page,
  }) => {
    await page.goto(BOUTIQUE);

    await expect(page).toHaveTitle("Boutique · WeCreate");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Nos outils, entre vos mains.",
    );
    await expect(page.getByTestId("product-card")).toHaveCount(6);

    // The design prototype's third tab put a 350,000 F service pack in the same
    // cart as an ebook. Issue #1 removed it, and a service offer can never enter
    // the Digital Cart (ADR-0006).
    const filters = page.getByRole("group", {
      name: "Filtrer par famille de produits",
    });
    await expect(filters.getByRole("button")).toHaveCount(3);
    await expect(
      filters.getByRole("button", { name: /Packs Services/i }),
    ).toHaveCount(0);
  });

  test("narrows the catalogue to one product family", async ({ page }) => {
    await page.goto(BOUTIQUE);

    const filters = page.getByRole("group", {
      name: "Filtrer par famille de produits",
    });
    await filters.getByRole("button", { name: "LUTs & Presets" }).click();

    await expect(page.getByTestId("product-card")).toHaveCount(3);
    await expect(
      page.getByRole("heading", { name: "Teal & Orange Cinéma" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Color Grading Signature" }),
    ).toHaveCount(0);
    // The change is silent on screen, so it is announced.
    await expect(page.getByTestId("boutique-count")).toHaveText("3 produits");

    await filters.getByRole("button", { name: "Ebooks & Guides" }).click();
    await expect(page.getByTestId("product-card")).toHaveCount(3);
    await expect(
      page.getByRole("heading", { name: "Le Manuel du Créateur Mobile" }),
    ).toBeVisible();

    await filters.getByRole("button", { name: "Tous" }).click();
    await expect(page.getByTestId("product-card")).toHaveCount(6);
  });

  test("prices in whole XOF and offers no purchase before the launch gate", async ({
    page,
  }) => {
    await page.goto(BOUTIQUE);

    // 15000 XOF, written the French way with a non-breaking thousands separator.
    await expect(
      page.getByText("15 000 F", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("20 000 F", { exact: true })).toBeVisible();

    // No product is purchase-enabled, no licence is approved and no Paid
    // Deliverable Version exists, so every one of them says the same thing.
    const badges = page.getByTestId("product-availability");
    await expect(badges).toHaveCount(6);
    for (const badge of await badges.all()) {
      await expect(badge).toHaveAttribute("data-availability", "forthcoming");
      await expect(badge).toHaveText("Bientôt disponible");
    }

    // The design handoff puts an "Ajouter au panier" on every card. Nothing here
    // does — the Digital Cart arrives with issue #9, and a buy button that could
    // not take money would be worse than none. (The shell's cart indicator is
    // not part of the catalogue, so the grid is what is asserted.)
    await expect(
      page.getByTestId("boutique-grid").getByRole("button"),
    ).toHaveCount(0);
  });

  test("lists every product for a crawler, whatever the filter offers", async ({
    page,
  }) => {
    await page.goto(BOUTIQUE);

    // Filtering happens in the browser and never removes a product from the
    // document, so the three LUTs are reachable from this page before anyone
    // presses anything.
    await expect(
      page.getByRole("link", { name: /Teal & Orange Cinéma/ }),
    ).toHaveAttribute("href", "/boutique/teal-et-orange-cinema");

    expect(await sitemapProductPaths(page)).toEqual([
      EBOOK,
      "/boutique/signature-cinema",
      "/boutique/manuel-du-createur-mobile",
      "/boutique/pack-lut-signature-wecreate",
      "/boutique/teal-et-orange-cinema",
      "/boutique/ambiances-nostalgie-luxe-froid",
    ]);
  });

  test("browses without JavaScript, filters aside", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(BOUTIQUE);
    await expect(page.getByTestId("product-card")).toHaveCount(6);
    await page.getByRole("link", { name: /Color Grading Signature/ }).click();
    await expect(page).toHaveURL(EBOOK);

    await context.close();
  });
});

test.describe("A product page", () => {
  test("is crawlable at its own canonical address", async ({ page }) => {
    await page.goto(EBOOK);

    await expect(page).toHaveTitle("Color Grading Signature · WeCreate");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Color Grading Signature",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${EBOOK}$`),
    );
    expect(await robots(page)).not.toContain("noindex");
  });

  test("says what the product is, what it costs and who to ask", async ({
    page,
  }) => {
    await page.goto(EBOOK);

    await expect(
      page.getByText(
        "La méthode d'étalonnage cinéma signature WeCreate (DaVinci Resolve)",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("product-price")).toHaveText("15 000 F");
    await expect(page.getByTestId("product-availability")).toHaveText(
      "Bientôt disponible",
    );

    // The licence is one document for the whole Boutique, referenced rather than
    // restated per product.
    await expect(page.getByTestId("product-licence")).toContainText(
      "licence des produits numériques WeCreate",
    );
    await expect(
      page.getByRole("link", { name: /Lire la licence/ }),
    ).toHaveAttribute("href", "/legal/licence-produits-numeriques");

    // Support is a question about a product, not a Service Enquiry: the message
    // names the product and nothing books anything.
    await expect(page.getByTestId("product-support")).toContainText(
      "Aucun devis de prestation n'est traité ici",
    );
    await expect(
      page.getByRole("link", { name: /Poser une question sur WhatsApp/ }),
    ).toHaveAttribute(
      "href",
      "https://wa.me/2290167366726?text=Bonjour%20WeCreate%2C%20j'ai%20une%20question%20sur%20le%20produit%20%3A%20Color%20Grading%20Signature.",
    );
  });

  test("leaves out what WeCreate has not stated rather than inventing it", async ({
    page,
  }) => {
    // The design prototype prints "92 pages PDF", "14 études avant / après" and
    // "1 LUT offerte" for this product. The brief states none of it, and issue
    // #1 makes the brief authoritative for commercial content — so the block is
    // absent until an editor fills it in, and its absence is what keeps the
    // product out of sale.
    await page.goto(EBOOK);
    await expect(page.getByTestId("product-inclusions")).toHaveCount(0);

    await content.editDraft({
      boutique: {
        products: [sampleProduct({ isPurchaseEnabled: false })],
      },
    });
    await content.publish();

    await page.goto("/boutique/contre-jour-dore");
    const inclusions = page.getByTestId("product-inclusions");
    await expect(inclusions).toContainText("Ce qui est inclus");
    await expect(inclusions.getByRole("listitem")).toHaveCount(3);
  });

  test("answers as the site's not-found page for an address with nothing at it", async ({
    page,
  }) => {
    await page.goto("/boutique/pas-un-produit");

    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("reads and reflows on a phone without scrolling sideways", async ({
    page,
  }) => {
    await page.goto(EBOOK);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("Publishing and enabling purchase", () => {
  test("keeps an unpublished product off the Boutique and out of the sitemap", async ({
    page,
  }) => {
    await content.editDraft({ boutique: { products: [sampleProduct()] } });

    await page.goto(BOUTIQUE);
    await expect(page.getByTestId("product-card")).toHaveCount(6);
    await expect(
      page.getByRole("heading", { name: "Contre-jour doré" }),
    ).toHaveCount(0);
    expect(await sitemapProductPaths(page)).not.toContain(
      "/boutique/contre-jour-dore",
    );

    // The editor reviews it in the real page before anyone else can reach it.
    await enterPreview(page, BOUTIQUE);
    await expect(
      page.getByRole("heading", { name: "Contre-jour doré" }),
    ).toBeVisible();
    await leavePreview(page);

    await content.publish();
    await page.goto(BOUTIQUE);
    await expect(
      page.getByRole("heading", { name: "Contre-jour doré" }),
    ).toBeVisible();
  });

  test("refuses to sell a purchase-enabled product with no file behind it", async ({
    page,
  }) => {
    // Everything an editor controls is in place — the price, the cover, the
    // inclusions, the *En vente* box — and the product still cannot be bought.
    // Purchase readiness is two systems agreeing, and the commerce half has no
    // active Paid Deliverable Version (issue #8).
    await content.editDraft({ boutique: { products: [sampleProduct()] } });
    await content.publish();

    await page.goto("/boutique/contre-jour-dore");
    await expect(page.getByTestId("product-availability")).toHaveAttribute(
      "data-availability",
      "forthcoming",
    );

    // Approving the licence removes one blocker and not the other, so the answer
    // does not change.
    await content.editDraft({ legalDocuments: approvedLegalDocuments() });
    await content.publish();

    await page.goto("/boutique/contre-jour-dore");
    await expect(page.getByTestId("product-availability")).toHaveAttribute(
      "data-availability",
      "forthcoming",
    );
  });

  test("tells an editor in preview exactly what is holding a product back", async ({
    page,
  }) => {
    await page.goto(EBOOK);
    await expect(page.getByTestId("product-requirements")).toHaveCount(0);

    await enterPreview(page, EBOOK);
    const notice = page.getByTestId("product-requirements");
    await expect(notice).toContainText("Pas encore en vente");
    await expect(notice).toContainText("le contenu du produit");
    await expect(notice).toContainText("la couverture");
    await expect(notice).toContainText("la licence validée par WeCreate");
    await expect(notice).toContainText("la mise en vente");
    await expect(notice).toContainText("le fichier livré, activé côté commerce");
    await leavePreview(page);
  });

  test("keeps a product an editor has not filed yet, and names what is missing", async ({
    page,
  }) => {
    // A product with no family cannot be filtered or labelled, but disappearing
    // from preview is the one thing it must not do: the editor would be left
    // with a document and no page, and nothing saying which box is empty.
    await content.editDraft({
      boutique: { products: [sampleProduct({ family: null })] },
    });

    await enterPreview(page, "/boutique/contre-jour-dore");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Contre-jour doré",
    );
    await expect(page.getByTestId("product-requirements")).toContainText(
      "la famille",
    );
    await leavePreview(page);
  });
});

test.describe("A price change", () => {
  test("reaches a visitor only once it is published", async ({ page }) => {
    await content.editDraft({
      boutique: {
        products: [
          sampleProduct({
            sku: "EBK-01",
            slug: "color-grading-signature",
            title: "Color Grading Signature",
            family: "ebooks",
            priceXof: 18000,
          }),
        ],
      },
    });

    await page.goto(EBOOK);
    await expect(page.getByTestId("product-price")).toHaveText("15 000 F");

    await enterPreview(page, EBOOK);
    await expect(page.getByTestId("product-price")).toHaveText("18 000 F");
    await leavePreview(page);

    await content.publish();
    await page.goto(EBOOK);
    await expect(page.getByTestId("product-price")).toHaveText("18 000 F");
  });
});

test.describe("An archived product", () => {
  test.beforeEach(async () => {
    await content.editDraft({
      boutique: { products: [sampleProduct({ isArchived: true })] },
    });
    await content.publish();
  });

  test("leaves the Boutique, the homepage and search without being deleted", async ({
    page,
  }) => {
    await page.goto(BOUTIQUE);
    await expect(page.getByTestId("product-card")).toHaveCount(0);
    expect(await sitemapProductPaths(page)).toEqual([]);

    await page.goto("/");
    await expect(page.getByTestId("shop-preview-empty")).toBeVisible();
  });

  test("still answers at its own address, for the orders that reference it", async ({
    page,
  }) => {
    await page.goto("/boutique/contre-jour-dore");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Contre-jour doré",
    );
    await expect(page.getByTestId("product-availability")).toHaveAttribute(
      "data-availability",
      "unavailable",
    );
    await expect(page.getByTestId("product-archived-notice")).toContainText(
      "votre accès et vos téléchargements ne changent pas",
    );
    expect(await robots(page)).toContain("noindex");
  });
});

test.describe("A changed product address", () => {
  const MOVED = "/boutique/lut-contre-jour";

  test.beforeEach(async () => {
    await content.editDraft({
      boutique: {
        products: [
          sampleProduct({
            slug: "lut-contre-jour",
            previousSlugs: ["contre-jour-dore"],
          }),
        ],
      },
    });
    await content.publish();
  });

  test("redirects the prior address permanently", async ({ page }) => {
    const response = await page.request.get("/boutique/contre-jour-dore", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe(MOVED);
  });

  test("keeps the canonical address on the product it moved to", async ({
    page,
  }) => {
    await page.goto("/boutique/contre-jour-dore");

    await expect(page).toHaveURL(MOVED);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Contre-jour doré",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${MOVED}$`),
    );
    expect(await sitemapProductPaths(page)).toContain(MOVED);
    expect(await sitemapProductPaths(page)).not.toContain(
      "/boutique/contre-jour-dore",
    );
  });
});
