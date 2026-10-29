import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { ManagedContent, enterPreview } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

/**
 * Issue #59: each Discipline has its own homepage and its own address.
 *
 * `/` stays Vidéographie's, `/branding` is Branding's and `/site-web` is Site
 * web's. A visitor moves between them with the switch in the hero, which is
 * three plain links. Each homepage is its own Managed Content document, so an
 * editor changes one Discipline at a time and publishing one leaves the others'
 * cache entries alone. Colours are measured in `discipline-themes.spec.ts`.
 */

const SWITCH = [
  { name: "Vidéographie", href: "/", discipline: "videographie" },
  { name: "Branding", href: "/branding", discipline: "branding" },
  { name: "Site web", href: "/site-web", discipline: "site-web" },
] as const;

const HOMEPAGES = [
  {
    path: "/",
    discipline: "videographie",
    headline: "Nous fabriquons des œuvres qui font vendre.",
    title: "WeCreate - Production vidéo cinématographique",
  },
  {
    path: "/branding",
    discipline: "branding",
    headline: "Une marque pensée pour bouger.",
    title: "Identité de marque · WeCreate",
  },
  {
    path: "/site-web",
    discipline: "site-web",
    headline: "Un site qui se regarde comme un film.",
    title: "Création de sites web · WeCreate",
  },
] as const;

const HEADLINES = {
  videographie: "Nous fabriquons des œuvres qui font vendre.",
  branding: "Une marque pensée pour bouger.",
  siteWeb: "Un site qui se regarde comme un film.",
};

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
  // Video projects are published on purpose: they must never show up on the
  // Branding or Site web homepages, which have no project of their own yet.
  await content.editDraft({
    portfolio: { projects: SAMPLE_PORTFOLIO_PROJECTS },
  });
  await content.publish();
});

test.afterEach(async () => {
  await content.reset();
});

function discipline(page: Page): Locator {
  return page.getByTestId("discipline-switch");
}

