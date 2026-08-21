import { expect, test, type Page } from "@playwright/test";

import { ManagedContent, enterPreview, leavePreview } from "./support/managed-content";

/**
 * Contact: three approved channels, and nothing that submits.
 *
 * The design prototype put a five-field form here and answered it with "Demande
 * enregistrée". Issue #1 removed it, so the most important assertions on this
 * page are about absence: no form, no stored lead, no scheduling widget, and no
 * dependence on script for any of the three ways to reach WeCreate.
 */

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

/**
 * The page's own coordinates block.
 *
 * Every lookup below goes through it. The footer carries the same WhatsApp
 * address and the same email on every page of the site, so an unscoped link
 * query would match twice and pass for the wrong reason.
 */
function coordinates(page: Page) {
  return page.getByRole("region", { name: "Coordonnées" });
}

/** One of the three channel entries, by the destination it names. */
function channel(page: Page, name: RegExp | string) {
  return page.getByTestId("contact-channel").filter({
    has: page.getByRole("link", { name }),
  });
}

test.describe("Contact", () => {
  test("opens with the approved heading and what WeCreate commits to", async ({
    page,
  }) => {
    await page.goto("/contact");

    await expect(page).toHaveTitle("Contact · WeCreate");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Dites-nous ce que vous voulez vendre.");
    await expect(heading.locator("em")).toHaveText("vendre");

    await expect(page.getByText("Contact · Devis sous 24-48h")).toBeVisible();

    // The page commits to how fast WeCreate answers, and to nothing else. A
    // delivery figure would be a promise the brief only makes per pack.
    await expect(
      page.getByRole("main").getByText("Devis sous 24-48h.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("main").getByText(/livraison en \d+ jours/i)).toHaveCount(
      0,
    );
  });

  test("offers exactly the three approved channels, each naming where it goes", async ({
    page,
  }) => {
    await page.goto("/contact");

    await expect(page.getByTestId("contact-channel")).toHaveCount(3);

    // WhatsApp: the direct route, and the one that survives everything else
    // being unavailable.
    const whatsapp = coordinates(page).getByRole("link", {
      name: /WhatsApp \+229 01 67 36 67 26/,
    });
    await expect(whatsapp).toHaveAttribute("href", "https://wa.me/2290167366726");
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("rel", /noopener/);
    await expect(
      channel(page, /WhatsApp/).getByText(
        "La voie la plus directe. Décrivez le projet en trois lignes, nous répondons dans la journée ouvrée.",
      ),
    ).toBeVisible();

    // The hosted Discovery Call: an address WeCreate maintains, opened as a
    // link. The accessible name warns that it leaves the tab.
    const call = coordinates(page).getByRole("link", {
      name: "Réserver un appel découverte (nouvel onglet)",
    });
    await expect(call).toHaveAttribute(
      "href",
      "https://calendly.com/wecreate-bj/30min",
    );
    await expect(call).toHaveAttribute("target", "_blank");
    await expect(call).toHaveAttribute("rel", /noopener/);

    // The administrative address. A `mailto:` hands over to the visitor's own
    // mail client, so it must not be forced into a new tab.
    const email = coordinates(page).getByRole("link", {
      name: "Email administratif : wecreate08@gmail.com",
    });
    await expect(email).toHaveAttribute("href", "mailto:wecreate08@gmail.com");
    await expect(email).not.toHaveAttribute("target", "_blank");

    // Every destination is written in the href itself: no redirect, no tracker,
    // nothing between the visitor and where the link says it goes.
    for (const link of await page
      .getByTestId("contact-channel")
      .getByRole("link")
      .all()) {
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^(https:\/\/|mailto:)/);
    }
  });

  test("lists WeCreate's social accounts and where the studio is", async ({
    page,
  }) => {
    await page.goto("/contact");

    const channels = coordinates(page);
    await expect(
      channels.getByRole("link", { name: /Instagram @wecreate\.bj/ }),
    ).toHaveAttribute("href", "https://instagram.com/wecreate.bj");
    await expect(
      channels.getByRole("link", { name: /TikTok @wecreate\.bj/ }),
    ).toHaveAttribute("href", "https://tiktok.com/@wecreate.bj");

    await expect(
      channels.getByText("Studio à Calavi Tankpè, Bénin - sur rendez-vous."),
    ).toBeVisible();
  });

  test("carries no contact form and records nothing a visitor types", async ({
    page,
  }) => {
    await page.goto("/contact");

    // The prototype's form was five fields and a submit button. None of it
    // exists — not scoped to `main`, but anywhere on the page, because version
    // one has no field on any surface that could capture a service lead.
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator("input, textarea, select")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /envoyer|soumettre|demande/i }),
    ).toHaveCount(0);
    await expect(page.getByText("Demande enregistrée")).toHaveCount(0);

    // And the page says so, where a visitor is about to press.
    await expect(page.getByTestId("contact-notice")).toContainText(
      "ce site n'enregistre aucune demande, ne bloque aucune date et n'encaisse aucun paiement pour les prestations",
    );

    // Nothing here can reach commerce either: contacting WeCreate is a Service
    // Enquiry, never an order (ADR-0006).
    await expect(page.getByRole("main").getByText(/fedapay/i)).toHaveCount(0);
    await expect(page.getByTestId("digital-cart-indicator")).toHaveAttribute(
      "aria-label",
      "Panier, 0 articles",
    );
  });

  test("renders without contacting a single third party", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    const foreignRequests: string[] = [];
    page.on("request", (request) => {
      if (!request.url().startsWith(origin)) {
        foreignRequests.push(request.url());
      }
    });

    await page.goto("/contact", { waitUntil: "networkidle" });

    // Calendly is a URL, not an integration: no widget, no iframe, nothing on
    // the critical path of a Benin mobile connection.
    expect(foreignRequests).toEqual([]);
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("explains how a project starts, in order and numbered by position", async ({
    page,
  }) => {
    await page.goto("/contact");

    const steps = page
      .getByRole("region", { name: "Comment démarrer" })
      .getByRole("listitem");
    await expect(steps).toHaveCount(4);

    await expect(steps.nth(0)).toContainText("01");
    await expect(steps.nth(0).getByRole("heading", { level: 3 })).toHaveText(
      "Contact",
    );
    await expect(steps.nth(1)).toContainText("02");
    await expect(steps.nth(1).getByRole("heading", { level: 3 })).toHaveText(
      "Devis sous 24-48h",
    );
    await expect(steps.nth(3)).toContainText("04");
    await expect(steps.nth(3).getByRole("heading", { level: 3 })).toHaveText(
      "Brief & tournage",
    );

    // Signature and deposit are described, not performed: they happen off the
    // website.
    await expect(steps.nth(2)).toContainText("Validation et acompte, hors site.");
  });

  test("reads in the same order however narrow the screen is", async ({
    page,
  }) => {
    await page.goto("/contact");

    // How to write comes before what happens next, in the source — which is the
    // order a phone stacks the two columns into, and the order a screen reader
    // announces them in at any width.
    const regions = await page
      .getByRole("region")
      .filter({ hasText: /Coordonnées|Comment démarrer/ })
      .all();
    const names = await Promise.all(
      regions.map((region) => region.getAttribute("aria-labelledby")),
    );
    expect(names).toEqual([
      "contact-channels-heading",
      "contact-getting-started-heading",
    ]);

    // And nothing reflows into a sideways scroll, at either viewport.
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is operable from the keyboard, one channel at a time", async ({
    page,
  }) => {
    await page.goto("/contact");

    const whatsapp = coordinates(page).getByRole("link", { name: /WhatsApp \+229/ });
    const call = coordinates(page).getByRole("link", { name: /appel découverte/ });
    const email = coordinates(page).getByRole("link", {
      name: /wecreate08@gmail\.com/,
    });

    await whatsapp.focus();
    await expect(whatsapp).toBeFocused();

    // The three channels are consecutive, so a keyboard user reaches the
    // fallback route without traversing anything else.
    await page.keyboard.press("Tab");
    await expect(call).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(email).toBeFocused();

    // Focus is visible where it lands. Asserted after a real Tab, because
    // `:focus-visible` is what draws the ring.
    await expect(email).toHaveCSS("outline-style", "solid");
    await expect(email).toHaveCSS("outline-width", "2px");
  });

  test("belongs to the editor: an unpublished edit stays off the public page", async ({
    page,
  }) => {
    const draftNote = "Réponse le jour même, du lundi au samedi.";

    await content.editDraft({
      contact: { channels: { whatsappNote: draftNote } },
    });

    await page.goto("/contact");
    await expect(page.getByText(draftNote)).toHaveCount(0);
    await expect(page.getByTestId("draft-mode-banner")).toHaveCount(0);

    // The editor sees it in the real page, before anyone else does.
    await enterPreview(page, "/contact");
    await expect(page.getByText(draftNote)).toBeVisible();
    await expect(page.getByTestId("draft-mode-banner")).toBeVisible();
    await leavePreview(page);

    await content.publish();
    await page.goto("/contact");
    await expect(page.getByText(draftNote)).toBeVisible();
  });

  test("follows the contact details edited once for the whole site", async ({
    page,
  }) => {
    await content.editDraft({
      settings: {
        contact: {
          whatsappLabel: "WhatsApp +229 00 00 00 00",
          whatsappUrl: "https://wa.me/2290000000000",
          discoveryCallUrl: "https://cal.example.com/wecreate/30min",
          email: "studio@wecreate.example",
        },
      },
    });
    await content.publish();

    await page.goto("/contact");

    // One edit, and the page, the footer and every service pack move together:
    // an address is never written twice.
    await expect(
      coordinates(page).getByRole("link", { name: /WhatsApp \+229 00 00 00 00/ }),
    ).toHaveAttribute("href", "https://wa.me/2290000000000");
    await expect(
      coordinates(page).getByRole("link", { name: /appel découverte/ }),
    ).toHaveAttribute("href", "https://cal.example.com/wecreate/30min");
    await expect(
      coordinates(page).getByRole("link", { name: /studio@wecreate\.example/ }),
    ).toHaveAttribute("href", "mailto:studio@wecreate.example");
  });
});

