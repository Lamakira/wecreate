import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  COMMERCE_OPERATOR,
  CONTENT_EDITOR,
  CommerceDataPlane,
  NEW_OPERATOR,
  activateVersion,
  code,
  deliverablePanel,
  enterPassword,
  press,
  signIn,
  uploadDeliverable,
  wrongCode,
} from "./support/commerce";
import { ManagedContent } from "./support/managed-content";
import { approvedLegalDocuments, sampleProduct } from "./support/sample-content";

/**
 * The commerce back office: the private file behind each Digital Product, and
 * who may touch it.
 *
 * Two things separate this from every other surface on the site. It is the only
 * one that asks who you are — an individual account, a password, and a code
 * from that person's own authenticator, for reading as much as for changing.
 * And it holds the half of "may WeCreate sell this?" that Managed Content
 * cannot see: an editor's intent to sell means nothing until a Commerce
 * Operator has uploaded a file and activated a version of it, and a file means
 * nothing until an editor has put the product on sale.
 *
 * Nothing here reads a Paid Deliverable back. A buyer receives one through
 * Order Access, which is a later ticket; until then the bytes are write-once
 * and unreachable, and these tests check that they stay that way.
 */

const OPERATOR_FACTOR = COMMERCE_OPERATOR.factors[0];

/** The one Paid Deliverable these scenarios upload, and go looking for. */
const DELIVERABLE = {
  sku: "LUT-04",
  fileName: "contre-jour.zip",
  contents: "quatre LUTs",
};

let content: ManagedContent;
let commerce: CommerceDataPlane;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  commerce = new CommerceDataPlane(request);
  await content.reset();
  await commerce.reset();
});

test.afterEach(async () => {
  await content.reset();
  await commerce.reset();
});

test.describe("Reaching the back office", () => {
  test("shows nothing at all to someone who is not signed in", async ({
    page,
  }) => {
    await page.goto("/commerce");

    await expect(page).toHaveURL(/\/commerce\/connexion$/);
    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    await expect(page.getByTestId("deliverable")).toHaveCount(0);
    await expect(page.getByTestId("audit-entry")).toHaveCount(0);
    await expect(page.getByTestId("version-upload")).toHaveCount(0);
  });

  test("refuses a password on its own", async ({ page }) => {
    await enterPassword(page, COMMERCE_OPERATOR);

    // Signed in, and still nowhere: a stolen password reaches assurance level 1,
    // and commerce data is behind level 2.
    await expect(page.getByTestId("second-factor-form")).toBeVisible();
    await expect(page.getByTestId("deliverable")).toHaveCount(0);

    await page.goto("/commerce");
    await expect(page).toHaveURL(/\/commerce\/connexion$/);
    await expect(page.getByTestId("second-factor-form")).toBeVisible();
  });

  test("refuses a code the operator's authenticator is not showing", async ({
    page,
  }) => {
    await enterPassword(page, COMMERCE_OPERATOR);
    await page.getByLabel("Code de vérification").fill(wrongCode(OPERATOR_FACTOR));
    await page.getByRole("button", { name: "Vérifier" }).click();

    await expect(page.getByTestId("commerce-notice")).toContainText("Code refusé");

    await page.goto("/commerce");
    await expect(page).toHaveURL(/\/commerce\/connexion$/);
  });

  test("lets a Commerce Operator in once both are proved", async ({ page }) => {
    await signIn(page, COMMERCE_OPERATOR);

    await expect(page).toHaveURL(/\/commerce$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fichiers livrés",
    );
    await expect(page.getByTestId("version-upload")).toBeVisible();
  });

  test("sends a staff member with no authenticator to enrol one first", async ({
    page,
  }) => {
    await enterPassword(page, NEW_OPERATOR);

    await expect(page).toHaveURL(/\/commerce\/securite$/);
    await expect(page.getByTestId("second-factor")).toHaveCount(0);

    // The commerce data itself stays shut until the factor exists and is used.
    await page.goto("/commerce");
    await expect(page).toHaveURL(/\/commerce\/securite$/);
    await expect(page.getByTestId("deliverable")).toHaveCount(0);

    await page.getByLabel("Nom de l'appareil").fill("Téléphone");
    await press(page, page.getByRole("button", { name: "Ajouter", exact: true }));

    const secret = await page.getByTestId("factor-secret").innerText();
    await page.getByLabel("Code de vérification").fill(code(secret));
    await press(page, page.getByRole("button", { name: "Confirmer" }));

    await expect(page.getByTestId("second-factor")).toHaveCount(1);
    await page.goto("/commerce");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fichiers livrés",
    );
  });

  test("opens the same door with a separately enrolled backup factor", async ({
    page,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await page.goto("/commerce/securite");

    await page.getByLabel("Nom de l'appareil").fill("Tablette de secours");
    await press(page, page.getByRole("button", { name: "Ajouter", exact: true }));
    const backup = await page.getByTestId("factor-secret").innerText();
    await page.getByLabel("Code de vérification").fill(code(backup));
    await press(page, page.getByRole("button", { name: "Confirmer" }));

    await expect(page.getByTestId("second-factor")).toHaveCount(2);

    // A lost phone must not lock WeCreate out of the files it sells.
    await page.goto("/commerce");
    await press(page, page.getByRole("button", { name: "Se déconnecter" }));
    await enterPassword(page, COMMERCE_OPERATOR);
    await page.getByLabel("Application").selectOption({ label: "Tablette de secours" });
    await page.getByLabel("Code de vérification").fill(code(backup));
    await press(page, page.getByRole("button", { name: "Vérifier" }));

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fichiers livrés",
    );
  });

  test("refuses a Content Editor who is fully authenticated", async ({ page }) => {
    await signIn(page, CONTENT_EDITOR);

    // Editorial and commerce are separate permissions, even when one person
    // holds both. Nothing about the files is rendered — not a count, not a SKU.
    await expect(page.getByTestId("commerce-refusal")).toBeVisible();
    await expect(page.getByTestId("deliverable")).toHaveCount(0);
    await expect(page.getByTestId("version-upload")).toHaveCount(0);
    await expect(page.getByTestId("audit-entry")).toHaveCount(0);
  });
});

