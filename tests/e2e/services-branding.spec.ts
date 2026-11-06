import { expect, test, type Locator, type Page } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import {
  SAMPLE_BRANDING_CONDITIONS,
  SAMPLE_BRANDING_PACKS,
} from "./support/sample-content";

/**
 * The Branding packs and their conditions on the Services page.
 *
 * Nothing about the Branding offer ships in application source — names, prices
 * and conditions are entered in the Studio from WeCreate's brochures (issue
 * #61) — so every scenario that needs a pack seeds one through the Managed
 * Content hook, exactly as an editor publishing would.
 */

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

/** Seed the sample Branding packs and conditions, and publish only this page. */
async function publishBranding(): Promise<void> {
  await content.editDraft({
    services: {
      branding: {
        packs: SAMPLE_BRANDING_PACKS,
        conditions: { conditions: SAMPLE_BRANDING_CONDITIONS },
      },
    },
  });
  await content.publish("servicesPage");
}

function pack(page: Page, name: string): Locator {
  return page
    .getByTestId("service-pack")
    .filter({ has: page.getByRole("heading", { level: 3, name, exact: true }) });
}

function brandingRegion(page: Page): Locator {
  return page.getByRole("region", { name: "Branding", exact: true });
}

function conditionsRegion(page: Page): Locator {
  return page.getByRole("region", { name: "Conditions Branding", exact: true });
}

/** The message a WhatsApp link carries, decoded. */
async function prefilledMessage(link: Locator): Promise<string> {
  const href = await link.getAttribute("href");
  return new URL(href!).searchParams.get("text") ?? "";
}

async function expectNoBranding(page: Page): Promise<void> {
  await expect(brandingRegion(page)).toHaveCount(0);
  await expect(conditionsRegion(page)).toHaveCount(0);
  await expect(page.getByTestId("branding-offer")).toHaveCount(0);
}