function h1(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

test.describe("Each Discipline has its own address", () => {
  for (const home of HOMEPAGES) {
    test(`${home.path} renders the ${home.discipline} homepage`, async ({
      page,
    }) => {
      await page.goto(home.path);

      await expect(page.getByRole("main")).toHaveAttribute(
        "data-discipline",
        home.discipline,
      );
      await expect(h1(page)).toHaveText(home.headline);
      await expect(page).toHaveTitle(home.title);
    });
  }

  test("the test-only Discipline previews are gone", async ({ request }) => {
    for (const discipline of ["branding", "site-web"]) {
      const response = await request.get(`/test/discipline/${discipline}`);
      expect(response.status(), discipline).toBe(404);
    }
  });
});

test.describe("The Discipline switch", () => {
  for (const home of HOMEPAGES) {
    test(`on ${home.path} lists the three Disciplines and marks the current one`, async ({
      page,
    }) => {
      await page.goto(home.path);

      const nav = page
        .getByTestId("hero")
        .getByRole("navigation", { name: "Disciplines" });
      await expect(nav).toBeVisible();
      await expect(nav).toHaveAttribute("data-testid", "discipline-switch");

      const links = nav.getByRole("link");
      await expect(links).toHaveCount(3);
      await expect(links).toHaveText(SWITCH.map((item) => item.name));

      for (const [index, item] of SWITCH.entries()) {
        await expect(links.nth(index)).toHaveAttribute("href", item.href);
        // Only the Discipline being read is marked as the current page.
        if (item.discipline === home.discipline) {
          await expect(links.nth(index)).toHaveAttribute("aria-current", "page");
        } else {
          await expect(links.nth(index)).not.toHaveAttribute("aria-current");
        }
      }
    });
  }

  test("moves between Disciplines with the keyboard alone", async ({ page }) => {
    await page.goto("/");

    async function tabTo(name: string) {
      const link = discipline(page).getByRole("link", { name, exact: true });
      for (let presses = 0; presses < 40; presses++) {
        await page.keyboard.press("Tab");
        if (await link.evaluate((el) => el === document.activeElement)) {
          return link;
        }
      }
      throw new Error(`Tab never reached the "${name}" link in 40 presses`);
    }

    const branding = await tabTo("Branding");
    await expect(branding).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/branding$/);
    await expect(h1(page)).toHaveText(HEADLINES.branding);
    await expect(
      discipline(page).getByRole("link", { name: "Branding", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    // A fresh page, a fresh walk through the tab order.
    const siteWeb = await tabTo("Site web");
    await expect(siteWeb).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/site-web$/);
    await expect(h1(page)).toHaveText(HEADLINES.siteWeb);
    await expect(
      discipline(page).getByRole("link", { name: "Site web", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("gives each homepage it reaches that homepage's own colours", async ({
    page,
  }) => {
    // Followed client-side, where the page left behind stays in the document,
    // hidden: its theme must not outlive it.
    await page.goto("/");
    for (const { name, href, ground } of [
      { name: "Branding", href: "/branding", ground: "rgb(239, 232, 220)" },
      { name: "Site web", href: "/site-web", ground: "rgb(7, 13, 31)" },
      { name: "Vidéographie", href: "/", ground: "rgb(10, 10, 10)" },
    ]) {
      await discipline(page).getByRole("link", { name, exact: true }).click();
      await page.waitForURL((url) => url.pathname === href);
      await expect(page.locator("body")).toHaveCSS("background-color", ground);
    }
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("still takes the visitor to the other homepage", async ({ page }) => {
      await page.goto("/");

      // Plain links, not client state: nothing runs, and the click still lands
      // on the other Discipline's own page.
      await discipline(page)
        .getByRole("link", { name: "Site web", exact: true })
        .click();

      await expect(page).toHaveURL(/\/site-web$/);
      await expect(h1(page)).toHaveText(HEADLINES.siteWeb);
    });
  });
});

test.describe("The shipped Branding and Site web content", () => {
  const SHIPPED = [
    {
      path: "/branding",
      cards: ["Logo & déclinaisons", "Charte graphique", "Marque en mouvement"],
      cardHref: "/services",
      proof: ["Pensée pour bouger", "Questionnaire", "Charte complète", "Un seul studio"],
      workLink: "Toutes les chartes",
      empty: "Les chartes publiées apparaîtront ici dès leur mise en ligne.",
      emphasis: "bouger",
    },
    {
      path: "/site-web",
      cards: ["Site vitrine", "Boutique en ligne", "Page de lancement"],
      cardHref: "/contact",
      proof: ["Mobile d'abord", "Vidéo intégrée", "Mobile Money", "WhatsApp"],
      workLink: "Tous les sites",
      empty: "Les sites publiés apparaîtront ici dès leur mise en ligne.",
      emphasis: "regarde",
    },
  ] as const;

  for (const shipped of SHIPPED) {
    test.describe(shipped.path, () => {
      test("accents one word of its heading", async ({ page }) => {
        await page.goto(shipped.path);
        await expect(h1(page).locator("em")).toHaveText(shipped.emphasis);
      });

      test("presents its three services", async ({ page }) => {
        await page.goto(shipped.path);

        const section = page.getByRole("region", { name: "Ce qu'on fait" });
        await expect(section.getByRole("listitem")).toHaveCount(3);
        for (const name of shipped.cards) {
          await expect(
            section.getByRole("heading", { level: 3, name }),
          ).toBeVisible();
          await expect(
            section.getByRole("link", { name: new RegExp(name) }),
          ).toHaveAttribute("href", shipped.cardHref);
        }
      });

      test("states its four proof points", async ({ page }) => {
        await page.goto(shipped.path);

        const section = page.getByRole("region", {
          name: "La différence WeCreate",
        });
        await expect(section.getByRole("listitem")).toHaveCount(4);
        for (const figure of shipped.proof) {
          await expect(section.getByText(figure, { exact: true })).toBeVisible();
        }
      });

      test("shows an empty Travaux récents, not another Discipline's films", async ({
        page,
      }) => {
        await page.goto(shipped.path);

        // The sample video projects are published (beforeEach), yet none
        // belongs to this Discipline, so none may appear.
        const section = page.getByRole("region", { name: /Travaux récents/ });
        await expect(
          section.getByRole("link", { name: shipped.workLink }),
        ).toHaveAttribute("href", "/portfolio");
        await expect(section.getByTestId("recent-work-empty")).toHaveText(
          shipped.empty,
        );
        await expect(page.getByTestId("recent-work-reel")).toHaveCount(0);
        await expect(page.getByText("Résidence Aurora")).toHaveCount(0);
      });

      test("does not carry Vidéographie's brand quote", async ({ page }) => {
        await page.goto(shipped.path);
        await expect(
          page.getByText("« Ils n'ont pas filmé nos appartements", {
            exact: false,
          }),
        ).toHaveCount(0);
      });
    });
  }
});

test.describe("Every block comes from the Studio, one Discipline at a time", () => {
  test("editing the Branding homepage changes Branding and nothing else", async ({
    page,
  }) => {
    await content.editDraft({
      brandingHomePage: {
        hero: { headline: { emphasis: "durer" } },
        universes: {
          universes: [
            {
              key: "identite-sur-mesure",
              kicker: "Identité",
              title: "Identité sur mesure",
              description: "Une marque dessinée pour durer.",
              linkLabel: "Voir l'offre",
              href: "/services",
              media: {
                ratio: "4 / 5",
                placeholderLabel: "IDENTITÉ",
                imageUrl: null,
                alternativeText: "",
              },
            },
          ],
        },
        proof: {
          points: [
            {
              key: "une-preuve",
              figure: "Une seule preuve",
              description: "Rédigée par l'éditeur.",
            },
          ],
        },
        recentWork: { link: { label: "Nos identités", href: "/portfolio" } },
      },
    });
    await content.publish("brandingHomePage");

    await page.goto("/branding");
    await expect(h1(page)).toHaveText("Une marque pensée pour durer.");
    const cards = page.getByRole("region", { name: "Ce qu'on fait" });
    await expect(cards.getByRole("listitem")).toHaveCount(1);
    await expect(
      cards.getByRole("heading", { level: 3, name: "Identité sur mesure" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "La différence WeCreate" })
        .getByRole("listitem"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "Nos identités" }),
    ).toHaveAttribute("href", "/portfolio");

    // The other two homepages are different documents: still as shipped.
    for (const [path, headline] of [
      ["/", HEADLINES.videographie],
      ["/site-web", HEADLINES.siteWeb],
    ] as const) {
      await page.goto(path);
      await expect(h1(page), path).toHaveText(headline);
      await expect(
        page
          .getByRole("region", { name: "Ce qu'on fait" })
          .getByRole("listitem"),
        path,
      ).toHaveCount(3);
      await expect(
        page
          .getByRole("region", { name: "La différence WeCreate" })
          .getByRole("listitem"),
        path,
      ).toHaveCount(4);
    }
  });
});

test.describe("Publishing one Discipline's homepage expires only that page", () => {
  const EDITS = {
    homePage: { hero: { headline: { emphasis: "films" } } },
    brandingHomePage: { hero: { headline: { emphasis: "durer" } } },
    siteWebHomePage: { hero: { headline: { emphasis: "lit" } } },
  };

  /**
   * Fill the three homepages' cache entries over plain HTTP, with no browser
   * to prefetch in the background and make a stale page look fresh (see
   * `warmPublicPages` in `managed-content-publishing.spec.ts`).
   */
  async function warm(request: APIRequestContext) {
    for (const { path } of HOMEPAGES) {
      expect((await request.get(path)).status()).toBe(200);
    }
  }

  async function expectHeadlines(
    page: Page,
    expected: Record<"/" | "/branding" | "/site-web", string>,
  ) {
    for (const [path, headline] of Object.entries(expected)) {
      await page.goto(path);
      await expect(h1(page), path).toHaveText(headline);
    }
  }

  test("a publish of the Site web homepage refreshes /site-web only", async ({
    page,
    request,
  }) => {
    await warm(request);

    await content.editDraft(EDITS);
    await content.publish("siteWebHomePage");

    // The other two are still served from the entries filled before the edit.
    await expectHeadlines(page, {
      "/": HEADLINES.videographie,
      "/branding": HEADLINES.branding,
      "/site-web": "Un site qui se lit comme un film.",
    });
  });

  test("a webhook for the Branding homepage refreshes /branding only", async ({
    page,
    request,
  }) => {
    await warm(request);

    await content.editDraft(EDITS);
    await content.persistPublished();
    expect(await content.triggerWebhook("brandingHomePage")).toBe(200);

    await expectHeadlines(page, {
      "/": HEADLINES.videographie,
      "/branding": "Une marque pensée pour durer.",
      "/site-web": HEADLINES.siteWeb,
    });
  });
});

test.describe("Preview", () => {
  test("shows an unpublished Branding edit only to an editor", async ({
    page,
  }) => {
    await content.editDraft({
      brandingHomePage: { hero: { headline: { emphasis: "durer" } } },
    });

    await page.goto("/branding");
    await expect(h1(page)).toHaveText(HEADLINES.branding);

    await enterPreview(page, "/branding");
    await expect(page).toHaveURL(/\/branding$/);
    await expect(h1(page)).toHaveText("Une marque pensée pour durer.");
    await expect(page.getByTestId("draft-mode-banner")).toBeVisible();
  });
});

test.describe("Discovery", () => {
  test("gives /branding and /site-web their own title, description and canonical", async ({
    page,
  }) => {
    await page.goto("/branding");
    await expect(page).toHaveTitle("Identité de marque · WeCreate");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Logo, palette, typographie, charte : WeCreate construit à Calavi Tankpè des identités de marque qui tiennent à l'écran comme sur une enseigne, puis les fait vivre en vidéo.",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https?:\/\/[^/]+\/branding$/,
    );

    await page.goto("/site-web");
    await expect(page).toHaveTitle("Création de sites web · WeCreate");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Sites vitrines, boutiques en ligne, pages de lancement : WeCreate conçoit à Calavi Tankpè des sites sur mesure, rapides et pensés pour le téléphone, avec vos films en ouverture.",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https?:\/\/[^/]+\/site-web$/,
    );
  });

  test("keeps Vidéographie's own title and canonical on /", async ({ page }) => {
    await page.goto("/");

    // Untemplated: the other two titles end in "· WeCreate", this one does not
    // change from what it was before the other homepages existed.
    await expect(page).toHaveTitle(
      "WeCreate - Production vidéo cinématographique",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https?:\/\/[^/]+\/?$/,
    );
  });

  test("lists both new homepages in the sitemap", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );

    expect(paths).toEqual(
      expect.arrayContaining(["/", "/branding", "/site-web"]),
    );
  });
});
