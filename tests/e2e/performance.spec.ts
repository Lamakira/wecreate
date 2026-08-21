import { expect, test } from "@playwright/test";

import { ManagedContent } from "./support/managed-content";
import { SAMPLE_PORTFOLIO_PROJECTS } from "./support/sample-content";

/**
 * Production-like performance properties the acceptance suite can observe.
 *
 * Field Core Web Vitals at the 75th percentile are Cloudflare Web Analytics'
 * to collect from real visits (ADR-0011). This file locks the behaviours that
 * keep those numbers reachable: public pages may be cached, Supabase stays off
 * the browsing path, portfolio video is not preloaded, and a throttled mobile
 * still gets a usable first view.
 */

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

test.describe("Public caching and the browsing path", () => {
  test("serves the homepage as a cacheable document", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const cacheControl = response.headers()["cache-control"] ?? "";
    expect(cacheControl).not.toMatch(/no-store/i);
  });

  test("keeps checkout out of shared caches", async ({ request }) => {
    const response = await request.get("/commande");
    const cacheControl = response.headers()["cache-control"] ?? "";
    expect(cacheControl).toMatch(/no-store|private|no-cache/i);
  });

  test("does not contact Supabase while browsing", async ({ page }) => {
    const leaked: string[] = [];
    page.on("request", (request) => {
      if (/supabase/i.test(request.url())) {
        leaked.push(request.url());
      }
    });

    await page.goto("/");
    await page.goto("/portfolio");
    await page.goto("/boutique");
    await page.goto("/boutique/color-grading-signature");

    expect(leaked).toEqual([]);
  });

  test("does not preload a portfolio film before the visitor asks", async ({
    page,
  }) => {
    await page.goto("/portfolio");
    await page.getByRole("link", { name: /Résidence Aurora/ }).click();
    await expect(
      page.getByRole("dialog", { name: "Résidence Aurora" }),
    ).toBeVisible();

    const preloads = await page
      .locator("video")
      .evaluateAll((videos) =>
        videos.map((video) => (video as HTMLVideoElement).preload),
      );
    expect(preloads.length).toBeGreaterThan(0);
    expect(preloads.every((value) => value === "none" || value === "")).toBe(
      true,
    );
  });
});

test.describe("Throttled mobile", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "CPU and network throttling are Chromium DevTools.",
  );

  test("still paints the homepage heading on a slow phone", async ({
    page,
  }) => {
    const session = await page.context().newCDPSession(page);
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: 50 * 1024,
      uploadThroughput: 20 * 1024,
      latency: 400,
      connectionType: "cellular3g",
    });
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    await page.goto("/", { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("link", { name: "Voir le portfolio" }),
    ).toBeVisible();
  });
});
