import { expect, test, type Page } from "@playwright/test";

import { enterPreview, leavePreview, ManagedContent } from "./support/managed-content";
import {
  SAMPLE_PORTFOLIO_PROJECTS,
  seventhProject,
} from "./support/sample-content";

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
});

test.afterEach(async () => {
  await content.reset();
});

/** Publish the six approved projects, as a Content Editor would. */
async function publishSampleProjects(): Promise<void> {
  await content.editDraft({
    portfolio: { projects: SAMPLE_PORTFOLIO_PROJECTS },
  });
  await content.publish();
}

/**
 * The project is not there.
 *
 * Asserted as behaviour rather than as a status code: a route with a dynamic
 * segment has already begun streaming by the time the project is known to be
 * missing, so Next.js answers 200 and marks the page `noindex` instead. See
 * `src/app/(site)/not-found.tsx`.
 */
async function expectNotFound(page: Page): Promise<void> {
  await expect(page.getByTestId("not-found")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Cette page n'existe pas.",
  );
}

/** Open the first card and wait for its dialog. */
async function openProject(page: Page, title: string) {
  await page.getByRole("link", { name: new RegExp(title) }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("The portfolio", () => {
  test.beforeEach(async () => {
    await publishSampleProjects();
  });

  test("opens on every published project and says how many there are", async ({
    page,
  }) => {
    await page.goto("/portfolio");

    await expect(page).toHaveTitle("Portfolio · WeCreate");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Chaque projet, une œuvre.",
    );
    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 6 projets",
    );
    await expect(page.getByTestId("portfolio-grid").getByRole("listitem")).toHaveCount(6);

    // Each card carries the work's identity: whose it was, and what kind of
    // engagement it came from.
    await expect(page.getByText("Aurora Stays · Visite premium")).toBeVisible();
  });

  test("narrows to one universe, and the count follows", async ({ page }) => {
    await page.goto("/portfolio");

    const filters = page.getByRole("group", { name: "Filtrer par univers" });
    await filters.getByRole("button", { name: "Immobilier" }).click();

    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 2 projets",
    );
    const cards = page.getByTestId("portfolio-grid").getByRole("listitem");
    await expect(cards).toHaveCount(2);
    await expect(page.getByText("Résidence Aurora")).toBeVisible();
    await expect(page.getByText("Maison Kékéré")).toHaveCount(0);

    // The active filter is announced, not just painted.
    await expect(
      filters.getByRole("button", { name: "Immobilier" }),
    ).toHaveAttribute("aria-pressed", "true");

    // And it can be cleared again.
    await filters.getByRole("button", { name: "Tous" }).click();
    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 6 projets",
    );
  });

  test("says «1 projet» when only one is left", async ({ page }) => {
    await content.editDraft({
      portfolio: {
        projects: SAMPLE_PORTFOLIO_PROJECTS.filter(
          (project) => project.universe !== "Mariage",
        ).concat(
          SAMPLE_PORTFOLIO_PROJECTS.filter(
            (project) => project.title === "Ayo & Sika",
          ),
        ),
      },
    });
    await content.publish();

    await page.goto("/portfolio");
    await page
      .getByRole("group", { name: "Filtrer par univers" })
      .getByRole("button", { name: "Mariage" })
      .click();

    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 1 projet",
    );
  });

  test("keeps each project's own format", async ({ page }) => {
    await page.goto("/portfolio");

    // The reel deliberately mixes verticals and landscapes; a grid that
    // normalised them would flatten the editorial rhythm the design is built on.
    const ratios = await page
      .getByTestId("project-poster-frame")
      .evaluateAll((frames) =>
        frames.map((frame) => getComputedStyle(frame).aspectRatio),
      );

    expect(ratios).toContain("9 / 16");
    expect(ratios).toContain("16 / 9");
  });
});

