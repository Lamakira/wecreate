import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { Observation } from "./support/observation";
import { Outbox } from "./support/order-access";
import {
  ANSWERS,
  CLIENT_EMAIL,
  SAMPLE_INVITATION,
  TEAM_ADDRESS,
  expectStep,
  fillText,
  fillUntilLastStep,
  invitationPath,
  mintInvitation,
  next,
  openQuestionnaire,
  pngBytes,
  pngFile,
  previous,
  questionnaireMessages,
  sampleInvitation,
  send,
  stepHeading,
  storageSnapshot,
  tamper,
  axisRadio,
  ATTACHMENT_LABEL,
} from "./support/brand-questionnaire";

/**
 * The brand questionnaire (issue #57), driven the way a Branding client uses it.
 *
 * A client reaches it only through a personal link that WeCreate's team made.
 * The link is minted here by hand (see `support/brand-questionnaire.ts` for
 * why) and the browser follows it; the email provider is the fixture at the
 * application's own outbound boundary, so what "sent to WeCreate and to the
 * client" means is read from the outbox and nowhere else.
 *
 * Most of what matters about this feature is a refusal or an absence: a link
 * that never shows the form, an address that never carries a name, nothing
 * written to storage, files refused before any upload, a double press that
 * sends once. Those are asserted as strongly as the journey itself.
 */

const MESSAGES = {
  tooMany: "5 fichiers au plus",
  tooLarge: "ne peut pas dépasser 10 Mo",
  wrongType: "Seules les images",
} as const;

let outbox: Outbox;
let observation: Observation;

test.beforeEach(async ({ request }) => {
  await new ManagedContent(request).reset();
  outbox = new Outbox(request);
  await outbox.reset();
  await outbox.outage("off");
  observation = new Observation(request);
  await observation.reset();
});

test.afterEach(async () => {
  await outbox.outage("off");
});

/** Open the personal link and stay on the form. */
async function arrive(page: Page): Promise<string> {
  const token = mintInvitation(sampleInvitation());
  await openQuestionnaire(page, token);
  return token;
}