test.describe("Contact without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still offers all three ways of reaching WeCreate", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Dites-nous ce que vous voulez vendre.",
    );
    await expect(page.getByTestId("contact-channel")).toHaveCount(3);

    await expect(
      coordinates(page).getByRole("link", {
        name: /WhatsApp \+229 01 67 36 67 26/,
      }),
    ).toHaveAttribute("href", "https://wa.me/2290167366726");
    await expect(
      coordinates(page).getByRole("link", { name: /appel découverte/ }),
    ).toHaveAttribute("href", "https://calendly.com/wecreate-bj/30min");
    await expect(
      coordinates(page).getByRole("link", { name: /wecreate08@gmail\.com/ }),
    ).toHaveAttribute("href", "mailto:wecreate08@gmail.com");

    // Sections that fade in on scroll are plain content without the script.
    const opacity = await page
      .getByRole("heading", { level: 2, name: "Comment démarrer" })
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBe(1);
  });
});

test.describe("Contact with motion switched off", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("keeps every channel visible and still", async ({ page }) => {
    await page.goto("/contact");

    await expect(page.getByTestId("contact-channel")).toHaveCount(3);
    await expect(
      page.getByRole("region", { name: "Comment démarrer" }),
    ).toBeVisible();

    const opacity = await page
      .getByRole("heading", { level: 2, name: "Coordonnées" })
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBe(1);
  });
});
