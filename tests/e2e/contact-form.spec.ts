import { expect, test, type Page } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { Observation } from "./support/observation";
import { Outbox, storedCommerceData } from "./support/order-access";

/**
 * The contact form: a message emailed to WeCreate, and kept nowhere else.
 *
 * Driven through a browser against the running application, with the fixture
 * email provider standing in for Resend at the outbound boundary. Each scenario
 * sets its own `X-Real-IP`, so the form's per-address budget (five an hour) is
 * not shared with another scenario or another spec; `Observation.reset()` empties
 * the buckets between tests.
 */

const INBOX = "wecreate08@gmail.com";

let content: ManagedContent;
let outbox: Outbox;
let observation: Observation;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  outbox = new Outbox(request);
  observation = new Observation(request);
  await content.reset();
  await outbox.reset();
  await observation.reset();
});

test.afterEach(async () => {
  await content.reset();
});

async function fromAddress(page: Page, address: string) {
  await page.setExtraHTTPHeaders({ "x-real-ip": address });
}

/**
 * Open the page and let it settle before anyone types.
 *
 * The form first drawn is the Suspense fallback, replaced by the live one once
 * the address has been read; text typed in the first is not carried to the
 * second. A visitor is slower than hydration, a script is not.
 */
async function openContact(page: Page, path = "/contact") {
  await page.goto(path);
  await page.waitForFunction(() => {
    const form = document.querySelector('[data-testid="contact-form"]');
    return (
      form !== null &&
      Object.keys(form).some((key) => key.startsWith("__reactProps$"))
    );
  });
}

interface Fill {
  name?: string;
  email?: string;
  telephone?: string;
  subject?: string;
  message?: string;
}

async function fillForm(page: Page, fill: Fill = {}) {
  await page.getByLabel("Nom complet").fill(fill.name ?? "Awa Dossou");
  await page.getByLabel("Email").fill(fill.email ?? "awa@exemple.test");
  if (fill.telephone) {
    await page.getByLabel(/Téléphone/).fill(fill.telephone);
  }
  await page.getByLabel("Sujet").selectOption(fill.subject ?? "branding");
  await page
    .getByLabel("Votre projet en quelques lignes")
    .fill(fill.message ?? "Je lance une marque de savons et je veux une identité.");
}

