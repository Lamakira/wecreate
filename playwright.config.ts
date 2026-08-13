import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * The acceptance seam.
 *
 * One harness that builds and runs the complete Next.js application — the same
 * production build that ships — against the deterministic fixture content
 * provider, and drives it through a real browser. There are no component tests
 * and no mocked internals: every provider fake sits at the application's own
 * outbound boundary, so these tests stay valid when the code behind that
 * boundary is refactored.
 *
 * Later tickets extend this harness rather than replacing it: their fakes go in
 * beside the content one, and their journeys become new spec files.
 */

const PORT = Number(process.env.WECREATE_TEST_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Test-run secrets. Real deployments read these from secret management. */
export const TEST_PREVIEW_SECRET = "acceptance-preview-secret";
export const TEST_REVALIDATE_SECRET = "acceptance-revalidate-secret";

const serverEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  NODE_ENV: "production",
  WECREATE_CONTENT_PROVIDER: "fixture",
  WECREATE_TEST_HOOKS: "1",
  WECREATE_PREVIEW_SECRET: TEST_PREVIEW_SECRET,
  WECREATE_REVALIDATE_SECRET: TEST_REVALIDATE_SECRET,
  // Isolated from any content a developer has been editing locally.
  WECREATE_FIXTURE_FILE: path.join(
    process.cwd(),
    ".wecreate",
    "acceptance",
    "content.json",
  ),
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  // Crawlable, like production and unlike every other environment. What the
  // site keeps out of search results is then a decision the suite can check —
  // an unapproved legal text, a superseded revision, a preview session — rather
  // than a blanket `noindex` hiding whether any of those rules work.
  WECREATE_ALLOW_INDEXING: "true",
};

export default defineConfig({
  testDir: "./tests/e2e",
  // Content is a single shared dataset, so scenarios that publish must not run
  // concurrently with scenarios that read. Later tickets can parallelise per
  // worker once they bring per-worker persistence with them.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Africa/Porto-Novo",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: serverEnv,
  },
});
