import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  SAMPLE_INVITATION,
  questionnaireMessages,
  storageSnapshot,
} from "./support/brand-questionnaire";
import {
  COMMERCE_OPERATOR,
  CONTENT_EDITOR,
  CommerceDataPlane,
  enterPassword,
  press,
  signIn,
} from "./support/commerce";
import { ManagedContent } from "./support/managed-content";
import { Outbox } from "./support/order-access";

/**
 * The questionnaire link maker (issue #63): where WeCreate's team turns a
 * client's name, brand, pack and reference into the personal link of the brand
 * questionnaire, and sends it.
 *
 * It lives in the staff back office (ADR-0013), so most of what matters is who
 * is let in: nobody who is not signed in, nobody who has only a password, and
 * any fully authenticated staff member whether or not they administer commerce.
 * The other half is what it does not do — store a word of what was typed, send
 * a message of its own, put a name in an address. Those are asserted as
 * strongly as the journey, and the link it makes is opened the way a client
 * opens it, in a browser that has never met the staff session.
 */

const FIELDS = {
  client: "Nom du client",
  brand: "Nom de la marque · optionnel",
  pack: "Pack Branding",
  reference: "Référence WeCreate",
} as const;

let outbox: Outbox;

test.beforeEach(async ({ request }) => {
  await new CommerceDataPlane(request).reset();
  await new ManagedContent(request).reset();
  outbox = new Outbox(request);
  await outbox.reset();
});

test.afterEach(async ({ request }) => {
  await new CommerceDataPlane(request).reset();
  await new ManagedContent(request).reset();
});

function field(page: Page, name: keyof typeof FIELDS) {
  return page.getByLabel(FIELDS[name], { exact: true });
}

async function fillSample(page: Page): Promise<void> {
  for (const name of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) {
    await field(page, name).fill(SAMPLE_INVITATION[name]);
  }
}

async function openTool(page: Page): Promise<void> {
  await page.goto("/commerce/questionnaire");
  await expect(page.getByTestId("questionnaire-link-form")).toBeVisible();
}

async function makeLink(page: Page): Promise<string> {
  await fillSample(page);
  await press(page, page.getByRole("button", { name: "Créer le lien" }));
  const result = page.getByTestId("questionnaire-link-result");
  await expect(result).toBeVisible();
  return page.getByLabel("Lien personnel", { exact: true }).inputValue();
}