test.describe("Contact form", () => {
  test("labels every field and reaches them with Tab, in order", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.101");
    await openContact(page);

    const name = page.getByLabel("Nom complet");
    const email = page.getByLabel("Email");
    const telephone = page.getByLabel(/Téléphone/);
    const subject = page.getByLabel("Sujet");
    const message = page.getByLabel("Votre projet en quelques lignes");

    await name.focus();
    await expect(name).toBeFocused();
    for (const next of [email, telephone, subject, message]) {
      await page.keyboard.press("Tab");
      await expect(next).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("contact-submit")).toBeFocused();

    // The trap is neither in the tab order nor in the accessibility tree.
    await expect(page.getByRole("textbox", { name: /Laissez/ })).toHaveCount(0);
    await expect(page.locator('input[name="website"]')).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  test("says what is missing, beside each field, and sends nothing", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.102");
    await openContact(page);

    await page.getByTestId("contact-submit").click();

    const alert = page.getByTestId("contact-form-errors");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute("role", "alert");
    for (const sentence of [
      "Indiquez votre nom.",
      "Indiquez une adresse email valide : c'est là que WeCreate vous répondra.",
      "Choisissez le sujet de votre message.",
      "Décrivez votre projet en quelques lignes.",
    ]) {
      await expect(alert).toContainText(sentence);
    }

    for (const [field, id] of [
      ["name", "contact-name"],
      ["email", "contact-email"],
      ["subject", "contact-subject"],
      ["message", "contact-message"],
    ] as const) {
      const control = page.locator(`#${id}`);
      await expect(control).toHaveAttribute("aria-invalid", "true");
      await expect(control).toHaveAttribute(
        "aria-describedby",
        `contact-error-${field}`,
      );
      await expect(page.locator(`#contact-error-${field}`)).toBeVisible();
    }
    await expect(page.locator("#contact-telephone")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );

    expect(await outbox.messages()).toHaveLength(0);
  });

  test("a valid message reaches WeCreate's inbox, replying to the visitor", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.103");
    await openContact(page);

    await fillForm(page, {
      telephone: "+229 01 97 00 00 00",
      message: "Bonjour,\nje voudrais un devis.",
    });
    await page.getByTestId("contact-submit").click();

    const sent = page.getByTestId("contact-form-sent");
    await expect(sent).toBeVisible();
    await expect(sent).toContainText("awa@exemple.test");
    await expect(sent).toBeFocused();

    const messages = await outbox.messages();
    expect(messages).toHaveLength(1);
    const [message] = messages;
    expect(message.to).toBe(INBOX);
    expect(message.replyTo).toBe("awa@exemple.test");
    expect(message.subject).toContain("Branding — système de marque");
    expect(message.subject).toContain("Awa Dossou");
    expect(message.body).toContain("Bonjour,\nje voudrais un devis.");
    expect(message.body).toContain("+229 01 97 00 00 00");
  });

  test("a double press sends once, and so does the same message again", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.104");
    await openContact(page);

    await fillForm(page);
    await page.getByTestId("contact-submit").dblclick();
    await expect(page.getByTestId("contact-form-sent")).toBeVisible();
    expect(await outbox.messages()).toHaveLength(1);

    await openContact(page);
    await fillForm(page);
    // Pressed until it takes: a press that lands in the instant before the page
    // finishes hydrating is lost, and pressing again is safe by construction —
    // it is the very thing this scenario shows sends once.
    await expect(async () => {
      await page.getByTestId("contact-submit").click();
      await expect(page.getByTestId("contact-form-sent")).toBeVisible({
        timeout: 3000,
      });
    }).toPass();
    expect(await outbox.messages()).toHaveLength(1);
  });

  test("a link can choose the subject, and an unknown one is ignored", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.105");

    await openContact(page, "/contact?sujet=branding#formulaire");
    await expect(page.getByLabel("Sujet")).toHaveValue("branding");
    await expect(page.locator("#formulaire")).toBeInViewport();

    await openContact(page, "/contact?sujet=nimporte");
    await expect(page.getByLabel("Sujet")).toHaveValue("");
  });

  test("a bot that fills the hidden field is told it worked, and nothing is sent", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.106");
    await openContact(page);

    await page
      .locator('input[name="website"]')
      .fill("https://spam.example", { force: true });
    await fillForm(page);
    await page.getByTestId("contact-submit").click();

    await expect(page.getByTestId("contact-form-sent")).toBeVisible();
    expect(await outbox.messages()).toHaveLength(0);
  });

  test("a sixth message in an hour from one address is held, and kept", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.107");

    for (let index = 1; index <= 5; index += 1) {
      await openContact(page);
      await fillForm(page, {
        email: `visiteur${index}@exemple.test`,
        message: `Message numéro ${index}.`,
      });
      await page.getByTestId("contact-submit").click();
      await expect(page.getByTestId("contact-form-sent")).toBeVisible();
    }
    expect(await outbox.messages()).toHaveLength(5);

    await openContact(page);
    await fillForm(page, {
      email: "visiteur6@exemple.test",
      message: "Message numéro 6.",
    });
    await page.getByTestId("contact-submit").click();

    await expect(page.getByTestId("contact-form-errors")).toContainText(
      "Trop de messages",
    );
    await expect(page.getByLabel("Votre projet en quelques lignes")).toHaveValue(
      "Message numéro 6.",
    );
    expect(await outbox.messages()).toHaveLength(5);
  });

  test("a failed send keeps everything typed, and the retry sends once", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.108");
    await openContact(page);

    await outbox.outage("refuse");
    await fillForm(page, { telephone: "+229 01 97 00 00 00" });
    await page.getByTestId("contact-submit").click();

    const alert = page.getByTestId("contact-form-errors");
    await expect(alert).toContainText("n'est pas parti");
    await expect(alert.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
    await expect(page.getByLabel("Nom complet")).toHaveValue("Awa Dossou");
    await expect(page.getByLabel("Email")).toHaveValue("awa@exemple.test");
    await expect(page.getByLabel(/Téléphone/)).toHaveValue("+229 01 97 00 00 00");
    await expect(page.getByLabel("Sujet")).toHaveValue("branding");
    await expect(page.getByLabel("Votre projet en quelques lignes")).toHaveValue(
      "Je lance une marque de savons et je veux une identité.",
    );
    expect(await outbox.messages()).toHaveLength(0);

    await outbox.outage("off");
    await page.getByTestId("contact-submit").click();
    await expect(page.getByTestId("contact-form-sent")).toBeVisible();
    expect(await outbox.messages()).toHaveLength(1);
  });

  test("stores nothing about the visitor beyond the email it sent", async ({
    page,
  }) => {
    await fromAddress(page, "203.0.113.109");
    await openContact(page);

    const address = "awa.discrete@exemple.test";
    const text = "Un texte tout à fait singulier 4821.";
    await fillForm(page, { email: address, message: text });
    await page.getByTestId("contact-submit").click();
    await expect(page.getByTestId("contact-form-sent")).toBeVisible();

    // The commerce data plane may never have been written at all, which is the
    // best answer there is.
    const stored = await storedCommerceData().catch(() => "");
    expect(stored).not.toContain(address);
    expect(stored).not.toContain(text);

    const cookies = await page.context().cookies();
    for (const cookie of cookies) {
      expect(cookie.value).not.toContain(address);
      expect(decodeURIComponent(cookie.value)).not.toContain(address);
    }

    const browserStorage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(browserStorage).not.toContain(address);
    expect(browserStorage).not.toContain(text);
  });
});

test.describe("Contact form without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is still there, with every field labelled", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByTestId("contact-form")).toBeVisible();
    await expect(page.getByLabel("Nom complet")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel(/Téléphone/)).toBeVisible();
    await expect(page.getByLabel("Sujet")).toBeVisible();
    await expect(page.getByLabel("Votre projet en quelques lignes")).toBeVisible();
    await expect(page.getByTestId("contact-submit")).toBeVisible();
  });
});
