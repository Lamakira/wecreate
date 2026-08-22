import type { ManagedContentProvider } from "../provider";
import {
  fixtureReadActivity,
  readFixtureDataset,
  recordFixtureRead,
  resetFixtureReadActivity,
} from "./store";

export async function publishedReadCount(): Promise<number> {
  return (await fixtureReadActivity()).publishedReads;
}

export async function draftReadCount(): Promise<number> {
  return (await fixtureReadActivity()).draftReads;
}

export async function resetReadCounts(): Promise<void> {
  await resetFixtureReadActivity();
}

/**
 * A deterministic Managed Content provider backed by a JSON fixture.
 *
 * This is the provider fake the acceptance suite runs the real application
 * against, and the one an unconfigured checkout falls back to so the site can
 * be developed without Sanity credentials.
 *
 * Read counts are how the suite observes cache hits: a public page served from
 * cache does not increment `publishedReads`. They live beside the dataset file
 * so a `"use cache"` fill and the test-hook route see the same numbers.
 */

export const fixtureContentProvider: ManagedContentProvider = {
  id: "fixture",
  async read(perspective) {
    if (perspective === "drafts") {
      await recordFixtureRead("drafts");
      return (await readFixtureDataset()).drafts;
    }

    await recordFixtureRead("published");
    return (await readFixtureDataset()).published;
  },
};