test.describe("Uploading a Paid Deliverable Version", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, COMMERCE_OPERATOR);
  });

  test("records an immutable version, and puts nothing on sale by itself", async ({
    page,
  }) => {
    await uploadDeliverable(page, {
      sku: "EBK-01",
      fileName: "guide.pdf",
      contents: "la première version du guide",
    });

    await expect(page.getByTestId("commerce-notice")).toContainText(
      "Nouvelle version enregistrée",
    );

    const ebook = deliverablePanel(page, "EBK-01");
    await expect(ebook.getByTestId("version")).toHaveCount(1);
    await expect(ebook.getByTestId("version")).toContainText("Version 1 · guide.pdf");
    await expect(ebook.getByTestId("version")).toContainText(
      COMMERCE_OPERATOR.email,
    );
    await expect(ebook.getByTestId("version-checksum")).not.toBeEmpty();

    // Uploading is not selling. A file reaches a buyer only once someone
    // activates it, which is a separate, deliberate decision.
    await expect(ebook.getByTestId("active-version")).toHaveText(
      "Aucune version en vente",
    );
  });

  test("refuses a file WeCreate does not deliver", async ({ page }) => {
    await uploadDeliverable(page, {
      sku: "EBK-01",
      fileName: "couverture.png",
      contents: "pas un livrable",
      mimeType: "image/png",
    });

    await expect(page.getByTestId("commerce-notice")).toContainText(
      "Format non accepté",
    );
    await expect(deliverablePanel(page, "EBK-01").getByTestId("version")).toHaveCount(
      0,
    );
  });

  test("refuses to write over a stored version, and takes a different file as the next one", async ({
    page,
  }) => {
    const ebook = deliverablePanel(page, "EBK-01");

    await uploadDeliverable(page, {
      sku: "EBK-01",
      fileName: "guide.pdf",
      contents: "la première version du guide",
    });
    await expect(ebook.getByTestId("version")).toHaveCount(1);

    // The same bytes under a new name are the same file. A replacement has to
    // be a different one, and nothing may be written over what is stored.
    await uploadDeliverable(page, {
      sku: "EBK-01",
      fileName: "guide-corrige.pdf",
      contents: "la première version du guide",
    });
    await expect(page.getByTestId("commerce-notice")).toContainText("déjà stocké");
    await expect(ebook.getByTestId("version")).toHaveCount(1);

    await uploadDeliverable(page, {
      sku: "EBK-01",
      fileName: "guide-v2.pdf",
      contents: "la deuxième version du guide",
    });
    await expect(ebook.getByTestId("version")).toHaveCount(2);
  });

  test("activates one version and leaves every other exactly as it was", async ({
    page,
  }) => {
    const luts = deliverablePanel(page, "LUT-01");

    await uploadDeliverable(page, {
      sku: "LUT-01",
      fileName: "pack.zip",
      contents: "premier pack",
      mimeType: "application/zip",
    });
    await expect(luts.getByTestId("version")).toHaveCount(1);
    await uploadDeliverable(page, {
      sku: "LUT-01",
      fileName: "pack-v2.zip",
      contents: "second pack",
      mimeType: "application/zip",
    });
    await expect(luts.getByTestId("version")).toHaveCount(2);

    const first = luts
      .locator('[data-testid="version"][data-version="1"]')
      .getByTestId("version-record");

    await activateVersion(page, "LUT-01", 1);
    await expect(luts.getByTestId("active-version")).toHaveText("Version 1 en vente");
    const firstAsRecorded = await first.innerText();

    await activateVersion(page, "LUT-01", 2);
    await expect(luts.getByTestId("active-version")).toHaveText("Version 2 en vente");

    // The version a past Order Snapshot would reference is untouched: same
    // number, same file, same checksum, same uploader, same moment. What
    // changed is only which version is sold next.
    await expect(first).toHaveCount(1);
    expect(await first.innerText()).toBe(firstAsRecorded);
  });

  test("records who activated what, when, and what changed", async ({ page }) => {
    const luts = deliverablePanel(page, "LUT-01");

    await uploadDeliverable(page, {
      sku: "LUT-01",
      fileName: "pack.zip",
      contents: "premier pack",
      mimeType: "application/zip",
    });
    await expect(luts.getByTestId("version")).toHaveCount(1);
    await uploadDeliverable(page, {
      sku: "LUT-01",
      fileName: "pack-v2.zip",
      contents: "second pack",
      mimeType: "application/zip",
    });
    await expect(luts.getByTestId("version")).toHaveCount(2);

    await activateVersion(page, "LUT-01", 1);
    await expect(luts.getByTestId("active-version")).toHaveText("Version 1 en vente");
    await activateVersion(page, "LUT-01", 2);
    await expect(luts.getByTestId("active-version")).toHaveText("Version 2 en vente");

    await expect(page.getByTestId("audit-entry")).toHaveCount(4);

    const activations = page.locator(
      '[data-testid="audit-entry"][data-action="paid-deliverable-version.activated"]',
    );
    await expect(activations).toHaveCount(2);

    const latest = activations.first();
    await expect(latest).toContainText("Version activée — LUT-01");
    await expect(latest).toContainText(COMMERCE_OPERATOR.email);
    await expect(latest).toContainText("Avant : version 1 (pack.zip");
    await expect(latest).toContainText("Après : version 2 (pack-v2.zip");
  });
});

