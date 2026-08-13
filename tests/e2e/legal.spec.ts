import { expect, test, type Page } from "@playwright/test";

import { getWithForgedHost } from "./support/forged-host";
import { ManagedContent, enterPreview, leavePreview } from "./support/managed-content";
import {
  approvedLegalDocuments,
  legalRevision,
} from "./support/sample-content";

/**
 * Legal documents: what is in force, since when, and what it commits a visitor
 * to.
 *
 * Two things separate these pages from the rest of the site. Their text is
 * dated — the revision in force is the most recent one whose date has arrived,
 * and every revision before it stays readable because past orders reference it.
 * And their text is not WeCreate's yet: everything shipped is a placeholder,
 * which is readable and previewable but stays out of search results and keeps
 * production purchasing switched off.
 */

const CGV = "/legal/conditions-generales-de-vente";
const PRIVACY = "/legal/politique-de-confidentialite";

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

/**
 * What the page tells a crawler, or `""` when it says nothing.
 *
 * Read from the DOM rather than from the response body: metadata on a route
 * with a dynamic segment is streamed, so it reaches the document after the
 * shell. Next.js inlines it in `<head>` for known crawlers, which is what makes
 * that safe.
 */
async function robots(page: Page): Promise<string> {
  const meta = page.locator('meta[name="robots"]');
  if ((await meta.count()) === 0) {
    return "";
  }
  return (await meta.first().getAttribute("content")) ?? "";
}

/** Every legal address the sitemap advertises. */
async function sitemapLegalPaths(page: Page): Promise<string[]> {
  const response = await page.request.get("/sitemap.xml");
  const body = await response.text();
  return [...body.matchAll(/<loc>([^<]*\/legal\/[^<]*)<\/loc>/g)].map((match) =>
    new URL(match[1]).pathname,
  );
}

test.describe("Reading a legal document", () => {
  test("serves it on its own canonical, crawlable address", async ({ page }) => {
    await content.editDraft({ legalDocuments: approvedLegalDocuments() });
    await content.publish();

    await page.goto(CGV);

    await expect(page).toHaveTitle("Conditions générales de vente · WeCreate");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Conditions générales de vente",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${CGV}$`),
    );

    // Approved text is WeCreate's own, so it is indexed and advertised.
    expect(await robots(page)).not.toContain("noindex");
    expect(await sitemapLegalPaths(page)).toEqual([
      CGV,
      "/legal/livraison-et-remboursement",
      "/legal/licence-produits-numeriques",
      PRIVACY,
      "/legal/mentions-legales",
    ]);
  });

  test("states the date it took effect and the revision it is", async ({
    page,
  }) => {
    await page.goto(CGV);

    const meta = page.getByTestId("legal-revision-meta");
    await expect(meta).toContainText("En vigueur depuis");
    await expect(meta).toContainText("12 août 2026");
    // The identity an Order Snapshot records, printed where a buyer can check
    // it against their receipt.
    await expect(meta).toContainText("cgv-placeholder");
  });

  test("separates what must be accepted from what is only information", async ({
    page,
  }) => {
    await page.goto(CGV);
    const transactional = page.getByTestId("legal-acceptance-note");
    await expect(transactional).toContainText("Conditions transactionnelles");
    await expect(transactional).toContainText(
      "avant tout paiement d'un produit numérique",
    );

    await page.goto(PRIVACY);
    const informational = page.getByTestId("legal-acceptance-note");
    await expect(informational).toContainText("Document d'information");
    await expect(informational).toContainText(
      "Aucune acceptation n'est demandée ici",
    );

    // Both say the same thing about marketing: a purchase subscribes a buyer to
    // nothing, and no consent of that kind is asked for anywhere.
    for (const path of [CGV, PRIVACY]) {
      await page.goto(path);
      await expect(page.getByTestId("legal-acceptance-note")).toContainText(
        "Rien sur ce site ne vaut consentement marketing",
      );
    }
  });

  test("links every document in force from the footer of every page", async ({
    page,
  }) => {
    await page.goto("/");

    const legal = page.getByRole("navigation", { name: "Informations légales" });
    await expect(legal.getByRole("link")).toHaveCount(5);
    await expect(
      legal.getByRole("link", { name: "Conditions générales de vente" }),
    ).toHaveAttribute("href", CGV);

    await legal.getByRole("link", { name: "Politique de confidentialité" }).click();
    await expect(page).toHaveURL(PRIVACY);
  });

  test("answers as the site's not-found page for an address with nothing at it", async ({
    page,
  }) => {
    await page.goto("/legal/pas-un-document");

    await expect(page.getByTestId("not-found")).toBeVisible();
  });
});

