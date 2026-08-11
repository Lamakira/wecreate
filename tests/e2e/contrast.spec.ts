import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";

import { ManagedContent } from "./support/managed-content";
import {
  SAMPLE_DIGITAL_PRODUCTS,
  SAMPLE_PORTFOLIO_PROJECTS,
} from "./support/sample-content";

/**
 * Text contrast, measured rather than assumed.
 *
 * The regression guard for a palette that needed correcting: the design
 * handoff's `#777` micro-labels reach 4.42:1 at best on this site's own
 * surfaces and 4.48:1 on its light band, and its `#555` footer text 2.8:1. None
 * meet WCAG 2.2 AA, and no single grey could — against both `#0A0A0A` and
 * `#FFFFFF` the best any grey manages is 4.39:1, which is why dark and light
 * surfaces carry separate tokens.
 *
 * Two techniques, because the page has two kinds of ground:
 *
 * - Flat surfaces are read from computed styles. Deterministic, and needs no
 *   screenshots.
 * - The hero is sampled from painted pixels, because its ground is a WebGL
 *   shader under a gradient scrim and no computed style describes it.
 */

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

interface CollectedText {
  label: string;
  color: [number, number, number];
  /** The first opaque surface behind it, or null if nothing paints one. */
  background: [number, number, number] | null;
  isLarge: boolean;
  inHero: boolean;
}

async function collectText(page: Page): Promise<CollectedText[]> {
  return page.evaluate(() => {
    const parse = (value: string): number[] | null => {
      const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
      return parts.length >= 3 ? parts : null;
    };

    const results: CollectedText[] = [];
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      // Decorative text is out of scope: media placeholder labels that vanish
      // once real assets land, and the marquee, which repeats the footer's
      // positioning line. Neither carries information of its own.
      if (element.closest('[aria-hidden="true"]')) {
        continue;
      }

      const own = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!own) {
        continue;
      }

      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") {
        continue;
      }
      const color = parse(style.color);
      if (!color || color[3] === 0) {
        continue;
      }

      const size = Number.parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;

      let background: number[] | null = null;
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement
      ) {
        const parts = parse(getComputedStyle(node).backgroundColor);
        if (parts && (parts[3] === undefined || parts[3] === 1)) {
          background = parts.slice(0, 3);
          break;
        }
      }

      results.push({
        label: `${element.tagName.toLowerCase()} "${own.slice(0, 42)}"`,
        color: color.slice(0, 3) as [number, number, number],
        background: background as [number, number, number] | null,
        // WCAG's definition of large text: 24px, or 18.66px when bold.
        isLarge: size >= 24 || (size >= 18.66 && weight >= 700),
        inHero: Boolean(element.closest('[data-testid="hero"]')),
      });
    }
    return results;
  });
}

