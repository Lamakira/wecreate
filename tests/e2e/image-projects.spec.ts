import { expect, test, type Page } from "@playwright/test";

import { ManagedContent, enterPreview } from "./support/managed-content";
import {
  SAMPLE_BRANDING_PROJECTS,
  SAMPLE_PORTFOLIO_PROJECTS,
  SAMPLE_SITE_WEB_PROJECTS,
  seventhProject,
} from "./support/sample-content";

/**
 * Issue #60: Branding and Site web projects are published as images.
 *
 * A Vidéographie project is published with its film; the other two Disciplines
 * with their images, and no player. The portfolio can be narrowed to one
 * Discipline, each Discipline's homepage shows only its own work, and the
 * lightbox and the project's own page show the images in order.
 */

const FILM_TITLES = SAMPLE_PORTFOLIO_PROJECTS.map((project) => project.title);
const BRANDING_TITLES = SAMPLE_BRANDING_PROJECTS.map((project) => project.title);
const SITE_WEB_TITLES = SAMPLE_SITE_WEB_PROJECTS.map((project) => project.title);

const ALL_PROJECTS = [
  ...SAMPLE_PORTFOLIO_PROJECTS,
  ...SAMPLE_BRANDING_PROJECTS,
  ...SAMPLE_SITE_WEB_PROJECTS,
];

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

async function publish(projects: typeof ALL_PROJECTS): Promise<void> {
  await content.editDraft({ portfolio: { projects } });
  await content.publish();
}

function grid(page: Page) {
  return page.getByTestId("portfolio-grid");
}

function disciplineFilter(page: Page) {
  return page.getByRole("group", { name: "Filtrer par discipline" });
}

/** The titles shown by a list of cards, and none of the others'. */
async function expectOnlyTitles(
  page: Page,
  shown: string[],
  hidden: string[],
): Promise<void> {
  for (const title of shown) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  }
  for (const title of hidden) {
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  }
}

test.describe("Which projects are published", () => {
  test("a Branding project with images and no video reaches the portfolio", async ({
    page,
  }) => {
    await publish(SAMPLE_BRANDING_PROJECTS);

    await page.goto("/portfolio");

    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 3 projets",
    );
    await expectOnlyTitles(page, BRANDING_TITLES, []);
  });

  test("a Vidéographie project without its video still does not", async ({
    page,
  }) => {
    await publish([
      ...SAMPLE_BRANDING_PROJECTS,
      seventhProject({
        title: "Film d'essai sans vidéo",
        slug: "film-essai-sans-video",
        playbackAsset: null,
      }),
    ]);

    await page.goto("/portfolio");

    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 3 projets",
    );
    await expect(page.getByText("Film d'essai sans vidéo")).toHaveCount(0);
  });

  test("tells the editor, in preview, what each unfinished project lacks", async ({
    page,
  }) => {
    await publish([
      {
        ...SAMPLE_BRANDING_PROJECTS[0],
        title: "Charte d'essai sans image",
        slug: "charte-essai-sans-image",
        images: [],
      },
      seventhProject({
        title: "Film d'essai sans vidéo",
        slug: "film-essai-sans-video",
        playbackAsset: null,
      }),
    ]);

    // Absent for a visitor...
    await page.goto("/portfolio");
    await expect(page.getByText("Charte d'essai sans image")).toHaveCount(0);

    // ...present for the editor, with what is left to do. The two Disciplines
    // are not asked for the same thing.
    await enterPreview(page, "/portfolio");
    await page.goto("/portfolio");

    const withoutImages = grid(page)
      .getByRole("listitem")
      .filter({ hasText: "Charte d'essai sans image" });
    await expect(withoutImages.getByTestId("project-requirements")).toContainText(
      "les images",
    );

    const withoutVideo = grid(page)
      .getByRole("listitem")
      .filter({ hasText: "Film d'essai sans vidéo" });
    await expect(withoutVideo.getByTestId("project-requirements")).toContainText(
      "la vidéo",
    );
  });
});

