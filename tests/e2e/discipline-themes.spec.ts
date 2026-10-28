import { expect, test, type Page } from "@playwright/test";

import {
  AA_LARGE,
  AA_NORMAL,
  collectText,
  contrastRatio,
  expectHeroMeetsAa,
  expectMeetsAa,
  relativeLuminance,
} from "./support/contrast";
import { ManagedContent } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

/**
 * Issue #56: every page can declare its Discipline and gets that Discipline's
 * colour theme.
 *
 * Vidéographie is the homepage itself. Branding and Site web have no address
 * of their own until #59, so they are measured on the test-only previews that
 * render the same homepage composition in their theme. Vidéographie's own
 * pages are guarded unchanged by `visual.spec.ts` and `contrast.spec.ts`; this
 * file measures what the two new themes add, and that the three agree on the
 * rules every theme has to keep.
 */

const THEMES = [
  {
    discipline: "videographie",
    path: "/",
    ground: "rgb(10, 10, 10)",
    text: "rgb(255, 255, 255)",
    // The inverted band's own text colour: Vidéographie's is pure black, a
    // step deeper than its #0A0A0A ground.
    inverseText: "rgb(0, 0, 0)",
    brandMark: /\/brand\/(logo|icone)-blanc\.svg$/,
  },
  {
    discipline: "branding",
    path: "/test/discipline/branding",
    ground: "rgb(239, 232, 220)",
    text: "rgb(26, 21, 17)",
    inverseText: "rgb(239, 232, 220)",
    brandMark: /\/brand\/(logo|icone)-noir\.svg$/,
  },
  {
    discipline: "site-web",
    path: "/test/discipline/site-web",
    ground: "rgb(7, 13, 31)",
    text: "rgb(232, 238, 255)",
    inverseText: "rgb(7, 13, 31)",
    brandMark: /\/brand\/(logo|icone)-blanc\.svg$/,
  },
] as const;

