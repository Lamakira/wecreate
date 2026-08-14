import { defineConfig } from "@playwright/test";

/**
 * The provider-contract smoke suite.
 *
 * Its own configuration, and deliberately not part of `pnpm test:e2e`. The
 * acceptance suite builds and drives the whole application against deterministic
 * fakes and reaches no external service at all; this one does the opposite —
 * it calls a real vendor sandbox to check the two things a fake cannot possibly
 * verify: that the request WeCreate sends is the request the vendor accepts, and
 * that the response it sends back still parses.
 *
 * It runs no browser and starts no server, so there is nothing here to build.
 * Each spec skips itself when its credentials are absent, which is every run
 * that has not deliberately been given them (issue #1: contract smoke tests
 * never create live charges and never replace black-box coverage).
 */
export default defineConfig({
  testDir: "./tests/contract",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // A vendor sandbox is slower and less reliable than anything else this
  // repository talks to, and it is not what is under test.
  timeout: 60_000,
  retries: 1,
  reporter: [["list"]],
});
