import type { ManagedContentProvider } from "../provider";
import { readFixtureDataset, recordPublishedRead } from "./store";

/**
 * A deterministic Managed Content provider backed by a JSON fixture.
 *
 * This is the provider fake the acceptance suite runs the real application
 * against, and the one an unconfigured checkout falls back to so the site can
 * be developed without Sanity credentials.
 *
 * Published reads are logged beside the dataset (see `store.ts`) so the suite
 * can count the provider round trips a render really cost: a public page
 * served from cache does not add to it.
 */

export const fixtureContentProvider: ManagedContentProvider = {
  id: "fixture",
  async read(perspective) {
    if (perspective === "drafts") {
      return (await readFixtureDataset()).drafts;
    }

    await recordPublishedRead();
    return (await readFixtureDataset()).published;
  },
};