/** Waits out the hero's entrance and the scroll reveals before measuring. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}

let content: ManagedContent;

test.beforeEach(async ({ request }) => {
  content = new ManagedContent(request);
  await content.reset();
  await content.editDraft({
    portfolio: { projects: SAMPLE_PORTFOLIO_PROJECTS },
  });
  await content.publish();
});

test.afterEach(async () => {
  await content.reset();
});

for (const theme of THEMES) {
  test.describe(`The ${theme.discipline} theme`, () => {
    test("is declared by the page and paints the whole document", async ({
      page,
    }) => {
      await page.goto(theme.path);

      await expect(page.getByRole("main")).toHaveAttribute(
        "data-discipline",
        theme.discipline,
      );

      // The theme reaches past `<main>`: the body, the header and the footer
      // are outside it and take the same ground.
      const body = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return { background: style.backgroundColor, color: style.color };
      });
      expect(body).toEqual({ background: theme.ground, color: theme.text });
      await expect(page.getByRole("contentinfo")).toHaveCSS(
        "color",
        theme.text,
      );
    });

    test("carries the brand mark its ground calls for", async ({ page }) => {
      await page.goto(theme.path);

      // The header's word-mark and icon — one of the two is hidden at any
      // width, so they are found by element rather than by role — and the
      // footer's word-mark.
      const marks = page.locator("header img, footer img");
      await expect(marks).toHaveCount(3);
      for (const source of await marks.evaluateAll((images) =>
        images.map((image) => new URL((image as HTMLImageElement).src).pathname),
      )) {
        expect(source).toMatch(theme.brandMark);
      }
    });

    test("inverts its inverted band", async ({ page }) => {
      await page.goto(theme.path);

      // The proof band swaps the page's two colours: its ground is the page's
      // text colour, and its text is the page's ground.
      const band = page.locator('[data-surface="inverse"]').first();
      await expect(band).toHaveCSS("background-color", theme.text);
      await expect(band).toHaveCSS("color", theme.inverseText);
    });

    test("meets WCAG AA on every flat surface", async ({ page }) => {
      await page.goto(theme.path);
      await settle(page);

      const texts = (await collectText(page)).filter((text) => !text.inHero);
      expect(texts.length).toBeGreaterThan(20);

      expectMeetsAa(texts);
    });

    test("keeps every text and ground pair of its palette at WCAG AA", async ({
      page,
    }) => {
      // The pages above measure what is on them today. This measures the
      // palette itself, so a pairing no page happens to show yet cannot fail
      // quietly in one theme: each family's text tokens against each of the
      // grounds they are written on.
      await page.goto(theme.path);

      const pairs: Array<[string, string, number]> = [];
      for (const text of ["text", "text-soft", "text-muted", "error"]) {
        for (const ground of ["ground", "ground-deep", "surface", "surface-2"]) {
          pairs.push([text, ground, AA_NORMAL]);
        }
      }
      // The accent is for large text only: the italic word of a heading.
      for (const ground of ["ground", "ground-deep", "surface"]) {
        pairs.push(["accent", ground, AA_LARGE]);
      }
      pairs.push(["on-accent", "accent", AA_NORMAL]);
      for (const text of [
        "inverse-text",
        "inverse-ink",
        "inverse-muted",
        "inverse-error",
      ]) {
        pairs.push([text, "inverse", AA_NORMAL]);
      }

      const tokens = [...new Set(pairs.flatMap(([a, b]) => [a, b]))];
      const resolved = await page.evaluate((names) => {
        // Resolved by the browser rather than parsed from the stylesheet, so
        // what is measured is what a page in this theme would paint.
        const probe = document.createElement("span");
        document.body.append(probe);
        const out: Record<string, number[]> = {};
        for (const name of names) {
          probe.style.color = `var(--color-wc-${name})`;
          out[name] = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? [])
            .slice(0, 3)
            .map(Number);
        }
        probe.remove();
        return out;
      }, tokens);

      const failures: string[] = [];
      for (const [text, ground, needs] of pairs) {
        const ratio = contrastRatio(
          relativeLuminance(...(resolved[text] as [number, number, number])),
          relativeLuminance(...(resolved[ground] as [number, number, number])),
        );
        if (ratio < needs) {
          failures.push(`${text} on ${ground} — ${ratio.toFixed(2)}:1, needs ${needs}:1`);
        }
      }
      expect(failures, `\n${failures.join("\n")}\n`).toEqual([]);
    });

    if (theme.discipline !== "videographie") {
      // Vidéographie's hero is measured by `contrast.spec.ts`.
      test("keeps the hero legible over its generated background", async ({
        page,
      }) => {
        test.slow();

        await page.goto(theme.path);
        await expect(page.getByTestId("hero-background")).toBeAttached();
        await page.waitForTimeout(1500);

        await expectHeroMeetsAa(page);
      });
    }

    test.describe("with reduced motion", () => {
      test.use({ contextOptions: { reducedMotion: "reduce" } });

      test("shows the still ground instead, just as legible", async ({
        page,
      }) => {
        await page.goto(theme.path);
        await settle(page);

        await expect(page.getByTestId("hero-background")).toHaveCount(0);
        await expectHeroMeetsAa(page);
      });
    });
  });
}

test("pages outside a Discipline stay in Vidéographie's black and white", async ({
  page,
}) => {
  // Issue #55, decision 4: the Boutique, À propos, Contact, legal and
  // transaction pages never take a Discipline's colours.
  for (const path of ["/boutique", "/a-propos", "/contact"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toHaveAttribute(
      "data-discipline",
      "videographie",
    );
    expect(
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    ).toBe("rgb(10, 10, 10)");
  }
});

test("a heading's accent word keeps the inverted band's own colour", async ({
  page,
}) => {
  // The italic word of a heading takes the Discipline's accent on the ground.
  // On an inverted band it must not: Vidéographie's accent is white, and the
  // Boutique's title sits on its white band.
  await page.goto("/boutique");
  await expect(
    page.getByRole("heading", { level: 1 }).locator("em"),
  ).toHaveCSS("color", "rgb(0, 0, 0)");
});