test.describe("The portfolio before every universe has approved work", () => {
  test("hides a universe that has no published project", async ({ page }) => {
    // Issue #18: at least six approved real projects covering the advertised
    // universes, or empty universe filters hidden. Until WeCreate has work in
    // every universe, a filter that would open on nothing must not be offered.
    await content.editDraft({
      portfolio: {
        projects: SAMPLE_PORTFOLIO_PROJECTS.filter(
          (project) => project.universe !== "Mariage",
        ),
      },
    });
    await content.publish();

    await page.goto("/portfolio");

    const filters = page.getByRole("group", { name: "Filtrer par univers" });
    await expect(filters.getByRole("button", { name: "Immobilier" })).toBeVisible();
    await expect(filters.getByRole("button", { name: "Entreprises" })).toBeVisible();
    await expect(filters.getByRole("button", { name: "Mariage" })).toHaveCount(0);
  });

  test("offers no filter, and no fabricated project, when nothing is published", async ({
    page,
  }) => {
    // The shipped state: no Portfolio Project lives in application source.
    await page.goto("/portfolio");

    await expect(page.getByTestId("portfolio-empty")).toHaveText(
      "Les projets publiés apparaîtront ici dès leur mise en ligne.",
    );
    await expect(page.getByRole("group", { name: "Filtrer par univers" })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("portfolio-grid")).toHaveCount(0);
  });
});

