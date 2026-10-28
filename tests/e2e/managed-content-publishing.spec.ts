import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { DEFAULT_SITE_CONTENT } from "../../src/managed-content/default-content";
import { ManagedContent, enterPreview } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

const PUBLISHED_HEADLINE = "Nous fabriquons des œuvres qui font vendre.";
const DRAFT_EMPHASIS = "films";
const DRAFT_HEADLINE = "Nous fabriquons des films qui font vendre.";

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

test.describe("Editing and publishing Managed Content", () => {
  test("keeps an unpublished edit off the public site", async ({ page }) => {
    await content.editDraft({
      homePage: { hero: { headline: { emphasis: DRAFT_EMPHASIS } } },
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      PUBLISHED_HEADLINE,
    );
    await expect(page.getByTestId("draft-mode-banner")).toHaveCount(0);
  });

  test("previews an unpublished edit in the real application", async ({
    page,
  }) => {
    await content.editDraft({
      homePage: { hero: { headline: { emphasis: DRAFT_EMPHASIS } } },
    });

    await enterPreview(page);

    // The preview is the production page itself — same header, same footer,
    // same sections — with the draft copy in place and a banner making it
    // impossible to mistake for the live site.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      DRAFT_HEADLINE,
    );
    await expect(page.getByTestId("draft-mode-banner")).toBeVisible();
    await expect(page.getByRole("region", { name: "Ce qu'on fait" })).toBeVisible();
  });

  test("publishing puts the edit live on the next request", async ({ page }) => {
    await content.editDraft({
      homePage: { hero: { headline: { emphasis: DRAFT_EMPHASIS } } },
    });
    await content.publish();

    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      DRAFT_HEADLINE,
    );
  });

  test("hides a section the editor switched off", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("region", { name: "La boutique" }),
    ).toBeVisible();

    await content.editDraft({
      homePage: { shopPreview: { isVisible: false } },
    });
    await content.publish();

    await page.goto("/");

    await expect(page.getByRole("region", { name: "La boutique" })).toHaveCount(0);
    // Hiding one section leaves the rest of the page intact.
    await expect(page.getByRole("region", { name: "Ce qu'on fait" })).toBeVisible();
  });

  test("takes navigation labels from Managed Content", async ({
    page,
    isMobile,
  }) => {
    await content.editDraft({
      settings: {
        navigation: [
          { label: "Accueil", href: "/" },
          { label: "Nos films", href: "/portfolio" },
        ],
      },
    });
    await content.publish();

    await page.goto("/");

    if (isMobile) {
      await page.getByTestId("navigation-menu-button").click();
    }
    const nav = page.getByRole("navigation", {
      name: isMobile ? "Navigation mobile" : "Navigation principale",
    });
    await expect(nav.getByRole("link")).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Nos films" })).toHaveAttribute(
      "href",
      "/portfolio",
    );
  });

  test("refuses to open a preview without the shared secret", async ({
    page,
    request,
  }) => {
    await content.editDraft({
      homePage: { hero: { headline: { emphasis: DRAFT_EMPHASIS } } },
    });

    const response = await request.get("/api/draft/enable?secret=wrong");
    expect(response.status()).toBe(401);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      PUBLISHED_HEADLINE,
    );
  });

  test("refuses to revalidate for an unauthenticated caller", async ({
    request,
  }) => {
    const response = await request.post("/api/revalidate");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ revalidated: false });
  });

  test("accepts revalidation from an authenticated caller", async () => {
    expect(await content.triggerRevalidation()).toBe(200);
  });
});

/**
 * Scoped cache invalidation (issue #24).
 *
 * Two different claims, proved two different ways.
 *
 * What a render costs is counted: the fixture logs one line per published
 * read, so "at most one provider round trip" is an exact number and any
 * fan-out shows up as a 2.
 *
 * What a publish expires is proved by staleness, not by counting. Every page
 * is warmed, then several slices are edited at once and published, and the
 * publish names only one document type. A page whose entry was really left
 * alone still shows the OLD text, because that is all its cache holds; a page
 * whose entry was expired shows the NEW text. If a publish expired too much,
 * the "old" assertions fail — which is the point.
 */
