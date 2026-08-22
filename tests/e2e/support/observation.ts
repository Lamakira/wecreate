import type { APIRequestContext } from "@playwright/test";

/**
 * Captured failures, as far as this suite is concerned.
 *
 * The suite cannot open Sentry, and must not. The fixture monitoring provider
 * keeps what it was asked to record and `/api/test/observation` reads it back
 * — which is how a scenario asserts that a forged webhook, a guessed token or
 * a failed delivery was reported without a secret, an email or a token in the
 * event.
 *
 * Resetting also empties the in-memory rate-limit buckets. They live in the
 * same process, and a scenario that fills one would otherwise fail the next.
 */

/** One event as the fixture hands it back. Spelled here, not imported. */
export interface CapturedEvent {
  kind: string;
  source: string;
  message: string;
  orderReference?: string;
  providerTransactionId?: string;
  providerEventId?: string;
}

export class Observation {
  constructor(private readonly request: APIRequestContext) {}

  /** Throw away every captured event and empty every rate-limit bucket. */
  async reset(): Promise<void> {
    const response = await this.request.post("/api/test/observation", {
      data: { action: "reset" },
    });
    if (response.status() === 404) {
      throw new Error(
        "The observation test hook is not mounted. Playwright reuses an " +
          "already-running server outside CI, so this usually means a server " +
          "started by hand is holding the port. Stop it and re-run.",
      );
    }
    if (!response.ok()) {
      throw new Error(
        `Observation test hook failed: ${response.status()} ${await response.text()}`,
      );
    }
  }

  /** Everything captured since the last reset, oldest first. */
  async events(): Promise<CapturedEvent[]> {
    const response = await this.request.get("/api/test/observation");
    if (response.status() === 404) {
      throw new Error(
        "The observation test hook is not mounted. Playwright reuses an " +
          "already-running server outside CI, so this usually means a server " +
          "started by hand is holding the port. Stop it and re-run.",
      );
    }
    if (!response.ok()) {
      throw new Error(
        `Observation test hook failed: ${response.status()} ${await response.text()}`,
      );
    }
    const body = (await response.json()) as { events: CapturedEvent[] };
    return body.events;
  }
}
