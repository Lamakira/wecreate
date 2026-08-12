import { expect, test, type Page } from "@playwright/test";

import { ManagedContent, enterPreview, leavePreview } from "./support/managed-content";

/**
 * À propos: the page a visitor reads before deciding to trust WeCreate.
 *
 * Which makes what it does *not* claim as important as what it does. Nothing
 * here may pass for approved content it is not: the portrait is visibly an empty
 * slot, the team is a list of roles rather than of people, and the one large
 * statement on the page is the brief's own promise — not the aphorism the design
 * prototype invented, and not a client's words.
 */

let content: ManagedContent;

/**
 * One of the closing columns. Exact, because "L'équipe" is a prefix of
 * "L'équipement" and a loose match would silently span both.
 */
function column(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true });
}

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

test.describe("À propos", () => {
  test("opens with the studio's position", async ({ page }) => {
    await page.goto("/a-propos");

    await expect(page).toHaveTitle("À propos · WeCreate");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Des œuvres, pas du contenu.");
    await expect(heading.locator("em")).toHaveText("œuvres");

    await expect(
      page.getByText("À propos · Studio à Calavi Tankpè"),
    ).toBeVisible();
  });

  test("tells the story, and states only a brand promise WeCreate approved", async ({
    page,
  }) => {
    await page.goto("/a-propos");

    const story = page.getByTestId("about-story");
    await expect(
      story.getByText("WeCreate est né d'un refus : celui de la vidéo tiède."),
    ).toBeVisible();
    await expect(
      story.getByText("Le studio est basé à Calavi Tankpè."),
    ).toBeVisible();

    // The brief's promise, which WeCreate wrote. The prototype's line about
    // what a video budget "really" is was invented for the design and states a
    // commercial claim the brief does not make, so it is not published here.
    await expect(
      story.getByText(
        "« On ne capture pas des images. On fabrique des œuvres qui font vendre. »",
      ),
    ).toBeVisible();
    await expect(page.getByText(/prix du désir/)).toHaveCount(0);

    // And nobody is quoted: no testimonial, no named client, on the page whose
    // whole job is credibility.
    await expect(page.getByText(/Ils n'ont pas filmé/)).toHaveCount(0);
    await expect(page.getByText(/Gestionnaire de résidences/)).toHaveCount(0);
  });

  test("shows the portrait slot as a slot, not as a photograph", async ({
    page,
  }) => {
    await page.goto("/a-propos");

    const story = page.getByTestId("about-story");

    // No image ships with the page, and none is invented: the frame reserves
    // its 4:5 and says in monospace what belongs there, exactly as the design
    // handoff specifies for a visual that does not exist yet.
    await expect(story.locator("img")).toHaveCount(0);
    await expect(story.getByText("portrait studio · 4:5")).toBeVisible();

    const ratio = await story
      .getByText("portrait studio · 4:5")
      .evaluate((element) =>
        getComputedStyle(element.parentElement!).aspectRatio.replace(/\s/g, ""),
      );
    expect(ratio).toBe("4/5");
  });

  test("sets out the method in four steps, numbered by position", async ({
    page,
  }) => {
    await page.goto("/a-propos");

    const method = page.getByRole("region", {
      name: "Brief, tournage, étalonnage, livraison",
    });
    const steps = method.getByRole("listitem");
    await expect(steps).toHaveCount(4);

    await expect(steps.nth(0)).toContainText("01");
    await expect(steps.nth(0).getByRole("heading", { level: 3 })).toHaveText(
      "Brief",
    );
    await expect(steps.nth(2).getByRole("heading", { level: 3 })).toHaveText(
      "Étalonnage signature",
    );
    await expect(steps.nth(3)).toContainText("04");
    await expect(steps.nth(3)).toContainText("5 jours ouvrés.");

    // The method sits on the light band, which inverts the focus ring so
    // keyboard focus stays visible against white.
    await expect(method).toHaveAttribute("data-surface", "light");
  });

  test("lists what the studio is made of, by role rather than by name", async ({
    page,
  }) => {
    await page.goto("/a-propos");

    const roles = column(page, "L'équipe").getByRole("listitem");
    await expect(roles).toHaveCount(3);
    await expect(roles.nth(0).getByRole("heading", { level: 3 })).toHaveText(
      "Direction artistique & réalisation",
    );
    await expect(roles.nth(2).getByRole("heading", { level: 3 })).toHaveText(
      "Post-production & étalonnage",
    );

    const equipment = column(page, "L'équipement");
    await expect(equipment.getByRole("listitem")).toHaveCount(3);
    await expect(
      equipment.getByText("Sony ZV-E1 — plein format"),
    ).toBeVisible();
  });

  test("says where WeCreate films, and opens the way to a conversation", async ({
    page,
  }) => {
    await page.goto("/a-propos");

    const coverage = column(page, "Zone d'intervention");
    await expect(
      coverage.getByText(
        "Calavi Tankpè · Cotonou · Porto-Novo · Ouidah · Parakou. Tout le Bénin, et au-delà sur devis.",
      ),
    ).toBeVisible();

    // Contact rather than WhatsApp: a visitor who has just read the story is
    // choosing how to reach the studio, and all three channels sit together.
    await expect(
      coverage.getByRole("link", { name: "Nous écrire" }),
    ).toHaveAttribute("href", "/contact");
  });

  test("reads in one column without scrolling sideways", async ({ page }) => {
    await page.goto("/a-propos");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The three closing columns stack in a fixed order at any width.
    const headings = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(headings).toEqual([
      "Brief, tournage, étalonnage, livraison",
      "L'équipe",
      "L'équipement",
      "Zone d'intervention",
    ]);
  });

  test("belongs to the editor: an unpublished edit stays off the public page", async ({
    page,
  }) => {
    const draftStep = "Repérage";

    await content.editDraft({
      about: {
        method: {
          steps: [
            {
              key: "reperage",
              title: draftStep,
              description: "On va voir le lieu avant de tourner.",
            },
            {
              key: "tournage",
              title: "Tournage",
              description: "Plein format, optiques lumineuses, son dédié.",
            },
          ],
        },
      },
    });

    await page.goto("/a-propos");
    await expect(page.getByText(draftStep)).toHaveCount(0);
    await expect(page.getByTestId("draft-mode-banner")).toHaveCount(0);

    await enterPreview(page, "/a-propos");
    await expect(page.getByText(draftStep)).toBeVisible();
    await expect(page.getByTestId("draft-mode-banner")).toBeVisible();
    await leavePreview(page);

    await content.publish();
    await page.goto("/a-propos");

    const steps = page
      .getByRole("region", { name: "Brief, tournage, étalonnage, livraison" })
      .getByRole("listitem");
    await expect(steps).toHaveCount(2);
    // Removing a step renumbers the rest: the numbers come from position, so
    // the page can never count 01, 02, 04.
    await expect(steps.nth(0)).toContainText("01");
    await expect(steps.nth(1)).toContainText("02");
    await expect(page.getByText("03")).toHaveCount(0);
  });

  test("hides the method when the editor switches it off", async ({ page }) => {
    await content.editDraft({ about: { method: { isVisible: false } } });
    await content.publish();

    await page.goto("/a-propos");

    await expect(
      page.getByRole("region", { name: "Brief, tournage, étalonnage, livraison" }),
    ).toHaveCount(0);
    // The rest of the page is untouched.
    await expect(column(page, "L'équipe")).toBeVisible();
  });
});

test.describe("À propos without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still tells the whole story", async ({ page }) => {
    await page.goto("/a-propos");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Des œuvres, pas du contenu.",
    );
    await expect(column(page, "L'équipe")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Nous écrire" }),
    ).toBeVisible();

    // Scroll-reveal is decoration applied by script; without it, content is
    // simply visible rather than permanently hidden.
    const opacity = await page
      .getByRole("heading", { level: 2, name: "L'équipement" })
      .evaluate((element) => getComputedStyle(element).opacity);
    expect(Number(opacity)).toBe(1);
  });
});
