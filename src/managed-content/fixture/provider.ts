import type { ManagedContentProvider } from "../provider";
import { readFixtureDataset } from "./store";

/**
 * A deterministic Managed Content provider backed by a JSON fixture.
 *
 * This is the provider fake the acceptance suite runs the real application
 * against, and the one an unconfigured checkout falls back to so the site can
 * be developed without Sanity credentials.
 */
export const fixtureContentProvider: ManagedContentProvider = {
  id: "fixture",
  async read(perspective) {
    const dataset = await readFixtureDataset();
    return perspective === "drafts" ? dataset.drafts : dataset.published;
  },
};
