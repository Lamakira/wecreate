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

/** Where the suite's application runs. Exported for the tests that seed a cookie. */
export const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Test-run secrets. Real deployments read these from secret management. */
export const TEST_PREVIEW_SECRET = "acceptance-preview-secret";
export const TEST_REVALIDATE_SECRET = "acceptance-revalidate-secret";
/**
 * A payment credential nothing in the run reads.
 *
 * The fixture payment provider has no credentials at all, which is exactly what
 * makes this worth setting: if this string ever appears in a response, something
 * is serialising the environment into one.
 */
export const TEST_FEDAPAY_SECRET = "sk_sandbox_acceptance_never_leaves_the_server";

/**
 * The secret the fixture payment provider signs webhook deliveries with.
 *
 * A real deployment gets this from FedaPay's own webhook settings. The fixture
 * has its own because the acceptance suite has to be able to *send* a delivery
 * WeCreate accepts and one it refuses, and neither is possible without holding
 * the same secret the application verifies against.
 */
export const TEST_PAYMENT_WEBHOOK_SECRET = "acceptance-webhook-secret";
/**
 * Cloudflare Web Analytics' public token, compiled into the test build.
 *
 * A real deployment gets this from a Web Analytics property. The suite sets
 * one so it can assert the beacon is present, that custom events carry no
 * personal data, and that a blocked analytics script does not take the page
 * down with it.
 */
export const TEST_CF_BEACON_TOKEN = "acceptance-cf-beacon";

const serverEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  NODE_ENV: "production",
  WECREATE_CONTENT_PROVIDER: "fixture",
  // The commerce data plane has its own provider and its own switch: a run can
  // be on fixture content and a real Supabase project, and the two must never
  // be selected together by accident.
  WECREATE_COMMERCE_PROVIDER: "fixture",
  // The payment provider is a third, for the same reason. Its fixture hands
  // buyers to an address that does not exist and confirms nothing.
  WECREATE_PAYMENT_PROVIDER: "fixture",
  // And the email provider is a fourth. Its fixture delivers to nobody and
  // keeps what it was asked to send, which is how a scenario reads a receipt
  // and follows the Order Access address in it.
  WECREATE_EMAIL_PROVIDER: "fixture",
  FEDAPAY_SECRET_KEY: TEST_FEDAPAY_SECRET,
  WECREATE_PAYMENT_WEBHOOK_SECRET: TEST_PAYMENT_WEBHOOK_SECRET,
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
  WECREATE_COMMERCE_FIXTURE_FILE: path.join(
    process.cwd(),
    ".wecreate",
    "acceptance",
    "commerce.json",
  ),
  WECREATE_EMAIL_FIXTURE_FILE: path.join(
    process.cwd(),
    ".wecreate",
    "acceptance",
    "outbox.json",
  ),
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  NEXT_PUBLIC_CF_BEACON_TOKEN: TEST_CF_BEACON_TOKEN,
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
    // Firefox and WebKit cover the public journeys the Chromium matrix does
    // not. They run a dedicated spec rather than the whole suite: issue #1
    // asks for the broader engines according to execution cost, and the
    // commerce scenarios already take the Chromium pair several minutes.
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: "**/public-journeys.spec.ts",
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: "**/public-journeys.spec.ts",
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