test.describe("Scoped cache invalidation", () => {
  const ABOUT_KICKER = {
    old: "À propos · Studio à Calavi Tankpè",
    new: "À propos · Studio révisé",
  };
  const SERVICES_KICKER = {
    old: "Services · Trois univers",
    new: "Services · Révisés",
  };
  const CONTACT_KICKER = {
    old: "Contact · Devis sous 24-48h",
    new: "Contact · Révisé",
  };
  const BOUTIQUE_KICKER = {
    old: "Boutique · Paiement en FCFA",
    new: "Boutique · Révisée",
  };
  // The portfolio kicker is printed with the project count after it.
  const PORTFOLIO_KICKER = { old: "Portfolio ·", new: "Portfolio révisé ·" };
  const HOME_HEADLINE = {
    old: "Nous fabriquons des œuvres qui font vendre.",
    new: "Nous fabriquons des films qui font vendre.",
  };
  const BRANDING_HEADLINE = {
    old: "Une marque pensée pour bouger.",
    new: "Une marque pensée pour durer.",
  };
  const SITE_WEB_HEADLINE = {
    old: "Un site qui se regarde comme un film.",
    new: "Un site qui se lit comme un film.",
  };
  // Neither title contains the other, so a substring match cannot confuse them.
  const PROJECT_TITLE = { old: "Résidence Aurora", new: "Aurora Révisée" };
  const PRODUCT_TITLE = {
    old: "Color Grading Signature",
    new: "Grading Révisé",
  };

  /** The pages that are cached per page. */
  const PAGE_PATHS = [
    "/",
    "/a-propos",
    "/services",
    "/contact",
    "/portfolio",
    "/boutique",
    "/branding",
    "/site-web",
  ];

  type PageName =
    | "home"
    | "about"
    | "services"
    | "contact"
    | "portfolio"
    | "boutique"
    | "branding"
    | "siteWeb";

  const EVERY_PAGE: readonly PageName[] = [
    "home",
    "about",
    "services",
    "contact",
    "portfolio",
    "boutique",
    "branding",
    "siteWeb",
  ];

  async function expectText(
    page: Page,
    text: string,
    present: boolean,
    exact = true,
  ) {
    const match = page.getByText(text, { exact });
    if (present) {
      await expect(match.first()).toBeAttached();
    } else {
      await expect(match).toHaveCount(0);
    }
  }

  /**
   * What each page shows once `editEverything` has been published. A page is
   * either served from an entry filled before the edit (OLD) or from one
   * filled after the publish (NEW); never a mixture, because one page is one
   * entry.
   */
  const probes: Record<
    PageName,
    { path: string; check: (page: Page, isNew: boolean) => Promise<void> }
  > = {
    home: {
      path: "/",
      async check(page, isNew) {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          isNew ? HOME_HEADLINE.new : HOME_HEADLINE.old,
        );
        await expectText(page, PROJECT_TITLE.new, isNew);
        await expectText(page, PROJECT_TITLE.old, !isNew);
        await expectText(page, PRODUCT_TITLE.new, isNew);
        await expectText(page, PRODUCT_TITLE.old, !isNew);
      },
    },
    about: {
      path: "/a-propos",
      async check(page, isNew) {
        await expectText(page, ABOUT_KICKER.new, isNew);
        await expectText(page, ABOUT_KICKER.old, !isNew);
      },
    },
    services: {
      path: "/services",
      async check(page, isNew) {
        await expectText(page, SERVICES_KICKER.new, isNew);
        await expectText(page, SERVICES_KICKER.old, !isNew);
      },
    },
    contact: {
      path: "/contact",
      async check(page, isNew) {
        await expectText(page, CONTACT_KICKER.new, isNew);
        await expectText(page, CONTACT_KICKER.old, !isNew);
      },
    },
    portfolio: {
      path: "/portfolio",
      async check(page, isNew) {
        await expectText(page, PORTFOLIO_KICKER.new, isNew, false);
        await expectText(page, PORTFOLIO_KICKER.old, !isNew, false);
        await expectText(page, PROJECT_TITLE.new, isNew);
        await expectText(page, PROJECT_TITLE.old, !isNew);
      },
    },
    boutique: {
      path: "/boutique",
      async check(page, isNew) {
        await expectText(page, BOUTIQUE_KICKER.new, isNew);
        await expectText(page, BOUTIQUE_KICKER.old, !isNew);
        await expectText(page, PRODUCT_TITLE.new, isNew);
        await expectText(page, PRODUCT_TITLE.old, !isNew);
      },
    },
    branding: {
      path: "/branding",
      async check(page, isNew) {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          isNew ? BRANDING_HEADLINE.new : BRANDING_HEADLINE.old,
        );
      },
    },
    siteWeb: {
      path: "/site-web",
      async check(page, isNew) {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          isNew ? SITE_WEB_HEADLINE.new : SITE_WEB_HEADLINE.old,
        );
      },
    },
  };

  /**
   * Publish the sample projects, so there is a real `/portfolio/<slug>` and a
   * homepage reel, and leave nothing counted.
   */
  async function seedProjects() {
    await content.editDraft({
      portfolio: { projects: SAMPLE_PORTFOLIO_PROJECTS },
    });
    await content.publish();
    await content.resetReadCount();
  }

  /**
   * Warm every page's cache entry over plain HTTP.
   *
   * No browser, so no link prefetch can fill an entry in the background
   * between the publish and the assertions and make a stale page look fresh.
   */
  async function warmPublicPages(request: APIRequestContext) {
    for (const path of PAGE_PATHS) {
      expect((await request.get(path)).status()).toBe(200);
    }
  }

  /** One recognisable change in every slice a page can be built from. */
  async function editEverything() {
    await content.editDraft({
      about: { kicker: ABOUT_KICKER.new },
      services: { kicker: SERVICES_KICKER.new },
      contact: { kicker: CONTACT_KICKER.new },
      homePage: { hero: { headline: { emphasis: "films" } } },
      brandingHomePage: { hero: { headline: { emphasis: "durer" } } },
      siteWebHomePage: { hero: { headline: { emphasis: "lit" } } },
      portfolio: {
        kicker: "Portfolio révisé",
        projects: SAMPLE_PORTFOLIO_PROJECTS.map((project, index) =>
          index === 0 ? { ...project, title: PROJECT_TITLE.new } : project,
        ),
      },
      boutique: {
        kicker: BOUTIQUE_KICKER.new,
        products: DEFAULT_SITE_CONTENT.boutique.products.map(
          (product, index) =>
            index === 0 ? { ...product, title: PRODUCT_TITLE.new } : product,
        ),
      },
    });
  }

  /** Every page shows NEW if it is listed, OLD if it is not. */
  async function expectRefreshed(page: Page, refreshed: readonly PageName[]) {
    for (const name of EVERY_PAGE) {
      const probe = probes[name];
      await page.goto(probe.path);
      await probe.check(page, refreshed.includes(name));
    }
  }

  test.describe("a cold render costs exactly one provider round trip", () => {
    const routes: [string, string][] = [
      ["the homepage", "/"],
      ["the Branding homepage", "/branding"],
      ["the Site web homepage", "/site-web"],
      ["About", "/a-propos"],
      ["Services", "/services"],
      ["Contact", "/contact"],
      ["the portfolio", "/portfolio"],
      ["a project", `/portfolio/${SAMPLE_PORTFOLIO_PROJECTS[0].slug}`],
      ["a missing project", "/portfolio/aucun-projet-ne-porte-ce-nom"],
      ["the Boutique", "/boutique"],
      ["a product", "/boutique/color-grading-signature"],
      ["a missing product", "/boutique/aucun-produit-ne-porte-ce-nom"],
      ["a legal page", "/legal/conditions-generales-de-vente"],
      ["a missing legal page", "/legal/aucun-document-ne-porte-ce-nom"],
      [
        "a missing legal revision",
        "/legal/conditions-generales-de-vente/revision-inconnue",
      ],
      ["checkout", "/commande"],
      ["the sitemap", "/sitemap.xml"],
    ];

    for (const [name, path] of routes) {
      test(`${name} (${path})`, async ({ request }) => {
        // Reset wipes the dataset, so the projects are published again; that
        // publish expires everything, and the count is zeroed after it.
        await content.reset();
        await seedProjects();

        expect((await request.get(path)).status()).toBe(200);
        expect(await content.publishedReads()).toBe(1);

        expect((await request.get(path)).status()).toBe(200);
        expect(await content.publishedReads()).toBe(1);
      });
    }
  });

  test.describe("a publish expires only what its document type feeds", () => {
    // Each type, with the pages whose entry it must expire. The homepage
    // shows the projects and the products, so those two expire it as well;
    // the portfolio and Boutique page copy does not appear there. The Branding
    // and Site web homepages carry the same reel and Boutique teaser, so they
    // expire with those two too, but each is otherwise expired only by its own
    // document type.
    const scoped: [string, readonly PageName[]][] = [
      ["aboutPage", ["about"]],
      ["servicesPage", ["services"]],
      ["contactPage", ["contact"]],
      ["homePage", ["home"]],
      ["portfolioPage", ["portfolio"]],
      ["brandingHomePage", ["branding"]],
      ["siteWebHomePage", ["siteWeb"]],
      ["portfolioProject", ["portfolio", "home", "branding", "siteWeb"]],
      ["boutiquePage", ["boutique"]],
      ["digitalProduct", ["boutique", "home", "branding", "siteWeb"]],
    ];

    for (const [documentType, refreshed] of scoped) {
      test(`${documentType} refreshes ${refreshed.join(" and ")} and leaves the other pages cached`, async ({
        page,
        request,
      }) => {
        await seedProjects();
        await warmPublicPages(request);

        await editEverything();
        await content.publish(documentType);

        await expectRefreshed(page, refreshed);
      });
    }

    test("siteSettings refreshes the navigation on every page", async ({
      page,
      request,
    }) => {
      await seedProjects();
      await warmPublicPages(request);

      await content.editDraft({
        settings: {
          navigation: [
            { label: "Accueil", href: "/" },
            { label: "Nos films", href: "/portfolio" },
            { label: "Nos offres", href: "/services" },
          ],
        },
      });
      await content.publish("siteSettings");

      for (const path of PAGE_PATHS) {
        await page.goto(path);
        await expect(
          page
            .getByRole("contentinfo")
            .getByRole("link", { name: "Nos offres" }),
        ).toBeAttached();
      }
    });
  });

  test.describe("a webhook", () => {
    test("for About refreshes About and leaves every other page cached", async ({
      page,
      request,
    }) => {
      await seedProjects();
      await warmPublicPages(request);

      await editEverything();
      await content.persistPublished();
      expect(await content.triggerWebhook("aboutPage")).toBe(200);

      await expectRefreshed(page, ["about"]);
    });

    const unscoped: [string, () => Promise<number>][] = [
      ["without a type", () => content.triggerWebhook()],
      [
        "with a type the content model does not have",
        () => content.triggerWebhook("sanity.imageAsset"),
      ],
      [
        "with a type that is an Object property",
        () => content.triggerWebhook("constructor"),
      ],
      [
        "from the operator bearer token",
        () => content.triggerRevalidation(),
      ],
    ];

    for (const [name, trigger] of unscoped) {
      test(`${name} expires every page`, async ({ page, request }) => {
        await seedProjects();
        await warmPublicPages(request);

        await editEverything();
        await content.persistPublished();
        expect(await trigger()).toBe(200);

        await expectRefreshed(page, EVERY_PAGE);
      });
    }
  });

  test("an editor's title template, site name and Open Graph reach every page", async ({
    page,
  }) => {
    await seedProjects();
    await content.editDraft({
      settings: {
        seo: {
          titleTemplate: "%s — Studio WeCreate",
          siteName: "Studio WeCreate",
        },
      },
    });
    await content.publish("siteSettings");

    await page.goto("/a-propos");
    await expect(page).toHaveTitle("À propos — Studio WeCreate");
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "Studio WeCreate",
    );

    await page.goto("/commande");
    await expect(page).toHaveTitle("Commande — Studio WeCreate");

    await page.goto("/boutique/color-grading-signature");
    await expect(page).toHaveTitle("Color Grading Signature — Studio WeCreate");

    await page.goto("/portfolio/aucun-projet-ne-porte-ce-nom");
    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(page).toHaveTitle("Page introuvable — Studio WeCreate");

    // The homepage's title is its own, untemplated, as it always was.
    await page.goto("/");
    await expect(page).toHaveTitle(
      "WeCreate - Production vidéo cinématographique",
    );
  });
});