/** Walk steps 1 to 3 with nothing answered, to stand on step 4. */
async function goToStepFour(page: Page): Promise<void> {
  await next(page);
  await next(page);
  await next(page);
  await expectStep(page, 4, "Goûts visuels");
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .disableRules(["color-contrast"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual(
    [],
  );
}

/** Press Tab until this control holds focus: keyboard-only navigation. */
async function tabTo(page: Page, target: Locator, max = 120): Promise<void> {
  for (let i = 0; i < max; i += 1) {
    const focused = await target.evaluate(
      (element) => element === document.activeElement,
    );
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the control");
}

async function expectUnavailable(page: Page, heading: string): Promise<void> {
  const unavailable = page.getByTestId("questionnaire-unavailable");
  await expect(unavailable).toBeVisible();
  await expect(unavailable.getByRole("heading", { level: 1 })).toHaveText(heading);

  // Never the form, and nothing that looks like one.
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Envoyer le questionnaire" }),
  ).toHaveCount(0);

  // A way to reach WeCreate.
  await expect(
    unavailable.getByRole("link", { name: /Écrire sur WhatsApp/ }),
  ).toHaveAttribute("href", /wa\.me/);
  await expect(
    unavailable.getByRole("link", { name: "Page contact" }),
  ).toHaveAttribute("href", "/contact");
}

test.describe("Brand questionnaire", () => {
  test("a valid link opens the questionnaire addressed to that client and brand", async ({
    page,
  }) => {
    const token = mintInvitation(sampleInvitation());
    await page.goto(invitationPath(token));

    // The token never stays in the address bar.
    await expect(page).toHaveURL(/\/questionnaire$/);
    expect(new URL(page.url()).pathname).toBe("/questionnaire");
    expect(new URL(page.url()).search).toBe("");

    await expect(
      page.getByRole("heading", { level: 1, name: "Questionnaire de marque." }),
    ).toBeVisible();
    await expect(page.getByText("Bonjour Aïcha Dossou.")).toBeVisible();
    await expect(
      page.getByText("Référence WC-Q48213 · Identité Complète"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Nom de la marque", { exact: true }),
    ).toHaveValue("Maison Kéré");

    // Nothing readable about the client in the address, in any spelling.
    const url = page.url().toLowerCase();
    for (const forbidden of [
      "dossou",
      "aicha",
      "aïcha",
      "a%c3%afcha",
      "kéré",
      "k%c3%a9r%c3%a9",
      "maison",
      "wc-q48213",
      "@",
      "%40",
    ]) {
      expect(url, `the address does not carry "${forbidden}"`).not.toContain(
        forbidden,
      );
    }
    expect(decodeURIComponent(url)).not.toContain("dossou");

    // And the token itself is unreadable, not merely hidden from the bar.
    const bytes = Buffer.from(token, "base64url");
    for (const secret of ["Aïcha Dossou", "Dossou", "Maison Kéré", "WC-Q48213"]) {
      expect(bytes.includes(Buffer.from(secret, "utf8"))).toBe(false);
    }
    expect(token).not.toContain("Dossou");
  });

  test.describe("a link that must never show the form", () => {
    const cases: {
      name: string;
      token: () => string | null;
      heading: string;
    }[] = [
      {
        name: "random garbage",
        token: () => "x".repeat(120),
        heading: "Ce lien ne s'ouvre pas.",
      },
      {
        name: "a string too short to be a token",
        token: () => "abc",
        heading: "Ce lien ne s'ouvre pas.",
      },
      {
        name: "a valid token with one character changed",
        token: () => tamper(mintInvitation(sampleInvitation())),
        heading: "Ce lien ne s'ouvre pas.",
      },
      {
        name: "a token made with another secret",
        token: () =>
          mintInvitation(sampleInvitation(), "another-secret-nobody-configured"),
        heading: "Ce lien ne s'ouvre pas.",
      },
      {
        name: "an expired token",
        token: () =>
          mintInvitation(
            sampleInvitation({ expiresAt: new Date(Date.now() - 60_000) }),
          ),
        heading: "Ce lien a expiré.",
      },
      {
        name: "no link at all",
        token: () => null,
        heading: "Ce lien ne s'ouvre pas.",
      },
    ];

    for (const scenario of cases) {
      test(`${scenario.name} explains itself and shows no form`, async ({
        page,
      }) => {
        const token = scenario.token();
        await page.goto(token === null ? "/questionnaire" : invitationPath(token));
        await expect(page).toHaveURL(/\/questionnaire$/);
        await expectUnavailable(page, scenario.heading);
      });
    }

    test("a valid link followed by an invalid one: the invalid one wins", async ({
      page,
    }) => {
      await arrive(page);
      await expect(page.getByRole("form")).toBeVisible();

      await page.goto(invitationPath(tamper(mintInvitation(sampleInvitation()))));
      await expectUnavailable(page, "Ce lien ne s'ouvre pas.");

      // The old link's cookie is gone, so reopening the bare address stays closed.
      await page.goto("/questionnaire");
      await expectUnavailable(page, "Ce lien ne s'ouvre pas.");
    });
  });

  test("all five steps work from the keyboard and are announced", async ({
    page,
  }) => {
    await arrive(page);
    const brand = page.getByLabel("Nom de la marque", { exact: true });
    const suivant = page.getByRole("button", { name: "Suivant" });

    // Step 1: an empty brand stops the client, says why, and lands on the field.
    await tabTo(page, brand);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await tabTo(page, suivant);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("error-brand")).toHaveText(
      "Indiquez le nom de la marque.",
    );
    await expect(brand).toHaveAttribute("aria-invalid", "true");
    await expect(brand).toBeFocused();
    await expect(stepHeading(page)).toHaveText("Étape 1 sur 5 · Entreprise");

    await page.keyboard.type("Maison Kéré");
    await tabTo(page, suivant);
    await page.keyboard.press("Enter");
    await expectStep(page, 2, "Cible");
    await expect(page.locator('[aria-current="step"]')).toContainText("02");
    await expect(page.locator('[aria-current="step"]')).toContainText("Cible");

    // Shift+Tab goes back through the controls, and Précédent goes back a step.
    await tabTo(page, suivant);
    await page.keyboard.press("Shift+Tab");
    await expect(suivant).not.toBeFocused();
    await tabTo(page, page.getByRole("button", { name: "Précédent" }));
    await page.keyboard.press("Enter");
    await expectStep(page, 1, "Entreprise");
    await expect(page.locator('[aria-current="step"]')).toContainText("Entreprise");
    await expect(brand).toHaveValue("Maison Kéré");
    await expectNoAxeViolations(page);

    await tabTo(page, suivant);
    await page.keyboard.press("Enter");
    await expectStep(page, 2, "Cible");

    // Step 2: arrow keys choose a price, Space toggles a zone.
    await tabTo(page, page.getByRole("radio", { name: "Accessible", exact: true }));
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("radio", { name: "Premium", exact: true }),
    ).toBeChecked();
    const cotonou = page.getByRole("checkbox", { name: "Cotonou", exact: true });
    await tabTo(page, cotonou);
    await page.keyboard.press("Space");
    await expect(cotonou).toBeChecked();
    await page.keyboard.press("Space");
    await expect(cotonou).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(cotonou).toBeChecked();
    await tabTo(page, suivant);
    await page.keyboard.press("Enter");
    await expectStep(page, 3, "Personnalité");
    await expect(page.locator('[aria-current="step"]')).toContainText("Personnalité");
    await expectNoAxeViolations(page);

    // Step 3: a personality scale answered with the arrow keys.
    await tabTo(page, axisRadio(page, "Classique ou Moderne", 1));
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(axisRadio(page, "Classique ou Moderne", 4)).toBeChecked();
    await tabTo(page, suivant);
    await page.keyboard.press("Enter");
    await expectStep(page, 4, "Goûts visuels");
    await expect(page.locator('[aria-current="step"]')).toContainText("Goûts visuels");
    await expectNoAxeViolations(page);

    // Step 4: a logo card is a checkbox.
    const monogramme = page.getByRole("checkbox", {
      name: "Monogramme",
      exact: true,
    });
    await tabTo(page, monogramme);
    await page.keyboard.press("Space");
    await expect(monogramme).toBeChecked();
    await tabTo(page, suivant);
    await page.keyboard.press("Enter");
    await expectStep(page, 5, "Supports");
    await expect(page.locator('[aria-current="step"]')).toContainText("Supports");

    // Step 5: the email is required, and the client is taken to it.
    const email = page.getByLabel("Votre email", { exact: true });
    const envoyer = page.getByRole("button", { name: "Envoyer le questionnaire" });
    await tabTo(page, envoyer);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("error-email")).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toBeFocused();
    await expect(page.getByTestId("questionnaire-sent")).toHaveCount(0);

    await page.keyboard.type(CLIENT_EMAIL);
    await tabTo(page, envoyer);
    await page.keyboard.press("Enter");

    const sent = page.getByTestId("questionnaire-sent");
    await expect(sent).toBeVisible();
    await expect(sent).toContainText(CLIENT_EMAIL);
    await expect(sent.getByRole("heading", { level: 1 })).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test("the unavailable page has no WCAG 2.2 AA violations axe can see", async ({
    page,
  }) => {
    await page.goto("/questionnaire");
    await expectUnavailable(page, "Ce lien ne s'ouvre pas.");
    await expectNoAxeViolations(page);
  });

  test("the logo cards are drawn with the client's brand name", async ({
    page,
  }) => {
    await arrive(page);
    await goToStepFour(page);

    for (const id of ["typographique", "combine", "embleme"]) {
      await expect(page.getByTestId(`logo-sample-${id}`)).toContainText(
        "Maison Kéré",
      );
    }
    await expect(page.getByTestId("logo-sample-monogramme")).toContainText("MK");

    // Changing the brand on step 1 redraws them.
    await previous(page);
    await previous(page);
    await previous(page);
    await expectStep(page, 1, "Entreprise");
    await fillText(page, "Nom de la marque", "Atelier Sô");
    await goToStepFour(page);

    for (const id of ["typographique", "combine", "embleme"]) {
      await expect(page.getByTestId(`logo-sample-${id}`)).toContainText(
        "Atelier Sô",
      );
    }
    await expect(page.getByTestId("logo-sample-monogramme")).toContainText("AS");
    await expect(page.getByTestId("logo-sample-monogramme")).not.toContainText(
      "MK",
    );
  });

  test("submitting sends one email to WeCreate and one copy to the client", async ({
    page,
    request,
  }) => {
    const logo = pngFile("logo-actuel.png", 1500, "l");
    const facade = pngFile("facade.png", 2600, "f");
    await arrive(page);
    await fillUntilLastStep(page, { files: [logo, facade] });
    await send(page);

    const sent = page.getByTestId("questionnaire-sent");
    await expect(sent).toBeVisible();
    await expect(sent).toContainText(CLIENT_EMAIL);

    const messages = await questionnaireMessages(request);
    expect(messages).toHaveLength(2);

    const team = messages.find((message) => message.to === TEAM_ADDRESS);
    const copy = messages.find((message) => message.to === CLIENT_EMAIL);
    expect(team, "a message reached WeCreate").toBeDefined();
    expect(copy, "a copy reached the client").toBeDefined();

    expect(team!.replyTo).toBe(CLIENT_EMAIL);
    expect(team!.subject).toBe("Questionnaire de marque · Maison Kéré · WC-Q48213");
    for (const expected of [
      SAMPLE_INVITATION.client,
      SAMPLE_INVITATION.pack,
      SAMPLE_INVITATION.reference,
      "Positionnement prix : Premium",
      "Classique ↔ Moderne : 4/5",
      "Monogramme",
      "Typographique",
      ANSWERS.sector,
      ANSWERS.audience,
      "Calavi",
      "Cotonou",
      "Packaging",
      "Site web",
      "logo-actuel.png",
      "facade.png",
    ]) {
      expect(team!.body, `WeCreate's message says "${expected}"`).toContain(expected);
    }

    expect(copy!.subject).toBe("Votre questionnaire de marque · Maison Kéré");
    expect(copy!.body.startsWith("Bonjour Aïcha Dossou,")).toBe(true);
    expect(copy!.body).toContain("Positionnement prix : Premium");

    // The files that arrive are the files that were chosen, byte for byte.
    for (const message of [team!, copy!]) {
      expect(message.attachments, "both messages carry the files").toHaveLength(2);
      for (const file of [logo, facade]) {
        const attached = message.attachments!.find(
          (candidate) => candidate.filename === file.name,
        );
        expect(attached, `${file.name} is attached`).toBeDefined();
        expect(attached!.contentType).toBe("image/png");
        expect(
          Buffer.from(attached!.content, "base64").equals(file.buffer),
          `${file.name} arrives unchanged`,
        ).toBe(true);
      }
    }
  });

  test("a double click on Envoyer sends once", async ({ page, request }) => {
    await arrive(page);
    await fillUntilLastStep(page);

    await page
      .getByRole("button", { name: "Envoyer le questionnaire" })
      .dblclick();

    await expect(page.getByTestId("questionnaire-sent")).toBeVisible();
    const messages = await questionnaireMessages(request);
    expect(messages).toHaveLength(2);
    expect(messages.filter((message) => message.to === TEAM_ADDRESS)).toHaveLength(1);
    expect(messages.filter((message) => message.to === CLIENT_EMAIL)).toHaveLength(1);
  });

  test("Enter pressed twice in a row sends once", async ({ page, request }) => {
    await arrive(page);
    await fillUntilLastStep(page);

    const envoyer = page.getByRole("button", { name: "Envoyer le questionnaire" });
    await envoyer.focus();
    await Promise.all([
      page.keyboard.press("Enter"),
      page.keyboard.press("Enter"),
    ]);

    await expect(page.getByTestId("questionnaire-sent")).toBeVisible();
    expect(await questionnaireMessages(request)).toHaveLength(2);
  });

  test("a send retried after a refusal reaches each address once, under stable keys", async ({
    page,
    request,
  }) => {
    await arrive(page);
    await fillUntilLastStep(page);

    await outbox.outage("refuse");
    await send(page);
    await expect(page.getByTestId("send-error")).toBeVisible();
    expect(await questionnaireMessages(request)).toHaveLength(0);

    await outbox.outage("off");
    await send(page);
    await expect(page.getByTestId("questionnaire-sent")).toBeVisible();

    const messages = await questionnaireMessages(request);
    expect(messages).toHaveLength(2);
    const keys = messages.map((message) => message.idempotencyKey);
    expect(keys.filter((key) => key.endsWith("-team"))).toHaveLength(1);
    expect(keys.filter((key) => key.endsWith("-client"))).toHaveLength(1);
    for (const key of keys) {
      expect(key).toMatch(/^brand-questionnaire-WC-Q48213-[0-9a-f]{32}-(team|client)$/);
    }
  });

  test("nothing about the client is written to the database or to storage", async ({
    page,
  }) => {
    await arrive(page);
    // Opening the page may seed fixture files by reading content; the snapshot
    // is taken once that has happened, so only the journey itself is measured.
    const before = await storageSnapshot();

    await fillUntilLastStep(page, { files: [pngFile("logo.png", 1200, "s")] });
    await send(page);
    await expect(page.getByTestId("questionnaire-sent")).toBeVisible();

    const after = await storageSnapshot();
    expect(after.files).toEqual(before.files);
    expect(after.commerce).toBe(before.commerce);
    expect(after.content).toBe(before.content);

    // Reading storage here for the reason `support/order-access.ts` does: that
    // nothing is kept is a durable outcome no page can show.
    for (const stored of [after.commerce, after.content]) {
      for (const secret of [
        "Aïcha",
        "Dossou",
        "Maison Kéré",
        "WC-Q48213",
        CLIENT_EMAIL,
        ANSWERS.pitch,
        ANSWERS.story,
        ANSWERS.audience,
        ANSWERS.competitors,
        "logo.png",
      ]) {
        expect(stored).not.toContain(secret);
      }
    }
  });

  test.describe("attachments refused before upload", () => {
    test("too many files", async ({ page, request }) => {
      const posts: string[] = [];
      await arrive(page);
      await goToStepFour(page);
      const input = page.getByLabel(ATTACHMENT_LABEL);

      await input.setInputFiles([pngFile("une.png", 300, "1")]);
      const list = page.getByTestId("attachment-list").getByRole("listitem");
      await expect(list).toHaveCount(1);

      page.on("request", (candidate) => {
        if (
          candidate.method() === "POST" &&
          new URL(candidate.url()).origin === new URL(page.url()).origin
        ) {
          posts.push(candidate.url());
        }
      });
      await input.setInputFiles(
        [1, 2, 3, 4, 5, 6].map((n) => pngFile(`photo-${n}.png`, 300, String(n))),
      );

      await expect(page.getByTestId("attachment-error")).toContainText(
        MESSAGES.tooMany,
      );
      await expect(list).toHaveCount(1);
      await expect(page.getByTestId("attachment-list")).toContainText("une.png");
      expect(posts, "no request carried the files").toEqual([]);
      expect(await questionnaireMessages(request)).toHaveLength(0);
    });

    test("files that together weigh more than 10 Mo", async ({ page, request }) => {
      const posts: string[] = [];
      await arrive(page);
      await goToStepFour(page);
      // Same-origin only: the analytics beacon posts to its own collector,
      // and what matters is that nothing reached WeCreate's server.
      page.on("request", (candidate) => {
        if (
          candidate.method() === "POST" &&
          new URL(candidate.url()).origin === new URL(page.url()).origin
        ) {
          posts.push(candidate.url());
        }
      });

      await page.getByLabel(ATTACHMENT_LABEL).setInputFiles([
        {
          name: "enorme.png",
          mimeType: "image/png",
          buffer: pngBytes(Math.round(10.5 * 1024 * 1024), "e"),
        },
      ]);

      await expect(page.getByTestId("attachment-error")).toContainText(
        MESSAGES.tooLarge,
      );
      await expect(
        page.getByTestId("attachment-list").getByRole("listitem"),
      ).toHaveCount(0);
      expect(posts, "no request carried the file").toEqual([]);
      expect(await questionnaireMessages(request)).toHaveLength(0);
    });

    test("a file that is neither an image nor a PDF", async ({ page, request }) => {
      const posts: string[] = [];
      await arrive(page);
      await goToStepFour(page);
      // Same-origin only: the analytics beacon posts to its own collector,
      // and what matters is that nothing reached WeCreate's server.
      page.on("request", (candidate) => {
        if (
          candidate.method() === "POST" &&
          new URL(candidate.url()).origin === new URL(page.url()).origin
        ) {
          posts.push(candidate.url());
        }
      });

      await page.getByLabel(ATTACHMENT_LABEL).setInputFiles([
        { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("bonjour") },
      ]);

      await expect(page.getByTestId("attachment-error")).toContainText(
        MESSAGES.wrongType,
      );
      await expect(
        page.getByTestId("attachment-list").getByRole("listitem"),
      ).toHaveCount(0);
      expect(posts, "no request carried the file").toEqual([]);
      expect(await questionnaireMessages(request)).toHaveLength(0);
    });
  });

  test("a failed send keeps the answers on screen and says what to do", async ({
    page,
    request,
  }) => {
    await arrive(page);
    await fillUntilLastStep(page, { files: [pngFile("logo.png", 900, "k")] });

    await outbox.outage("refuse");
    await send(page);

    const error = page.getByTestId("send-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText("L'envoi n'a pas abouti");
    await expect(error).toContainText("réessayez");
    expect(await questionnaireMessages(request)).toHaveLength(0);

    // Still on step 5, still filled, and usable again.
    await expect(stepHeading(page)).toHaveText("Étape 5 sur 5 · Supports");
    await expect(page.getByLabel("Votre email", { exact: true })).toHaveValue(
      CLIENT_EMAIL,
    );
    await expect(
      page.getByRole("button", { name: "Envoyer le questionnaire" }),
    ).toBeEnabled();
    await expect(page.getByTestId("questionnaire-sent")).toHaveCount(0);

    // Earlier answers and the attachment are intact.
    await previous(page);
    await expectStep(page, 4, "Goûts visuels");
    await expect(
      page.getByLabel("Marques que vous admirez, et pourquoi", { exact: true }),
    ).toHaveValue(ANSWERS.admire);
    await expect(
      page.getByRole("checkbox", { name: "Monogramme", exact: true }),
    ).toBeChecked();
    await expect(page.getByTestId("attachment-list")).toContainText("logo.png");
    await previous(page);
    await expect(axisRadio(page, ANSWERS.axis.name, ANSWERS.axis.point)).toBeChecked();

    // The failure was reported, without the client's details.
    const failures = (await observation.events()).filter(
      (event) => event.kind === "email-failure",
    );
    expect(failures.length).toBeGreaterThan(0);
    const reported = JSON.stringify(failures);
    for (const secret of [CLIENT_EMAIL, "Aïcha", "Dossou", "Maison Kéré"]) {
      expect(reported).not.toContain(secret);
    }

    // And trying again once the provider is back sends.
    await outbox.outage("off");
    await next(page);
    await next(page);
    await send(page);
    await expect(page.getByTestId("questionnaire-sent")).toBeVisible();
    expect(await questionnaireMessages(request)).toHaveLength(2);
  });

  test("progress survives a reload and is cleared once the answers are sent", async ({
    page,
  }) => {
    await arrive(page);
    await fillText(page, "Secteur d'activité", ANSWERS.sector);
    await next(page);
    await expectStep(page, 2, "Cible");
    await fillText(page, "À qui vendez-vous ?", ANSWERS.audience);
    await next(page);
    await next(page);
    await expectStep(page, 4, "Goûts visuels");
    await fillText(page, "Marques que vous admirez, et pourquoi", ANSWERS.admire);
    await page
      .getByLabel(ATTACHMENT_LABEL)
      .setInputFiles([pngFile("inspiration.png", 800, "i")]);
    await expect(page.getByTestId("attachment-list")).toContainText(
      "inspiration.png",
    );

    // The draft lives in this browser's own storage; reloading before it has
    // been written would prove nothing.
    await expect
      .poll(() => page.evaluate(async () => (await indexedDB.databases()).length))
      .toBeGreaterThan(0);

    await page.reload();

    await expect(stepHeading(page)).toHaveText("Étape 4 sur 5 · Goûts visuels");
    await expect(
      page.getByLabel("Marques que vous admirez, et pourquoi", { exact: true }),
    ).toHaveValue(ANSWERS.admire);
    await expect(page.getByTestId("attachment-list")).toContainText(
      "inspiration.png",
    );
    await previous(page);
    await previous(page);
    await expect(page.getByLabel("À qui vendez-vous ?", { exact: true })).toHaveValue(
      ANSWERS.audience,
    );
    await previous(page);
    await expect(page.getByLabel("Secteur d'activité", { exact: true })).toHaveValue(
      ANSWERS.sector,
    );

    // Send, then come back: the draft is gone, the link's brand is back.
    await next(page);
    await next(page);
    await next(page);
    await next(page);
    await fillText(page, "Votre email", CLIENT_EMAIL);
    await send(page);
    await expect(page.getByTestId("questionnaire-sent")).toBeVisible();

    await expect(async () => {
      await page.reload();
      await expect(stepHeading(page)).toHaveText("Étape 1 sur 5 · Entreprise", {
        timeout: 2_000,
      });
      await expect(
        page.getByLabel("Secteur d'activité", { exact: true }),
      ).toHaveValue("", { timeout: 2_000 });
    }).toPass();
    await expect(page.getByLabel("Nom de la marque", { exact: true })).toHaveValue(
      "Maison Kéré",
    );
    await expect(page.getByTestId("questionnaire-sent")).toHaveCount(0);
  });
});