test.describe("Services, Branding", () => {
  test("is absent as shipped: no Branding pack lives in source", async ({
    page,
  }) => {
    await page.goto("/services");

    await expectNoBranding(page);
    // Only the ten video packs.
    await expect(page.getByTestId("service-pack")).toHaveCount(10);
    await expect(
      page.getByRole("main").getByText(/Identité (Essentielle|Complète|Signature)|Prestige/),
    ).toHaveCount(0);
  });

  test("stays private while it is only a draft", async ({ page }) => {
    await content.editDraft({
      services: {
        branding: {
          packs: SAMPLE_BRANDING_PACKS,
          conditions: { conditions: SAMPLE_BRANDING_CONDITIONS },
        },
      },
    });

    await page.goto("/services");
    await expectNoBranding(page);
  });

  test("presents the published packs and their conditions", async ({ page }) => {
    await publishBranding();
    await page.goto("/services");

    const region = brandingRegion(page);
    await expect(region).toBeVisible();
    await expect(region.getByTestId("service-pack")).toHaveCount(3);
    await expect(
      region.getByTestId("service-pack").getByRole("heading", { level: 3 }),
    ).toHaveText(["Pack Repère", "Pack Système", "Pack Univers"]);

    const repere = pack(page, "Pack Repère");
    await expect(repere.getByText("180 000 F", { exact: true })).toBeVisible();
    await expect(repere.getByText("forfait", { exact: true })).toBeVisible();
    await expect(repere.getByText("2 pistes de logo")).toBeVisible();
    await expect(
      repere.getByText(
        "Payable en 3 fois : 40 % à la commande, 30 % à la validation du logo, 30 % à la livraison.",
      ),
    ).toBeVisible();
    // An empty commitment leaves out its label with it.
    await expect(repere.getByText("Engagement", { exact: true })).toHaveCount(0);

    await expect(
      pack(page, "Pack Système").getByText("360 000 F", { exact: true }),
    ).toBeVisible();
    await expect(
      pack(page, "Pack Univers").getByText("720 000 F", { exact: true }),
    ).toBeVisible();

    const conditions = conditionsRegion(page);
    await expect(conditions.getByRole("listitem")).toHaveCount(6);
    await expect(conditions.getByRole("heading", { level: 3 })).toHaveText([
      "Démarrage",
      "Révisions",
      "Propriété",
      "Impression",
      "TVA",
      "Délais",
    ]);
    await expect(
      conditions.getByText("Deux tours de retouches sont compris dans chaque pack."),
    ).toBeVisible();
  });

  test("ends each pack in a Service Enquiry, never in the cart", async ({
    page,
  }) => {
    await publishBranding();
    await page.goto("/services");

    const card = pack(page, "Pack Système");

    expect(
      await prefilledMessage(card.getByRole("link", { name: /Demander un devis/ })),
    ).toBe(
      "Bonjour WeCreate. Je vous écris au sujet de Pack Système - Branding. Pouvons-nous en parler ?",
    );
    await expect(
      card.getByRole("link", { name: /Appel découverte/ }),
    ).toHaveAttribute("href", "https://calendly.com/wecreate-bj/30min");

    const contact = card.getByRole("link", { name: /Écrire via le formulaire/ });
    await expect(contact).toHaveAttribute("href", "/contact?sujet=branding#formulaire");

    const offer = page.getByTestId("branding-offer");
    await expect(offer.getByRole("button")).toHaveCount(0);
    await expect(offer.locator("form")).toHaveCount(0);
    await expect(page.getByTestId("digital-cart-indicator")).toHaveAttribute(
      "aria-label",
      "Panier, 0 articles",
    );

    await contact.click();
    await expect(page).toHaveURL(/\/contact\?sujet=branding/);
    await expect(
      page.getByLabel("Sujet").locator("option:checked"),
    ).toHaveText("Branding — système de marque");
  });

  test("leaves the comparison and the add-ons about the video packs", async ({
    page,
  }) => {
    await publishBranding();
    await page.goto("/services");

    const table = page.getByRole("table", {
      name: "Comparatif des trois abonnements Entreprises",
    });
    for (const column of ["Pack Présence", "Pack Croissance", "Pack Domination"]) {
      await expect(table.getByRole("columnheader", { name: column })).toBeVisible();
    }
    await expect(table.getByText(/Pack (Repère|Système|Univers)/)).toHaveCount(0);

    const addOns = page.getByRole("region", {
      name: "À ajouter à n'importe quel pack",
    });
    await expect(addOns.getByRole("listitem")).toHaveCount(12);
    await expect(addOns.getByText(/Pack (Repère|Système|Univers)/)).toHaveCount(0);
  });

  test("belongs to the editor: a change reaches the page, and removing the packs removes both sections", async ({
    page,
  }) => {
    await publishBranding();
    await page.goto("/services");
    await expect(pack(page, "Pack Repère")).toBeVisible();

    await content.editDraft({
      services: {
        branding: {
          packs: [
            {
              ...SAMPLE_BRANDING_PACKS[0],
              name: "Pack Repère Plus",
              priceXof: 195000,
            },
            ...SAMPLE_BRANDING_PACKS.slice(1),
          ],
        },
      },
    });
    await content.publish("servicesPage");

    await page.goto("/services");
    const renamed = pack(page, "Pack Repère Plus");
    await expect(renamed.getByText("195 000 F", { exact: true })).toBeVisible();
    expect(
      await prefilledMessage(renamed.getByRole("link", { name: /Demander un devis/ })),
    ).toContain("Pack Repère Plus - Branding");

    // Conditions are still entered, but with no pack there is nothing to
    // condition: both sections go.
    await content.editDraft({ services: { branding: { packs: [] } } });
    await content.publish("servicesPage");

    await page.goto("/services");
    await expectNoBranding(page);
  });
});

test.describe("Services, Branding, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still shows the packs with their three links", async ({ page }) => {
    await publishBranding();
    await page.goto("/services");

    const card = pack(page, "Pack Univers");
    expect(
      await prefilledMessage(card.getByRole("link", { name: /Demander un devis/ })),
    ).toContain("Pack Univers - Branding");
    await expect(card.getByRole("link", { name: /Appel découverte/ })).toHaveCount(1);
    await expect(
      card.getByRole("link", { name: /Écrire via le formulaire/ }),
    ).toHaveAttribute("href", "/contact?sujet=branding#formulaire");
  });
});
