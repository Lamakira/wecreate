import { expect, test, type Page } from "@playwright/test";

import { ManagedContent, enterPreview } from "./support/managed-content";

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

test.describe("Scoped cache invalidation", () => {
  const ABOUT_KICKER = "À propos · Studio révisé";
  const SERVICES_KICKER = "Services · Trois univers";
  const SERVICES_REVISED = "Services · Révisés";
  const HOME_HEADLINE = "Nous fabriquons des œuvres qui font vendre.";
  const PORTFOLIO_KICKER = "Portfolio";

  async function warmPublicPages(page: Page) {
    await page.goto("/a-propos");
    await page.goto("/services");
    await page.goto("/portfolio");
    await page.goto("/");
    await content.resetReadCount();
  }

  test("a cold public page costs one published provider round trip", async ({
    page,
  }) => {
    await page.goto("/a-propos");

    expect(await content.publishedReads()).toBe(1);

    await page.goto("/a-propos");

    expect(await content.publishedReads()).toBe(1);
  });

  test("publishing About leaves Services, Portfolio and the homepage served from cache", async ({
    page,
  }) => {
    await warmPublicPages(page);

    await content.editDraft({ about: { kicker: ABOUT_KICKER } });
    await content.publish("aboutPage");

    await page.goto("/services");
    await expect(page.getByText(SERVICES_KICKER)).toBeVisible();

    await page.goto("/portfolio");
    await expect(page.getByText(`${PORTFOLIO_KICKER} ·`)).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      HOME_HEADLINE,
    );

    await page.goto("/a-propos");
    await expect(page.getByText(ABOUT_KICKER)).toBeVisible();

    // About is the only page whose cache was dropped. Prefetch of the expired
    // About link and a first chrome/legal fill can add one or two reads on
    // top of that miss. Four would mean another warmed page was expired too.
    expect(await content.publishedReads()).toBeGreaterThanOrEqual(1);
    expect(await content.publishedReads()).toBeLessThanOrEqual(3);
  });

  test("a webhook whose type is missing expires every cached page", async ({
    page,
  }) => {
    await warmPublicPages(page);

    await content.editDraft({
      about: { kicker: ABOUT_KICKER },
      services: { kicker: SERVICES_REVISED },
    });
    await content.persistPublished();
    await content.resetReadCount();

    expect(await content.triggerWebhook()).toBe(200);

    await page.goto("/services");
    await expect(page.getByText(SERVICES_REVISED)).toBeVisible();
    await page.goto("/a-propos");
    await expect(page.getByText(ABOUT_KICKER)).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      HOME_HEADLINE,
    );
  });

  test("an unrecognised webhook type expires every cached page", async ({
    page,
  }) => {
    await warmPublicPages(page);

    await content.editDraft({
      about: { kicker: ABOUT_KICKER },
      services: { kicker: SERVICES_REVISED },
    });
    await content.persistPublished();
    await content.resetReadCount();

    expect(await content.triggerWebhook("sanity.imageAsset")).toBe(200);

    await page.goto("/a-propos");
    await expect(page.getByText(ABOUT_KICKER)).toBeVisible();
    await page.goto("/services");
    await expect(page.getByText(SERVICES_REVISED)).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      HOME_HEADLINE,
    );
  });

  test("the operator bearer token still drops every cached page", async ({
    page,
  }) => {
    await warmPublicPages(page);

    await content.editDraft({
      about: { kicker: ABOUT_KICKER },
      services: { kicker: SERVICES_REVISED },
    });
    await content.persistPublished();
    await content.resetReadCount();

    expect(await content.triggerRevalidation()).toBe(200);

    await page.goto("/services");
    await expect(page.getByText(SERVICES_REVISED)).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      HOME_HEADLINE,
    );
    await page.goto("/a-propos");
    await expect(page.getByText(ABOUT_KICKER)).toBeVisible();
  });

  test("a signed About webhook expires About and leaves Services cached", async ({
    page,
  }) => {
    await warmPublicPages(page);

    await content.editDraft({ about: { kicker: ABOUT_KICKER } });
    await content.persistPublished();
    await content.resetReadCount();

    expect(await content.triggerWebhook("aboutPage")).toBe(200);

    await page.goto("/services");
    await expect(page.getByText(SERVICES_KICKER)).toBeVisible();

    await page.goto("/portfolio");
    await expect(page.getByText(`${PORTFOLIO_KICKER} ·`)).toBeVisible();

    await page.goto("/a-propos");
    await expect(page.getByText(ABOUT_KICKER)).toBeVisible();

    expect(await content.publishedReads()).toBeGreaterThanOrEqual(1);
    expect(await content.publishedReads()).toBeLessThanOrEqual(2);
  });
});
