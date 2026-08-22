import "server-only";

import type { MonitoringEvent, MonitoringProvider } from "../types";

/**
 * A deterministic monitoring provider: an in-memory log, and nothing sent
 * anywhere.
 *
 * In-memory rather than a file because the only reader is this same Node
 * process, through `/api/test/observation`. Next.js compiles this module into
 * more than one graph, so the log lives on `globalThis` — the object the
 * webhook, a server action and the test hook actually share. The acceptance
 * suite and the application server are two processes, but the suite reads by
 * asking the server, the way it reads the outbox — it never opens the log
 * itself.
 *
 * The fixture is never selected by inference. An unconfigured deployment
 * reports nothing, which is the safe default and the one that keeps a missing
 * DSN from silently swallowing events into a log nobody is looking at.
 */

const processStore = globalThis as typeof globalThis & {
  __wecreateMonitoringEvents?: MonitoringEvent[];
};

function events(): MonitoringEvent[] {
  processStore.__wecreateMonitoringEvents ??= [];
  return processStore.__wecreateMonitoringEvents;
}

export const fixtureMonitoringProvider: MonitoringProvider = {
  id: "fixture",

  async capture(event) {
    events().push(event);
  },
};

/** Everything captured since the last reset, oldest first. */
export function readMonitoringEvents(): MonitoringEvent[] {
  return [...events()];
}

export function resetMonitoringEvents(): void {
  events().length = 0;
}
