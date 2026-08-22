import "server-only";

import type { MonitoringEvent, MonitoringProvider, MonitoringProviderId } from "./types";
import { scrubEvent } from "./scrub";

export type {
  MonitoringEvent,
  MonitoringKind,
  MonitoringProviderId,
  MonitoringSource,
} from "./types";

/**
 * The single outbound boundary between WeCreate and whoever records its
 * failures (ADR-0008).
 *
 * One method, because there is one direction: this application has something
 * to say about a failure, and the provider keeps it. Nothing is read back —
 * alerts are configured in the provider's own surface, against the `kind`
 * values in `types.ts`, and a dashboard that this application polled would
 * be a second place for the same facts to live.
 *
 * The vendor HTTP call, when there is one, stays in `sentry/`. Capture sites
 * in route handlers and actions call `capture()` here and never name Sentry.
 * Client code posts to `/api/observation` and never holds a monitoring
 * secret: the DSN is server-only, the way every other credential here is.
 */

/** Which provider this process reports to. See `MonitoringProviderId`. */
export function resolveMonitoringProviderId(): MonitoringProviderId {
  const configured = process.env.WECREATE_MONITORING_PROVIDER;
  if (
    configured === "fixture" ||
    configured === "sentry" ||
    configured === "none"
  ) {
    return configured;
  }
  return process.env.SENTRY_DSN ? "sentry" : "none";
}

async function loadProvider(): Promise<MonitoringProvider | undefined> {
  switch (resolveMonitoringProviderId()) {
    case "fixture": {
      const { fixtureMonitoringProvider } = await import("./fixture/provider");
      return fixtureMonitoringProvider;
    }
    case "sentry": {
      const { sentryMonitoringProvider } = await import("./sentry/provider");
      return sentryMonitoringProvider;
    }
    default:
      return undefined;
  }
}

/**
 * Record one failure, scrubbed, or do nothing.
 *
 * Never throws: a monitoring outage must not take a payment webhook or a
 * download down with it. The original failure has already been handled by
 * the time this is called; losing the event is the safe direction.
 */
export async function capture(event: MonitoringEvent): Promise<void> {
  try {
    const provider = await loadProvider();
    if (!provider) return;
    await provider.capture(scrubEvent(event));
  } catch (error) {
    console.error("Recording a monitoring event failed.", error);
  }
}