test.describe("Reaching the tool", () => {
  test("shows nothing to someone who is not signed in", async ({ page }) => {
    await page.goto("/commerce/questionnaire");

    await expect(page).toHaveURL(/\/commerce\/connexion$/);
    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    await expect(page.getByTestId("questionnaire-link-form")).toHaveCount(0);
  });

  test("refuses a password on its own", async ({ page }) => {
    await enterPassword(page, COMMERCE_OPERATOR);
    await page.goto("/commerce/questionnaire");

    await expect(page).toHaveURL(/\/commerce\/connexion$/);
    await expect(page.getByTestId("second-factor-form")).toBeVisible();
    await expect(page.getByTestId("questionnaire-link-form")).toHaveCount(0);
  });

  test("is one click from the back office of a Commerce Operator", async ({
    page,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await page
      .getByTestId("commerce-nav")
      .getByRole("link", { name: "Questionnaire de marque" })
      .click();

    await expect(page).toHaveURL(/\/commerce\/questionnaire$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Envoi du questionnaire",
    );
    await expect(page.getByTestId("questionnaire-link-form")).toBeVisible();
  });

  test("admits a Content Editor, refused by the commerce pages, and offers them nothing else", async ({
    page,
  }) => {
    await signIn(page, CONTENT_EDITOR);
    await expect(page.getByTestId("commerce-refusal")).toBeVisible();

    await page
      .getByRole("link", { name: "Envoyer un questionnaire de marque" })
      .click();

    await expect(page).toHaveURL(/\/commerce\/questionnaire$/);
    await expect(page.getByTestId("questionnaire-link-form")).toBeVisible();
    const nav = page.getByTestId("commerce-nav");
    await expect(nav).not.toContainText("Fichiers livrés");
    await expect(nav).not.toContainText("Commandes");
  });
});

test.describe("Making the link", () => {
  test("makes a link the client opens in their own browser, and reads nothing from it", async ({
    page,
    browser,
    baseURL,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    const link = await makeLink(page);

    expect(link.startsWith(`${baseURL}/questionnaire/`)).toBe(true);
    const token = link.slice(`${baseURL}/questionnaire/`.length);
    const bytes = Buffer.from(token, "base64url").toString("latin1");
    expect(bytes).not.toContain("Dossou");
    expect(bytes).not.toContain("WC-Q48213");
    expect(token).not.toContain("Dossou");
    await expect(page.getByText(/Valable jusqu'au/)).toBeVisible();

    // The client's own browser: no staff cookie, nothing shared with this one.
    const context = await browser.newContext();
    try {
      const client = await context.newPage();
      await client.goto(link);
      await expect(client).toHaveURL(/\/questionnaire$/);
      await expect(client.getByText("Bonjour Aïcha Dossou.")).toBeVisible();
      await expect(
        client.getByText("Référence WC-Q48213 · Identité Complète"),
      ).toBeVisible();
      await expect(
        client.getByLabel("Nom de la marque", { exact: true }),
      ).toHaveValue("Maison Kéré");
    } finally {
      await context.close();
    }
  });

  test("refuses missing fields in French and keeps what was typed", async ({
    page,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    await field(page, "brand").fill("Maison Kéré");
    await press(page, page.getByRole("button", { name: "Créer le lien" }));

    await expect(page.getByText("Indiquez le nom du client.")).toBeVisible();
    await expect(page.getByText("Indiquez le pack Branding.")).toBeVisible();
    await expect(
      page.getByText("Indiquez la référence WeCreate."),
    ).toBeVisible();
    await expect(field(page, "brand")).toHaveValue("Maison Kéré");
    await expect(page.getByTestId("questionnaire-link-result")).toHaveCount(0);
  });

  test("says the same words as a message on WhatsApp", async ({
    page,
    baseURL,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    const link = await makeLink(page);
    expect(link).toContain(`${baseURL}/questionnaire/`);

    const whatsapp = page.getByRole("link", { name: "Envoyer sur WhatsApp" });
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    const href = (await whatsapp.getAttribute("href")) ?? "";
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    const text = new URL(href).searchParams.get("text") ?? "";
    expect(text).toContain(link);
    expect(text).toContain("Bonjour Aïcha Dossou,");
    expect(text).toContain("Identité Complète pour Maison Kéré");
    await expect(page.getByTestId("questionnaire-link-message")).toContainText(
      "Bonjour Aïcha Dossou,",
    );

    const phone = page.getByLabel("WhatsApp du client · optionnel");
    await phone.fill("01 97 00 00 00");
    await expect(whatsapp).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/2290197000000\?text=/,
    );
    await phone.fill("+33 6 12 34 56 78");
    await expect(whatsapp).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/33612345678\?text=/,
    );
  });

  test("opens the mail client with the message written", async ({ page }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    const link = await makeLink(page);

    const mail = page.getByRole("link", { name: "Envoyer par email" });
    const href = (await mail.getAttribute("href")) ?? "";
    expect(href.startsWith("mailto:")).toBe(true);
    const url = new URL(href);
    expect(url.searchParams.get("subject")).toBe(
      "WeCreate · Votre questionnaire de marque",
    );
    expect(url.searchParams.get("body")).toContain(link);

    await page
      .getByLabel("Email du client · optionnel")
      .fill("aicha@exemple.test");
    await expect(mail).toHaveAttribute("href", /^mailto:aicha%40exemple\.test\?/);
  });

  test("copies the link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    const link = await makeLink(page);

    await page.getByRole("button", { name: "Copier le lien" }).click();

    await expect(page.getByRole("button", { name: "Lien copié" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  });

  test("has no WCAG 2.2 AA violations axe can see once a link is made", async ({
    page,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    await makeLink(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual(
      [],
    );
  });
});

test.describe("Keeping nothing", () => {
  test("stores, sends and remembers nothing of what was typed", async ({
    page,
    request,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    const before = await storageSnapshot();

    await makeLink(page);
    await page.getByLabel("WhatsApp du client · optionnel").fill("01 97 00 00 00");
    await page
      .getByLabel("Email du client · optionnel")
      .fill("aicha@exemple.test");

    const after = await storageSnapshot();
    expect(after).toEqual(before);
    for (const text of [after.commerce, after.content]) {
      for (const value of [
        ...Object.values(SAMPLE_INVITATION),
        "0197000000",
        "aicha@exemple.test",
      ]) {
        expect(text).not.toContain(value);
      }
    }
    expect(await questionnaireMessages(request)).toEqual([]);

    expect(new URL(page.url()).pathname).toBe("/commerce/questionnaire");
    expect(new URL(page.url()).search).toBe("");
    expect(
      await page.evaluate(
        () => localStorage.length + sessionStorage.length,
      ),
    ).toBe(0);

    await page.reload();
    for (const name of Object.keys(FIELDS) as (keyof typeof FIELDS)[]) {
      await expect(field(page, name)).toHaveValue("");
    }
    await expect(page.getByTestId("questionnaire-link-result")).toHaveCount(0);
  });

  test("checks the session itself when the form is posted", async ({
    page,
    context,
  }) => {
    await signIn(page, COMMERCE_OPERATOR);
    await openTool(page);
    await context.clearCookies();

    await fillSample(page);
    await press(page, page.getByRole("button", { name: "Créer le lien" }));

    await expect(page).toHaveURL(/\/commerce\/connexion/);
    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    await expect(page.getByTestId("questionnaire-link-result")).toHaveCount(0);
  });
});