test.describe("What makes a product purchasable", () => {
  test("needs the editor's intent and an activated file, and neither alone", async ({
    page,
  }) => {
    // An editor's half: approved licence text, a complete product, on sale.
    await content.editDraft({
      legalDocuments: approvedLegalDocuments(),
      boutique: { products: [sampleProduct()] },
    });
    await content.publish();

    const badge = page.getByTestId("product-availability");
    await page.goto("/boutique/contre-jour-dore");
    await expect(badge).toHaveAttribute("data-availability", "forthcoming");

    // The commerce half: a file, and a decision to sell that version of it.
    await signIn(page, COMMERCE_OPERATOR);
    await uploadDeliverable(page, {
      sku: "LUT-04",
      fileName: "contre-jour.zip",
      contents: "quatre LUTs",
      mimeType: "application/zip",
    });
    await expect(
      deliverablePanel(page, "LUT-04").getByTestId("version"),
    ).toHaveCount(1);

    // An uploaded file is not a sold one.
    await page.goto("/boutique/contre-jour-dore");
    await expect(badge).toHaveAttribute("data-availability", "forthcoming");

    await page.goto("/commerce");
    await activateVersion(page, "LUT-04", 1);
    await expect(
      deliverablePanel(page, "LUT-04").getByTestId("active-version"),
    ).toHaveText("Version 1 en vente");

    await page.goto("/boutique/contre-jour-dore");
    await expect(badge).toHaveAttribute("data-availability", "available");
    await expect(badge).toHaveText("Disponible");

    // And the editor can withdraw it again on their own: an activated file does
    // not keep a product on sale that WeCreate has stopped selling.
    await content.editDraft({
      boutique: { products: [sampleProduct({ isPurchaseEnabled: false })] },
    });
    await content.publish();

    await page.goto("/boutique/contre-jour-dore");
    await expect(badge).toHaveAttribute("data-availability", "forthcoming");
  });
});