test.describe("Opening a Portfolio Project", () => {
  test.beforeEach(async () => {
    await publishSampleProjects();
  });

  test("shows the film, who it was for, and what WeCreate did", async ({
    page,
  }) => {
    await page.goto("/portfolio");
    const dialog = await openProject(page, "Résidence Aurora");

    await expect(dialog.getByText("Aurora Stays · Visite premium")).toBeVisible();
    await expect(
      dialog.getByText(/Trois appartements meublés filmés comme des décors/),
    ).toBeVisible();

    await expect(dialog.getByText("Rôle de WeCreate")).toBeVisible();
    await expect(
      dialog.getByText(/Écriture, tournage plein format/),
    ).toBeVisible();

    await expect(dialog.getByText("Livrables")).toBeVisible();
    await expect(dialog.getByText("3 verticales 9:16")).toBeVisible();

    // The player is there and has not started by itself.
    const player = dialog.getByTestId("project-player");
    await expect(player).toBeVisible();
    expect(await player.evaluate((video: HTMLVideoElement) => video.paused)).toBe(
      true,
    );
  });

  test("offers a transcript when the film's speech carries meaning", async ({
    page,
  }) => {
    await page.goto("/portfolio");
    const dialog = await openProject(page, "Ayo & Sika");

    // Folded away rather than absent: the film comes first, and the words are
    // one deliberate click away for whoever needs them.
    const transcript = dialog.getByText("Transcription");
    await expect(transcript).toBeVisible();
    await expect(dialog.getByText(/On s'est rencontrés un mardi/)).toBeHidden();

    await transcript.click();
    await expect(dialog.getByText(/On s'est rencontrés un mardi/)).toBeVisible();
  });

  test("moves focus into the dialog and gives it back on Escape", async ({
    page,
  }) => {
    await page.goto("/portfolio");

    const card = page.getByRole("link", { name: /Résidence Aurora/ });
    await card.click();

    const dialog = page.getByRole("dialog", { name: "Résidence Aurora" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Fermer" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // Back where the visitor left off, not at the top of the document.
    await expect(card).toBeFocused();
  });

  test("closes from its own button", async ({ page }) => {
    await page.goto("/portfolio");
    const dialog = await openProject(page, "Maison Kékéré");

    await dialog.getByRole("button", { name: "Fermer" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("is also a page of its own, shareable and readable on its own", async ({
    page,
  }) => {
    await page.goto("/portfolio/villa-oceane");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Villa Océane",
    );
    await expect(page.getByText("Océane Rentals · Gestionnaire Pro")).toBeVisible();
    await expect(page.getByText(/filmée à l'heure dorée/)).toBeVisible();
    await expect(page.getByText("Plans drone")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Retour au portfolio" }),
    ).toHaveAttribute("href", "/portfolio");
  });

  test("is not there at all when it is not published", async ({ page }) => {
    await page.goto("/portfolio/groupe-adjovi");

    await expectNotFound(page);
  });
});

test.describe("A Portfolio Project whose video cannot be played", () => {
  test("keeps its poster and everything written about it", async ({ page }) => {
    // The association is real — the platform is simply still transcoding it, or
    // unreachable from here. The work is approved either way, so it stays on the
    // site rather than disappearing.
    await content.editDraft({
      portfolio: {
        projects: [
          seventhProject({
            playbackAsset: {
              streamId: null,
              posterUrl: "/brand/logo-noir.svg",
              alternativeText: "Image d'ouverture du film.",
              sources: [],
              preview: null,
              captions: [],
            },
          }),
        ],
      },
    });
    await content.publish();

    await page.goto("/portfolio/groupe-adjovi");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Groupe Adjovi",
    );
    await expect(page.getByTestId("project-poster")).toBeVisible();
    await expect(page.getByTestId("project-player")).toHaveCount(0);
    await expect(
      page.getByText(/n'est pas encore disponible/),
    ).toBeVisible();
    await expect(page.getByText(/Film corporate, interviews dirigeants/)).toBeVisible();
  });
});

test.describe("Publishing a Portfolio Project", () => {
  const incomplete = [
    {
      what: "the client has not agreed to it being published",
      overrides: { hasPublicationPermission: false },
    },
    {
      what: "its poster has no alternative text",
      overrides: {
        playbackAsset: null,
        media: {
          ratio: "16 / 9" as const,
          placeholderLabel: "16:9",
          imageUrl: "/brand/logo-noir.svg",
          alternativeText: "",
        },
      },
    },
    {
      // The editor uploaded no image, so the poster is the one the video
      // platform generated — and nobody described it. An editor meets this by
      // doing nothing at all, which is why it has its own case.
      what: "its generated poster has no alternative text",
      overrides: {
        playbackAsset: {
          streamId: null,
          posterUrl: "/brand/logo-noir.svg",
          alternativeText: "",
          sources: [{ src: "/sample-project.mp4", type: "video/mp4" }],
          preview: null,
          captions: [],
        },
      },
    },
    {
      what: "no video has been associated with it",
      overrides: { playbackAsset: null },
    },
    {
      what: "it has spoken content but no transcript",
      overrides: { spokenContent: "transcript" as const, transcript: null },
    },
    {
      what: "nothing records what WeCreate delivered",
      overrides: { deliverables: [] },
    },
  ];

  for (const { what, overrides } of incomplete) {
    test(`does not reach a visitor when ${what}`, async ({ page }) => {
      await content.editDraft({
        portfolio: {
          projects: [
            ...SAMPLE_PORTFOLIO_PROJECTS,
            seventhProject(overrides),
          ],
        },
      });
      await content.publish();

      await page.goto("/portfolio");

      // Not merely hidden behind a flag: absent. Nothing counts it, links to it
      // or serves it.
      await expect(page.getByTestId("portfolio-count")).toHaveText(
        "Portfolio · 6 projets",
      );
      await expect(page.getByText("Groupe Adjovi")).toHaveCount(0);

      await page.goto("/portfolio/groupe-adjovi");
      await expectNotFound(page);
    });
  }

  test("shows the editor what is left to do, in preview", async ({ page }) => {
    await content.editDraft({
      portfolio: {
        projects: [seventhProject({ hasPublicationPermission: false })],
      },
    });
    await content.publish();

    await enterPreview(page, "/portfolio");
    await page.goto("/portfolio");

    await expect(page.getByText("Groupe Adjovi")).toBeVisible();
    await expect(page.getByTestId("project-requirements").first()).toContainText(
      "l'autorisation de publication du client",
    );

    await leavePreview(page);
  });
});

test.describe("An unpublished Portfolio Project", () => {
  test("is visible in preview and nowhere else", async ({ page }) => {
    await publishSampleProjects();
    await content.editDraft({
      portfolio: {
        projects: [
          ...SAMPLE_PORTFOLIO_PROJECTS,
          seventhProject({ title: "Studio Calavi", slug: "studio-calavi" }),
        ],
      },
    });

    // Drafted, not published.
    await page.goto("/portfolio");
    await expect(page.getByText("Studio Calavi")).toHaveCount(0);
    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 6 projets",
    );

    await enterPreview(page, "/portfolio");
    await page.goto("/portfolio");
    await expect(page.getByText("Studio Calavi")).toBeVisible();

    await leavePreview(page);
    await page.goto("/portfolio");
    await expect(page.getByText("Studio Calavi")).toHaveCount(0);
  });
});

test.describe("The portfolio before any project is approved", () => {
  test("says so, and keeps the page", async ({ page }) => {
    await page.goto("/portfolio");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("portfolio-empty")).toHaveText(
      "Les projets publiés apparaîtront ici dès leur mise en ligne.",
    );
    await expect(page.getByTestId("portfolio-count")).toHaveText(
      "Portfolio · 0 projet",
    );
  });
});

test.describe("The portfolio without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still shows every project, each on a page of its own", async ({
    page,
  }) => {
    await publishSampleProjects();
    await page.goto("/portfolio");

    await expect(
      page.getByTestId("portfolio-grid").getByRole("listitem"),
    ).toHaveCount(6);
    await expect(
      page.getByRole("link", { name: /Résidence Aurora/ }),
    ).toHaveAttribute("href", "/portfolio/residence-aurora");
  });
});

test.describe("Sampling a project without opening it", () => {
  test.beforeEach(async () => {
    await publishSampleProjects();
  });

  test("previews on hover where there is a pointer, and never before", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/portfolio");

    const card = page.getByRole("link", { name: /Résidence Aurora/ });
    // Nothing is created for a preview until the pointer is over the card, so
    // six films are never queued up behind a portfolio that was merely opened.
    await expect(page.getByTestId("project-preview")).toHaveCount(0);

    await card.hover();

    if (isMobile) {
      // No fine pointer: a tap would open the project, so a hover preview would
      // only spend a metered connection on something nobody asked for.
      await expect(page.getByTestId("project-preview")).toHaveCount(0);
    } else {
      const preview = page.getByTestId("project-preview");
      await expect(preview).toBeVisible();
      // Silent, looping, and started because the pointer arrived.
      expect(
        await preview.evaluate((video: HTMLVideoElement) => video.muted),
      ).toBe(true);
      expect(
        await preview.evaluate((video: HTMLVideoElement) => video.loop),
      ).toBe(true);
    }

    // The poster is what the card is, either way.
    await expect(page.getByTestId("project-poster-frame").first()).toBeVisible();
  });
});

test.describe("The portfolio for a visitor who has asked for less", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("never starts a preview by itself", async ({ page }) => {
    await publishSampleProjects();
    await page.goto("/portfolio");

    // Hover previews are decoration on top of a poster. With motion suppressed
    // no preview element is created at all, so nothing is downloaded for one.
    await page.getByRole("link", { name: /Résidence Aurora/ }).hover();
    await expect(page.getByTestId("project-preview")).toHaveCount(0);
    await expect(page.getByTestId("project-poster-frame").first()).toBeVisible();
  });

  test("still opens a project, poster first and paused", async ({ page }) => {
    await publishSampleProjects();
    await page.goto("/portfolio/residence-aurora");

    const player = page.getByTestId("project-player");
    await expect(player).toHaveAttribute("poster", "/brand/logo-noir.svg");
    expect(await player.evaluate((video: HTMLVideoElement) => video.paused)).toBe(
      true,
    );
    // Nothing is fetched until the visitor presses play.
    await expect(player).toHaveAttribute("preload", "none");
    await expect(page.getByText(/Trois appartements meublés/)).toBeVisible();
  });
});

test.describe("A Portfolio Project on a metered connection", () => {
  test("shows the poster and the words, and downloads no video", async ({
    page,
  }) => {
    await publishSampleProjects();

    // Save-Data is what a visitor on a metered Benin mobile connection is likely
    // to have on, and it means the same thing as reduced motion here: do less.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: { saveData: true, addEventListener() {}, removeEventListener() {} },
      });
    });

    const mediaRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "media") {
        mediaRequests.push(request.url());
      }
    });

    await page.goto("/portfolio");
    await page.getByRole("link", { name: /Résidence Aurora/ }).hover();

    await expect(page.getByTestId("project-preview")).toHaveCount(0);
    await expect(page.getByTestId("project-poster-frame").first()).toBeVisible();
    await expect(page.getByText("Résidence Aurora")).toBeVisible();
    expect(mediaRequests).toEqual([]);
  });
});