test.describe("Provisional legal text", () => {
  test("says so, and is kept out of search results and the sitemap", async ({
    page,
  }) => {
    await page.goto(CGV);

    await expect(page.getByTestId("legal-placeholder-notice")).toContainText(
      "Texte provisoire",
    );
    expect(await robots(page)).toContain("noindex");
    expect(await sitemapLegalPaths(page)).toEqual([]);
  });

  test("keeps production purchasing off until WeCreate approves every document", async ({
    page,
  }) => {
    // The Commerce Launch Gate's legal half, seen from where an editor works.
    // A visitor is never shown it — what they are told is that the text is
    // provisional.
    await page.goto(CGV);
    await expect(page.getByTestId("legal-approval-notice")).toHaveCount(0);

    await enterPreview(page, CGV);
    const blocked = page.getByTestId("legal-approval-notice");
    await expect(blocked).toContainText(
      "La vente de produits numériques reste désactivée",
    );
    await expect(blocked).toContainText("les conditions générales de vente");
    await expect(blocked).toContainText("les mentions légales");
    await leavePreview(page);

    // One document approved is not enough: the gate names the four still
    // waiting, and only lifts when none are.
    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "cgv"
          ? document
          : { ...document, revisions: [{ ...document.revisions[0], status: "placeholder" }] },
      ),
    });
    await content.publish();

    await enterPreview(page, CGV);
    await expect(page.getByTestId("legal-approval-notice")).not.toContainText(
      "les conditions générales de vente",
    );
    await expect(page.getByTestId("legal-approval-notice")).toContainText(
      "les mentions légales",
    );
    await leavePreview(page);

    await content.editDraft({ legalDocuments: approvedLegalDocuments() });
    await content.publish();

    await enterPreview(page, CGV);
    await expect(page.getByTestId("legal-approval-notice")).toHaveCount(0);
    await expect(page.getByTestId("legal-placeholder-notice")).toHaveCount(0);
    await leavePreview(page);
  });
});

test.describe("Publishing new terms", () => {
  test("keeps an unpublished revision off the public page and out of search", async ({
    page,
  }) => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "cgv"
          ? {
              ...document,
              revisions: [
                ...document.revisions,
                legalRevision("cgv-2026-03-01", "2026-03-01"),
              ],
            }
          : document,
      ),
    });

    await page.goto(CGV);
    await expect(page.getByTestId("legal-revision-meta")).toContainText(
      "cgv-placeholder",
    );
    await expect(page.getByText("Texte de la révision cgv-2026-03-01")).toHaveCount(
      0,
    );

    // The editor reads the new terms in the real page before anyone is bound by
    // them — and a preview is never indexable, whatever the revision says.
    await enterPreview(page, CGV);
    await expect(page.getByTestId("legal-revision-meta")).toContainText(
      "cgv-2026-03-01",
    );
    await expect(
      page.getByText("Texte de la révision cgv-2026-03-01"),
    ).toBeVisible();
    expect(await robots(page)).toContain("noindex");
    await leavePreview(page);

    await content.publish();
    await page.goto(CGV);
    await expect(page.getByTestId("legal-revision-meta")).toContainText(
      "cgv-2026-03-01",
    );
  });

  test("applies the most recent revision whose date has arrived", async ({
    page,
  }) => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "cgv"
          ? {
              ...document,
              revisions: [
                legalRevision("cgv-2026-01-15", "2026-01-15"),
                legalRevision("cgv-2026-02-20", "2026-02-20"),
                // Prepared, published, and not yet anybody's terms.
                legalRevision("cgv-2099-01-01", "2099-01-01"),
              ],
            }
          : document,
      ),
    });
    await content.publish();

    await page.goto(CGV);

    const meta = page.getByTestId("legal-revision-meta");
    await expect(meta).toContainText("cgv-2026-02-20");
    await expect(meta).toContainText("20 février 2026");
    await expect(page.getByText("Texte de la révision cgv-2099-01-01")).toHaveCount(
      0,
    );

    // A revision that is not in force has no address of its own either, so the
    // page and the archive cannot disagree about what has been published.
    await page.goto("/legal/conditions-generales-de-vente/cgv-2099-01-01");
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("has no page at all while every revision is still to come", async ({
    page,
  }) => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "cgv"
          ? { ...document, revisions: [legalRevision("cgv-2099-01-01", "2099-01-01")] }
          : document,
      ),
    });
    await content.publish();

    await page.goto(CGV);
    await expect(page.getByTestId("not-found")).toBeVisible();

    // And nothing links to it: the footer lists what is in force.
    await page.goto("/");
    const legal = page.getByRole("navigation", { name: "Informations légales" });
    await expect(legal.getByRole("link")).toHaveCount(4);
    await expect(
      legal.getByRole("link", { name: "Conditions générales de vente" }),
    ).toHaveCount(0);
  });
});

