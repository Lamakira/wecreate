import { expect, test, type Locator, type Page } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";

/**
 * The Site web offer on the Services page.
 *
 * Its default copy ships in application source, because nothing in it is a
 * commercial figure: WeCreate has no pack or price for websites (spec #55
 * decision 5). The one action is a link to the contact form.
 */

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

const CONTACT_HREF = "/contact?sujet=site-web#formulaire";

function siteWebRegion(page: Page, name = "Site web"): Locator {
  return page.getByRole("region", { name, exact: true });
}

test.describe("Services, Site web", () => {
  test("shows the offer as shipped", async ({ page }) => {
    await page.goto("/services");

    const region = siteWebRegion(page);
    await expect(region).toBeVisible();
    await expect(region.getByRole("heading", { level: 3 })).toHaveText([
      "Site vitrine",
      "Boutique en ligne",
      "Site institutionnel",
      "Page de lancement",
    ]);
    await expect(region.getByRole("link")).toHaveCount(1);
    await expect(region.getByRole("link")).toHaveAccessibleName(/Sur devis/);
  });

  test("publishes no price and no pack", async ({ page }) => {
    await page.goto("/services");

    const region = siteWebRegion(page);
    await expect(region.getByTestId("service-pack")).toHaveCount(0);
    await expect(region.getByTestId("service-pack-price")).toHaveCount(0);
    await expect(region.getByText(/\d\s*F\b|FCFA/)).toHaveCount(0);
    await expect(
      region.getByText(/Pack (Présence|Croissance|Domination|Visite|Souvenir)/),
    ).toHaveCount(0);
  });

  test("ends in a Service Enquiry, never in the cart", async ({ page }) => {
    await page.goto("/services");

    const region = siteWebRegion(page);
    const link = region.getByRole("link");
    await expect(link).toHaveAttribute("href", CONTACT_HREF);
    await expect(region.getByRole("button")).toHaveCount(0);
    await expect(region.locator("form")).toHaveCount(0);
    await expect(page.getByTestId("digital-cart-indicator")).toHaveAttribute(
      "aria-label",
      "Panier, 0 articles",
    );

    await link.click();
    await expect(page).toHaveURL(/\/contact\?sujet=site-web/);
    await expect(
      page.getByLabel("Sujet").locator("option:checked"),
    ).toHaveText("Site web — sur devis");
  });

  test("is reachable at its address", async ({ page }) => {
    await page.goto("/services#site-web");

    await expect(siteWebRegion(page)).toBeInViewport();
  });

  test("belongs to the editor: a draft stays private, a publication reaches the page", async ({
    page,
  }) => {
    await content.editDraft({
      services: {
        siteWeb: {
          title: "Vos sites web",
          intro: "Dites-nous ce dont vous avez besoin.",
          quoteLabel: "Parlons-en",
          formats: [
            {
              key: "portfolio-en-ligne",
              title: "Portfolio en ligne",
              description: "Vos réalisations, mises en scène sur une page.",
            },
          ],
        },
      },
    });

    await page.goto("/services");
    await expect(siteWebRegion(page)).toContainText("Site vitrine");
    await expect(page.getByText("Vos sites web")).toHaveCount(0);

    await content.publish("servicesPage");
    await page.goto("/services");

    const region = siteWebRegion(page, "Vos sites web");
    await expect(region).toBeVisible();
    await expect(region.getByRole("heading", { level: 3 })).toHaveText([
      "Portfolio en ligne",
    ]);
    await expect(
      region.getByText("Dites-nous ce dont vous avez besoin."),
    ).toBeVisible();
    await expect(region.getByText("Site vitrine")).toHaveCount(0);
    await expect(region.getByRole("link", { name: /Parlons-en/ })).toHaveAttribute(
      "href",
      CONTACT_HREF,
    );
  });

  test("keeps the presentation and the action when the list is emptied", async ({
    page,
  }) => {
    await content.editDraft({ services: { siteWeb: { formats: [] } } });
    await content.publish("servicesPage");
    await page.goto("/services");

    const region = siteWebRegion(page);
    await expect(region).toBeVisible();
    await expect(region.getByRole("listitem")).toHaveCount(0);
    await expect(region.getByRole("link", { name: /Sur devis/ })).toBeVisible();
  });
});

test.describe("Services, Site web, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still links to the contact form", async ({ page }) => {
    await page.goto("/services");

    await expect(
      siteWebRegion(page).getByRole("link", { name: /Sur devis/ }),
    ).toHaveAttribute("href", CONTACT_HREF);
  });
});
