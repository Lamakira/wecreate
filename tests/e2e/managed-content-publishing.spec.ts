import { expect, test } from "@playwright/test";

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