test.describe("Text contrast", () => {
  let content: ManagedContent;

  test.beforeEach(async ({ request }) => {
    content = new ManagedContent(request);
    await content.reset();
    await content.editDraft({
      portfolio: { projects: SAMPLE_PORTFOLIO_PROJECTS },
      homePage: {
        shopPreview: { products: SAMPLE_DIGITAL_PRODUCTS },
      },
    });
    await content.publish();
  });

  test.afterEach(async () => {
    await content.reset();
  });

  test("every flat surface on the homepage meets WCAG AA", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(800);

    const texts = (await collectText(page)).filter((text) => !text.inHero);
    expect(texts.length).toBeGreaterThan(20);

    const failures: string[] = [];
    for (const text of texts) {
      if (!text.background) {
        failures.push(`${text.label} — sits on no opaque surface`);
        continue;
      }

      const ratio = contrastRatio(
        relativeLuminance(...text.color),
        relativeLuminance(...text.background),
      );
      const needs = text.isLarge ? AA_LARGE : AA_NORMAL;
      if (ratio < needs) {
        failures.push(`${text.label} — ${ratio.toFixed(2)}:1, needs ${needs}:1`);
      }
    }

    expect(failures, `\n${failures.join("\n")}\n`).toEqual([]);
  });

  test("the portfolio and its project dialog meet WCAG AA", async ({ page }) => {
    await page.goto("/portfolio");
    await page.getByRole("link", { name: /Résidence Aurora/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Résidence Aurora" }),
    ).toBeVisible();
    await page.waitForTimeout(800);

    // The dialog's own ground is `rgba(0,0,0,.94)` over the page, so its text is
    // measured with the dialog open rather than as a separate page.
    const texts = await collectText(page);
    expect(texts.length).toBeGreaterThan(10);

    const failures: string[] = [];
    for (const text of texts) {
      if (!text.background) {
        failures.push(`${text.label} — sits on no opaque surface`);
        continue;
      }

      const ratio = contrastRatio(
        relativeLuminance(...text.color),
        relativeLuminance(...text.background),
      );
      const needs = text.isLarge ? AA_LARGE : AA_NORMAL;
      if (ratio < needs) {
        failures.push(`${text.label} — ${ratio.toFixed(2)}:1, needs ${needs}:1`);
      }
    }

    expect(failures, `\n${failures.join("\n")}\n`).toEqual([]);
  });

  test("the hero meets WCAG AA over its generated background", async ({
    page,
  }) => {
    test.slow();

    await page.goto("/");
    await page.waitForTimeout(1500);

    const texts = (await collectText(page)).filter((text) => text.inHero);
    expect(texts.length).toBeGreaterThan(2);

    // Glyph rectangles, not the full-width line box, which spans places no
    // letter reaches. Read while the text is still painted: reading them after
    // hiding it would report every colour as transparent.
    const rects = await page.evaluate(() => {
      const out: Record<
        string,
        Array<{ x: number; y: number; w: number; h: number }>
      > = {};
      const hero = document.querySelector('[data-testid="hero"]')!;
      for (const element of Array.from(hero.querySelectorAll("*"))) {
        if (element.closest('[aria-hidden="true"]')) {
          continue;
        }
        const own = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? "")
          .join("")
          .trim();
        if (!own) {
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(element);
        out[`${element.tagName.toLowerCase()} "${own.slice(0, 42)}"`] =
          Array.from(range.getClientRects())
            .map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }))
            .filter((r) => r.w > 1 && r.h > 1);
      }
      return out;
    });

    await page.evaluate(async () => {
      const sheet = document.createElement("style");
      sheet.textContent =
        "* { color: transparent !important; transition: none !important; }";
      document.head.append(sheet);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });

    // Rectangles are CSS pixels; the screenshot is device pixels. On a phone
    // those differ by a factor of three, and sampling without this reads a
    // completely different part of the page.
    const scale = await page.evaluate(() => window.devicePixelRatio);

    const worst = new Map<string, number>();
    // The ground moves, so a single frame is not evidence.
    for (let frame = 0; frame < 6; frame++) {
      if (frame > 0) {
        await page.waitForTimeout(500);
      }
      const shot = PNG.sync.read(await page.screenshot({ animations: "allow" }));

      for (const text of texts) {
        const foreground = relativeLuminance(...text.color);
        for (const rect of rects[text.label] ?? []) {
          for (
            let y = Math.max(0, Math.floor(rect.y * scale));
            y < Math.min(shot.height, Math.ceil((rect.y + rect.h) * scale));
            y += 1
          ) {
            for (
              let x = Math.max(0, Math.floor(rect.x * scale));
              x < Math.min(shot.width, Math.ceil((rect.x + rect.w) * scale));
              x += 1
            ) {
              const i = (shot.width * y + x) << 2;
              const value = contrastRatio(
                foreground,
                relativeLuminance(
                  shot.data[i],
                  shot.data[i + 1],
                  shot.data[i + 2],
                ),
              );
              const seen = worst.get(text.label);
              if (seen === undefined || value < seen) {
                worst.set(text.label, value);
              }
            }
          }
        }
      }
    }

    const failures = texts
      .filter((text) => {
        const measured = worst.get(text.label);
        return (
          measured !== undefined &&
          measured < (text.isLarge ? AA_LARGE : AA_NORMAL)
        );
      })
      .map(
        (text) =>
          `${text.label} — ${worst.get(text.label)!.toFixed(2)}:1, needs ${
            text.isLarge ? AA_LARGE : AA_NORMAL
          }:1`,
      );

    expect(failures, `\n${failures.join("\n")}\n`).toEqual([]);
  });
});
