import { expect, test, type Locator, type Page } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { thirdPartyRequests } from "./support/third-party";

/**
 * Services, and the Service Enquiry they end in.
 *
 * The service catalogue ships in application source — prices and inclusions are
 * WeCreate's own published commercial terms, not approved client work — so
 * these tests read the site as it is deployed rather than seeding fixtures. The
 * one exception is the test that edits a pack, which proves an editor owns
 * these values.
 *
 * What matters most here is what the page does *not* do: a service offer never
 * enters the Digital Cart, never creates an order and never reaches a payment
 * provider (ADR-0006).
 */

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

/** One pack card, by the name in its heading. */
function pack(page: Page, name: string): Locator {
  return page
    .getByTestId("service-pack")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

/** One universe's section. Exact, so it cannot also match the comparison. */
function universe(page: Page, name: string): Locator {
  return page.getByRole("region", { name, exact: true });
}

/**
 * A price exactly as the DOM holds it.
 *
 * Playwright normalises every kind of space before comparing text, which is
 * what makes the readable assertions below possible — and also what would hide
 * a price that had lost its non-breaking spaces and started wrapping across two
 * lines. This reads the characters themselves.
 */
const NON_BREAKING_SPACE = "\u00A0";

async function rawText(locator: Locator): Promise<string> {
  return locator.evaluate((element) => element.textContent ?? "");
}

/** The message a WhatsApp link carries, decoded. */
async function prefilledMessage(link: Locator): Promise<string> {
  const href = await link.getAttribute("href");
  return new URL(href!).searchParams.get("text") ?? "";
}

test.describe("Services", () => {
  test("opens with WeCreate's method and the three universes", async ({
    page,
  }) => {
    await page.goto("/services");

    await expect(page).toHaveTitle("Services · WeCreate");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("La méthode WeCreate.");
    await expect(heading.locator("em")).toHaveText("WeCreate");

    for (const name of ["Entreprises", "Immobilier", "Mariage"]) {
      await expect(
        universe(page, name).getByRole("heading", { level: 2, name }),
      ).toBeVisible();
    }
  });

  test("prices the Entreprises packs as the commercial offer does", async ({
    page,
  }) => {
    await page.goto("/services");

    await expect(
      universe(page, "Entreprises").getByTestId("service-pack"),
    ).toHaveCount(3);

    // The brief's firm pricing, not the design prototype's. Amounts are whole
    // XOF with a non-breaking thousands separator.
    const expected: Array<[string, string, string]> = [
      ["Pack Présence", "350 000 F", "3 mois"],
      ["Pack Croissance", "650 000 F", "6 mois"],
      ["Pack Domination", "1 200 000 F", "12 mois"],
    ];

    for (const [name, price, commitment] of expected) {
      const card = pack(page, name);
      await expect(card.getByText(price, { exact: true })).toBeVisible();
      await expect(card.getByText("par mois", { exact: true })).toBeVisible();
      await expect(card.getByText(commitment, { exact: true })).toBeVisible();
    }

    // Whole XOF, grouped with non-breaking spaces so an amount never wraps.
    expect(
      await rawText(pack(page, "Pack Présence").getByTestId("service-pack-price")),
    ).toBe(`350${NON_BREAKING_SPACE}000${NON_BREAKING_SPACE}F`);

    // Monthly video counts are 4 / 8 / 12 — the brief's numbers. The prototype's
    // 16 for Domination is one of the values issue #1 explicitly supersedes.
    await expect(
      pack(page, "Pack Présence").getByText("4 vidéos verticales cinéma 30-60s par mois"),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Croissance").getByText("8 vidéos par mois"),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Domination").getByText(
        "12 vidéos par mois, verticales et horizontales",
      ),
    ).toBeVisible();
    await expect(page.getByText("16 vidéos")).toHaveCount(0);
  });

  test("prices the Immobilier packs and states how payment is split", async ({
    page,
  }) => {
    await page.goto("/services");

    await expect(
      universe(page, "Immobilier").getByTestId("service-pack"),
    ).toHaveCount(3);

    const visite = pack(page, "Pack Visite Premium");
    await expect(
      visite.getByText("120 000 F", { exact: true }),
    ).toBeVisible();
    await expect(visite.getByText("à l'unité", { exact: true })).toBeVisible();
    // Payment conditions are shown so a client can prepare. They are never
    // computed or collected here — see the Service Enquiry notice.
    await expect(
      visite.getByText("50 % à la réservation, 50 % à la livraison."),
    ).toBeVisible();

    await expect(
      pack(page, "Pack Gestionnaire Pro").getByText("320 000 F", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Gestionnaire Empire").getByText("600 000 F", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Gestionnaire Pro").getByText("Drone inclus"),
    ).toBeVisible();
  });

  test("prices the Mariage packs and keeps Wedding Film Signature sur demande", async ({
    page,
  }) => {
    await page.goto("/services");

    await expect(
      universe(page, "Mariage").getByTestId("service-pack"),
    ).toHaveCount(4);

    await expect(
      pack(page, "Pack Souvenir").getByText("400 000 F", { exact: true }),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Élégance").getByText("750 000 F", { exact: true }),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Héritage").getByText("1 200 000 F", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Souvenir").getByText(
        "70 % à la réservation, la date est alors bloquée. 30 % à la livraison.",
      ),
    ).toBeVisible();

    // The 2027 offer is visible and contactable, but carries no published
    // amount: it is quoted, and its price never appears on the page.
    const signature = pack(page, "Wedding Film Signature");
    await expect(signature.getByText("Sur demande", { exact: true })).toBeVisible();
    await expect(signature.getByText(/2 000 000/)).toHaveCount(0);
    await expect(
      signature.getByRole("link", { name: /Demander un devis/ }),
    ).toBeVisible();
  });

  test("opens a prefilled WhatsApp conversation naming the chosen offer", async ({
    page,
  }) => {
    await page.goto("/services");

    const link = pack(page, "Pack Croissance").getByRole("link", {
      name: /Demander un devis/,
    });

    const href = await link.getAttribute("href");
    expect(href).toContain("https://wa.me/2290167366726?text=");
    // Percent-encoded, so the message survives the trip intact — spaces and
    // accents included.
    expect(href).not.toContain(" ");

    expect(await prefilledMessage(link)).toBe(
      "Bonjour WeCreate. Je vous écris au sujet de Pack Croissance - Entreprises. Pouvons-nous en parler ?",
    );

    // Each pack identifies itself, so WeCreate never has to ask what the
    // message is about.
    expect(
      await prefilledMessage(
        pack(page, "Pack Souvenir").getByRole("link", { name: /Demander un devis/ }),
      ),
    ).toContain("Pack Souvenir - Mariage");
  });

  test("offers a hosted Discovery Call without loading a scheduling widget", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL!).origin;
    const seen: string[] = [];
    page.on("request", (request) => {
      seen.push(request.url());
    });

    await page.goto("/services", { waitUntil: "networkidle" });

    const link = pack(page, "Pack Présence").getByRole("link", {
      name: /Appel découverte/,
    });
    await expect(link).toHaveAttribute(
      "href",
      "https://calendly.com/wecreate-bj/30min",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);

    // Rendering the page contacts nobody: no Calendly script, no iframe, no
    // transactional third party on the critical path of a Benin mobile
    // connection. Cloudflare Web Analytics is the CDN's own beacon (ADR-0011).
    expect(thirdPartyRequests(seen, origin)).toEqual([]);
    await expect(page.locator("iframe")).toHaveCount(0);

    // Whatever the calendar is doing, WhatsApp is beside it on every pack.
    for (const card of await page.getByTestId("service-pack").all()) {
      await expect(card.getByRole("link", { name: /Demander un devis/ })).toHaveCount(1);
      await expect(card.getByRole("link", { name: /Appel découverte/ })).toHaveCount(1);
    }
  });

  test("presents contact as a Service Enquiry, not a reservation", async ({
    page,
  }) => {
    await page.goto("/services");

    const notice = page.getByTestId("service-enquiry-notice");
    await expect(notice).toContainText(
      "le site ne prend aucune commande, ne bloque aucune date et n'encaisse aucun paiement pour les prestations",
    );
    await expect(notice).toContainText(
      "Si le calendrier est lent ou indisponible, WhatsApp reste la voie la plus directe.",
    );
  });

  test("never offers to buy, reserve or pay for a service", async ({ page }) => {
    await page.goto("/services");

    // The prototype sold service packs through the cart, with an "Ajouter au
    // panier" and a "Réserver" button on every card. Neither exists here, and
    // the page has no control that submits anything at all: it is scoped to the
    // page's own content, since the shell legitimately carries a cart button and
    // a "Réserver un appel" link to WhatsApp.
    const main = page.getByRole("main");
    await expect(
      main.getByRole("button", {
        name: /panier|ajouter|réserver|payer|commander|acompte/i,
      }),
    ).toHaveCount(0);
    await expect(
      main.getByRole("link", {
        name: /ajouter au panier|réserver ce pack|payer|acompte/i,
      }),
    ).toHaveCount(0);
    await expect(main.locator("form")).toHaveCount(0);
    // No FedaPay: services are not paid for on this website in version one, so
    // nothing here may even reference the payment provider.
    await expect(main.getByText(/fedapay/i)).toHaveCount(0);

    // And the Digital Cart is untouched by anything on this page.
    await expect(page.getByTestId("digital-cart-indicator")).toHaveAttribute(
      "aria-label",
      "Panier, 0 articles",
    );
  });

  test("compares the Entreprises packs in a table that scrolls rather than squeezing", async ({
    page,
  }) => {
    await page.goto("/services");

    const table = page.getByRole("table", {
      name: "Comparatif des trois abonnements Entreprises",
    });
    await expect(table).toBeVisible();

    // Column headers name the packs and row headers name the criteria, so a
    // cell is announced with both rather than as a bare number.
    for (const column of ["Pack Présence", "Pack Croissance", "Pack Domination"]) {
      await expect(
        table.getByRole("columnheader", { name: column }),
      ).toBeVisible();
    }
    const videos = table.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: "Vidéos par mois" }),
    });
    await expect(videos.getByRole("cell")).toHaveText(["4", "8", "12"]);

    // Every row is complete: a criterion the brief only states for some packs
    // is absent from the table rather than filled in with a guess or with an
    // em dash, which here means "not included".
    const rows = await table.getByRole("row").all();
    for (const row of rows.slice(1)) {
      await expect(row.getByRole("cell")).toHaveCount(3);
    }
    await expect(
      table.getByRole("rowheader", { name: "Bilans" }).locator("xpath=.."),
    ).toContainText("Bilan trimestriel");

    // The table keeps its full width and scrolls inside its own container; the
    // page itself never scrolls sideways, at either viewport.
    const scroller = page.getByTestId("service-comparison-scroller");
    await expect(scroller).toHaveCSS("overflow-x", "auto");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("lists the add-ons at the brief's prices", async ({ page }) => {
    await page.goto("/services");

    const section = page.getByRole("region", {
      name: "À ajouter à n'importe quel pack",
    });
    await expect(section.getByRole("listitem")).toHaveCount(12);

    const drone = section
      .getByRole("listitem")
      .filter({ hasText: "Drone - entreprises et immobilier" });
    await expect(drone.getByText("50 000 F")).toBeVisible();
    await expect(drone.getByText("par vidéo")).toBeVisible();

    // The brief prices one wedding ceremony and several as two separate
    // figures, so each is an add-on of its own rather than a price buried in
    // another one's description.
    await expect(
      section
        .getByRole("listitem")
        .filter({ hasText: "Drone - mariage, plusieurs cérémonies" })
        .getByText("200 000 F"),
    ).toBeVisible();

    await expect(
      section
        .getByRole("listitem")
        .filter({ hasText: "Séance Fashion Robe" })
        .getByText("250 000 F"),
    ).toBeVisible();
  });

  test("is operable from the keyboard, one pack at a time", async ({ page }) => {
    await page.goto("/services");

    const card = pack(page, "Pack Présence");
    const whatsapp = card.getByRole("link", { name: /Demander un devis/ });
    const call = card.getByRole("link", { name: /Appel découverte/ });

    await whatsapp.focus();
    await expect(whatsapp).toBeFocused();

    // The Discovery Call is the very next stop, so a keyboard user reaches the
    // fallback without traversing the rest of the card.
    await page.keyboard.press("Tab");
    await expect(call).toBeFocused();

    // And focus is visible where it lands. Asserted after a real Tab rather
    // than after `focus()`, because `:focus-visible` is what draws the ring and
    // only a keyboard-driven move guarantees it matches.
    await expect(call).toHaveCSS("outline-style", "solid");
    await expect(call).toHaveCSS("outline-width", "2px");
  });

  test("belongs to the editor: a published price change reaches the page", async ({
    page,
  }) => {
    await page.goto("/services");
    await expect(
      pack(page, "Pack Présence").getByText("350 000 F", { exact: true }),
    ).toBeVisible();

    await content.editDraft({
      services: {
        universes: [
          {
            key: "entreprises",
            kicker: "Abonnements mensuels",
            title: "Entreprises",
            intro: "Une présence vidéo constante, pas un one-shot.",
            packs: [
              {
                id: "entreprises-presence",
                name: "Pack Présence",
                priceXof: 375000,
                priceUnit: "par mois",
                isOnRequest: false,
                audience: "TPE, commerces, marques qui démarrent",
                commitment: "3 mois",
                paymentTerms: "100 % du premier mois à la signature.",
                inclusions: ["4 vidéos verticales cinéma 30-60s par mois"],
              },
            ],
          },
        ],
      },
    });
    await content.publish();

    await page.goto("/services");
    await expect(
      pack(page, "Pack Présence").getByText("375 000 F", { exact: true }),
    ).toBeVisible();
    // The enquiry message follows the content, so it can never name a price or
    // a pack the page no longer offers.
    expect(
      await prefilledMessage(
        pack(page, "Pack Présence").getByRole("link", { name: /Demander un devis/ }),
      ),
    ).toContain("Pack Présence - Entreprises");
  });
});

test.describe("Services without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still prices every pack and links to both ways of talking", async ({
    page,
  }) => {
    await page.goto("/services");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "La méthode WeCreate.",
    );
    await expect(page.getByTestId("service-pack")).toHaveCount(10);

    // Contact is an ordinary link on an ordinary page: nothing about reaching
    // WeCreate depends on client-side enhancement.
    const link = pack(page, "Pack Héritage").getByRole("link", {
      name: /Demander un devis/,
    });
    expect(await prefilledMessage(link)).toContain("Pack Héritage - Mariage");

    await expect(
      pack(page, "Pack Héritage").getByRole("link", { name: /Appel découverte/ }),
    ).toHaveAttribute("href", "https://calendly.com/wecreate-bj/30min");

    // Sections that fade in on scroll are plain content without the script.
    const opacity = await page
      .getByRole("heading", { level: 2, name: "Immobilier" })
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBe(1);
  });
});