test.describe("Filtering the portfolio by Discipline", () => {
  test.beforeEach(async () => {
    await publish(ALL_PROJECTS);
  });

  test("offers every Discipline that has work", async ({ page }) => {
    await page.goto("/portfolio");

    await expect(disciplineFilter(page).getByRole("button")).toHaveText([
      "Tous",
      "Vidéographie",
      "Branding",
      "Site web",
    ]);
    await expect(page.getByTestId("portfolio-count")).toHaveText(
      `Portfolio · ${ALL_PROJECTS.length} projets`,
    );
  });

  test("narrows to Branding, in the address too, and Tous brings everything back", async ({
    page,
  }) => {
    await page.goto("/portfolio");

    const filters = disciplineFilter(page);
    await filters.getByRole("button", { name: "Branding", exact: true }).click();

    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 3 projets",
    );
    await expect(grid(page).getByRole("listitem")).toHaveCount(3);
    await expectOnlyTitles(
      page,
      BRANDING_TITLES,
      [...FILM_TITLES, ...SITE_WEB_TITLES],
    );
    await expect(
      filters.getByRole("button", { name: "Branding", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      filters.getByRole("button", { name: "Tous", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/\/portfolio\?discipline=branding$/);

    // Universes are the films' business: the row has nothing to say here.
    await expect(
      page.getByRole("group", { name: "Filtrer par univers" }),
    ).toHaveCount(0);

    await filters.getByRole("button", { name: "Tous", exact: true }).click();
    await expect(page.getByTestId("portfolio-count")).toHaveText(
      `Portfolio · ${ALL_PROJECTS.length} projets`,
    );
    await expect(page).toHaveURL(/\/portfolio$/);
  });

  test("arriving on a Discipline's address shows only its projects", async ({
    page,
  }) => {
    await page.goto("/portfolio?discipline=site-web");

    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 2 projets",
    );
    await expect(
      disciplineFilter(page).getByRole("button", {
        name: "Site web",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expectOnlyTitles(
      page,
      SITE_WEB_TITLES,
      [...FILM_TITLES, ...BRANDING_TITLES],
    );
  });

  test("keeps the universe filter for the films", async ({ page }) => {
    await page.goto("/portfolio?discipline=videographie");

    await expect(page.getByTestId("portfolio-count")).toHaveText(
      `Portfolio · ${FILM_TITLES.length} projets`,
    );
    await expect(
      page.getByRole("group", { name: "Filtrer par univers" }),
    ).toBeVisible();
  });
});

test.describe("The portfolio with films only", () => {
  test.beforeEach(async () => {
    await publish(SAMPLE_PORTFOLIO_PROJECTS);
  });

  test("looks as it did: no Discipline filter, the universe filter", async ({
    page,
  }) => {
    await page.goto("/portfolio");

    await expect(disciplineFilter(page)).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Filtrer par univers" }),
    ).toBeVisible();
    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 6 projets",
    );
  });

  test("says so when a Discipline has no published project yet", async ({
    page,
  }) => {
    await page.goto("/portfolio?discipline=branding");

    await expect(page.getByTestId("portfolio-empty")).toHaveText(
      "Les projets publiés apparaîtront ici dès leur mise en ligne.",
    );
    await expect(grid(page)).toHaveCount(0);
  });

  test("leaves a Discipline's Travaux récents empty", async ({ page }) => {
    await page.goto("/site-web");

    await expect(page.getByTestId("recent-work-empty")).toHaveText(
      "Les sites publiés apparaîtront ici dès leur mise en ligne.",
    );
    await expect(page.getByTestId("recent-work-reel")).toHaveCount(0);
  });
});

test.describe("Each Discipline's homepage shows only its own projects", () => {
  test.beforeEach(async () => {
    await publish(ALL_PROJECTS);
  });

  test("/branding lists the Branding projects", async ({ page }) => {
    await page.goto("/branding");

    const reel = page.getByTestId("recent-work-reel");
    await expect(reel.getByRole("listitem")).toHaveCount(3);
    for (const title of BRANDING_TITLES) {
      await expect(reel).toContainText(title);
    }
    for (const title of [...FILM_TITLES, ...SITE_WEB_TITLES]) {
      await expect(reel).not.toContainText(title);
    }
  });

  test("/site-web lists the Site web projects", async ({ page }) => {
    await page.goto("/site-web");

    const reel = page.getByTestId("recent-work-reel");
    await expect(reel.getByRole("listitem")).toHaveCount(2);
    for (const title of SITE_WEB_TITLES) {
      await expect(reel).toContainText(title);
    }
    for (const title of [...FILM_TITLES, ...BRANDING_TITLES]) {
      await expect(reel).not.toContainText(title);
    }
  });

  test("/ lists the films only", async ({ page }) => {
    await page.goto("/");

    const reel = page.getByTestId("recent-work-reel");
    for (const title of [...BRANDING_TITLES, ...SITE_WEB_TITLES]) {
      await expect(reel).not.toContainText(title);
    }
    await expect(reel.getByRole("listitem")).toHaveCount(6);
  });

  for (const { path, label, href, titles } of [
    {
      path: "/branding",
      label: "Toutes les chartes",
      href: "/portfolio?discipline=branding",
      titles: BRANDING_TITLES,
    },
    {
      path: "/site-web",
      label: "Tous les sites",
      href: "/portfolio?discipline=site-web",
      titles: SITE_WEB_TITLES,
    },
  ]) {
    test(`"${label}" opens the portfolio on that Discipline`, async ({
      page,
    }) => {
      await page.goto(path);

      const link = page
        .getByRole("region", { name: /Travaux récents/ })
        .getByRole("link", { name: label });
      await expect(link).toHaveAttribute("href", href);

      await link.click();

      await expect(page).toHaveURL(
        new RegExp(`${href.replace("?", "\\?")}$`),
      );
      await expect(grid(page).getByRole("listitem")).toHaveCount(titles.length);
      await expect(
        disciplineFilter(page).locator('[aria-pressed="true"]'),
      ).toHaveText(path === "/branding" ? "Branding" : "Site web");
      await expectOnlyTitles(
        page,
        titles,
        ALL_PROJECTS.map((project) => project.title).filter(
          (title) => !titles.includes(title),
        ),
      );
    });
  }
});

test.describe("Opening an image project", () => {
  test.beforeEach(async () => {
    await publish(ALL_PROJECTS);
  });

  test("shows its images in the lightbox, with no player", async ({ page }) => {
    const project = SAMPLE_BRANDING_PROJECTS[0];
    await page.goto("/portfolio");

    await page.getByRole("link", { name: new RegExp(project.title) }).click();
    const dialog = page.getByRole("dialog", { name: project.title });
    await expect(dialog).toBeVisible();

    const images = dialog.getByTestId("project-images").getByRole("img");
    await expect(images).toHaveCount(project.images.length);
    for (const [index, image] of project.images.entries()) {
      await expect(images.nth(index)).toHaveAttribute("alt", image.alternativeText);
    }

    await expect(dialog.getByTestId("project-player")).toHaveCount(0);
    await expect(dialog.locator("video")).toHaveCount(0);
  });

  test("shows the same images on the project's own page", async ({ page }) => {
    const project = SAMPLE_SITE_WEB_PROJECTS[0];
    await page.goto(`/portfolio/${project.slug}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      project.title,
    );
    const images = page.getByTestId("project-images").getByRole("img");
    await expect(images).toHaveCount(project.images.length);
    for (const [index, image] of project.images.entries()) {
      await expect(images.nth(index)).toHaveAttribute("alt", image.alternativeText);
    }
    await expect(page.getByTestId("project-player")).toHaveCount(0);
  });
});

test.describe("The formats of image projects", () => {
  test.beforeEach(async () => {
    await publish(ALL_PROJECTS);
  });

  test("keeps each project's own format", async ({ page }) => {
    await page.goto("/portfolio");

    const ratios = await page
      .getByTestId("project-poster-frame")
      .evaluateAll((frames) =>
        frames.map((frame) => getComputedStyle(frame).aspectRatio),
      );

    expect(ratios).toContain("4 / 5");
    expect(ratios).toContain("1 / 1");
    expect(ratios).toContain("16 / 10");
  });

  test.describe("with motion reduced", () => {
    // The reveal's slide-in would move the cards while they are measured.
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    /**
     * Each card starts either at the top of its container or right under the
     * card above it in its column — never under an empty space left by a
     * shorter neighbour. Same rule as the homepage's reel.
     */
    async function expectNoHoles(page: Page, containerTestId: string) {
      const container = page.getByTestId(containerTestId);
      const containerTop = (await container.boundingBox())!.y;
      const cards = await container
        .getByRole("listitem")
        .evaluateAll((items) =>
          items.map((item) => {
            const { left, right, top, bottom } = item.getBoundingClientRect();
            return { left, right, top, bottom };
          }),
        );

      expect(cards.length).toBeGreaterThan(1);
      for (const card of cards) {
        const above = cards.filter(
          (other) =>
            other !== card &&
            other.bottom <= card.top &&
            other.left < card.right &&
            other.right > card.left,
        );
        const gap =
          above.length === 0
            ? card.top - containerTop
            : card.top - Math.max(...above.map((other) => other.bottom));
        expect(gap).toBeLessThanOrEqual(24);
      }
    }

    test("stacks the portfolio without leaving holes between the cards", async ({
      page,
    }) => {
      await page.goto("/portfolio");
      await expectNoHoles(page, "portfolio-grid");
    });

    test("stacks Branding's recent work without leaving holes", async ({
      page,
    }) => {
      await page.goto("/branding");
      await expectNoHoles(page, "recent-work-reel");
    });
  });
});