test.describe("Keeping Paid Deliverables private", () => {
  /** The one product on sale, with the one file behind it, ready to look for. */
  async function sellOneProductWithItsFile(page: Page): Promise<void> {
    await content.editDraft({
      legalDocuments: approvedLegalDocuments(),
      boutique: { products: [sampleProduct()] },
    });
    await content.publish();

    await signIn(page, COMMERCE_OPERATOR);
    await uploadDeliverable(page, {
      sku: DELIVERABLE.sku,
      fileName: DELIVERABLE.fileName,
      contents: DELIVERABLE.contents,
      mimeType: "application/zip",
    });
    await expect(
      deliverablePanel(page, DELIVERABLE.sku).getByTestId("version"),
    ).toHaveCount(1);
    await activateVersion(page, DELIVERABLE.sku, 1);
  }

  test("never names the file anywhere the public can reach", async ({ page }) => {
    await sellOneProductWithItsFile(page);

    const checksum = await deliverablePanel(page, "LUT-04")
      .getByTestId("version-checksum")
      .innerText();

    // Even the back office links nowhere at the bytes: a version is named by
    // its number, its file name and its checksum, and that is all.
    await expect(page.locator('a[href*="paid-deliverables"]')).toHaveCount(0);

    for (const address of ["/boutique", "/boutique/contre-jour-dore", "/sitemap.xml"]) {
      const response = await page.request.get(address);
      const body = await response.text();
      expect(body).not.toContain("contre-jour.zip");
      expect(body).not.toContain(checksum);
    }

    const robots = await (await page.request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /commerce/");

    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/commerce");
  });

  test("serves the bytes at no address at all", async ({ page }) => {
    await sellOneProductWithItsFile(page);

    // The address the file is stored under, worked out from the outside: it is
    // derived from the product and the file's own checksum, and neither is a
    // secret. What must be true is that knowing it gets nobody anywhere — the
    // bytes are reachable through Order Access and nothing else, which is issue
    // #12's to build.
    const checksum = createHash("sha256")
      .update(Buffer.from(DELIVERABLE.contents, "utf8"))
      .digest("hex");
    const stored = `${DELIVERABLE.sku}/${checksum}.zip`;

    for (const address of [
      `/${stored}`,
      `/paid-deliverables/${stored}`,
      `/commerce/paid-deliverables/${stored}`,
      `/api/commerce/paid-deliverables/${stored}`,
      `/.wecreate/acceptance/paid-deliverables/${stored}`,
    ]) {
      const response = await page.request.get(address);
      expect(response.status(), address).not.toBe(200);
      expect(await response.text(), address).not.toContain(DELIVERABLE.contents);
    }
  });

  test("closes the door again when the operator signs out", async ({ page }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await expect(page.getByTestId("version-upload")).toBeVisible();

    await press(page, page.getByRole("button", { name: "Se déconnecter" }));
    await expect(page).toHaveURL(/\/commerce\/connexion/);

    await page.goto("/commerce");
    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    await expect(page.getByTestId("deliverable")).toHaveCount(0);
  });
});