test.describe("Superseded revisions", () => {
  test("keeps the exact text a past order accepted, at an address of its own", async ({
    page,
  }) => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "cgv"
          ? {
              ...document,
              revisions: [
                legalRevision("cgv-2026-01-15", "2026-01-15"),
                legalRevision("cgv-2026-02-20", "2026-02-20"),
              ],
            }
          : document,
      ),
    });
    await content.publish();

    await page.goto(CGV);

    // Publishing the second revision did not rewrite the first: it is listed,
    // by the identity an order recorded, and it still opens.
    const entries = page.getByTestId("legal-revision-entry");
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText("cgv-2026-02-20");
    await expect(entries.nth(0)).toContainText("En vigueur");
    await expect(entries.nth(1)).toContainText("cgv-2026-01-15");

    await entries.nth(1).getByRole("link", { name: "Lire cette version" }).click();

    await expect(page).toHaveURL(
      "/legal/conditions-generales-de-vente/cgv-2026-01-15",
    );
    await expect(
      page.getByText("Texte de la révision cgv-2026-01-15"),
    ).toBeVisible();
    await expect(page.getByTestId("legal-superseded-notice")).toContainText(
      "Version archivée",
    );

    // Archived text never competes with the terms in force, in search results
    // or in the sitemap.
    expect(await robots(page)).toContain("noindex");
    expect(await sitemapLegalPaths(page)).not.toContain(
      "/legal/conditions-generales-de-vente/cgv-2026-01-15",
    );

    await page
      .getByRole("link", { name: "Lire la version en vigueur" })
      .click();
    await expect(page).toHaveURL(CGV);
  });

  test("shows no history for a document that has only ever said one thing", async ({
    page,
  }) => {
    await page.goto(CGV);

    await expect(page.getByTestId("legal-revision-entry")).toHaveCount(0);
  });
});

test.describe("A changed legal address", () => {
  const MOVED = "/legal/cgv";

  test.beforeEach(async () => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "cgv"
          ? {
              ...document,
              slug: "cgv",
              previousSlugs: ["conditions-generales-de-vente"],
            }
          : document,
      ),
    });
    await content.publish();
  });

  test("redirects the prior address permanently", async ({ page }) => {
    const response = await page.request.get(CGV, { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe(MOVED);
  });

  test("builds the redirect from our own origin, not the caller's Host", async ({
    baseURL,
  }) => {
    // Asserting a property, not reproducing a defect: under `next start`
    // `request.nextUrl.origin` is the address the server bound to, so a forged
    // `Host` never reached the redirect even when the proxy resolved against
    // it. What this pins is that it stays that way — a permanent redirect is
    // the last thing that should vary with a request header, because a shared
    // cache may go on serving it to somebody who asked for the old address
    // honestly.
    const response = await getWithForgedHost(
      baseURL!,
      CGV,
      "evil.example",
    );

    expect(response.status).toBe(308);
    expect(response.location).not.toContain("evil.example");
    expect(response.location).toContain(MOVED);
  });

  test("redirects a link to one named revision too", async ({ page }) => {
    const response = await page.request.get(
      `${CGV}/cgv-2026-01-15`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toBe(`${MOVED}/cgv-2026-01-15`);
  });

  test("lands a visitor on the document, following the redirect", async ({
    page,
  }) => {
    await page.goto(CGV);

    await expect(page).toHaveURL(MOVED);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Conditions générales de vente",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${MOVED}$`),
    );
  });

  test("advertises only the new address", async ({ page }) => {
    await page.goto("/");

    await expect(
      page
        .getByRole("navigation", { name: "Informations légales" })
        .getByRole("link", { name: "Conditions générales de vente" }),
    ).toHaveAttribute("href", MOVED);
    expect(await sitemapLegalPaths(page)).toContain(MOVED);
    expect(await sitemapLegalPaths(page)).not.toContain(CGV);
  });
});

test.describe("Legal documents, read as a document", () => {
  test("is one heading outline, in reading order, with nothing off the side", async ({
    page,
  }) => {
    await page.goto(PRIVACY);

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const sections = page.getByTestId("legal-section");
    await expect(sections).toHaveCount(4);
    await expect(sections.first().getByRole("heading", { level: 2 })).toHaveText(
      "Données collectées",
    );

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is operable from the keyboard, out of the archive and back", async ({
    page,
  }) => {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments((document) =>
        document.kind === "cgv"
          ? {
              ...document,
              revisions: [
                legalRevision("cgv-2026-01-15", "2026-01-15"),
                legalRevision("cgv-2026-02-20", "2026-02-20"),
              ],
            }
          : document,
      ),
    });
    await content.publish();

    await page.goto(CGV);

    // The one link out of the current terms and into what they replaced.
    const archived = page
      .getByTestId("legal-revision-entry")
      .nth(1)
      .getByRole("link", { name: "Lire cette version" });
    await archived.focus();
    await expect(archived).toBeFocused();
    // Asserted after a real focus, because `:focus-visible` is what draws the
    // ring — and this is the one control on the page.
    await expect(archived).toHaveCSS("outline-style", "solid");
    await expect(archived).toHaveCSS("outline-width", "2px");

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("legal-superseded-notice")).toBeVisible();

    const back = page.getByRole("link", { name: "Lire la version en vigueur" });
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(CGV);
  });

  test("reads without JavaScript, like any other legal notice", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(PRIVACY);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Politique de confidentialité",
    );
    await expect(page.getByTestId("legal-section")).toHaveCount(4);
    await expect(page.getByTestId("legal-acceptance-note")).toBeVisible();

    await context.close();
  });
});
