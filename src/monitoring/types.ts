/**
 * What this application is willing to say about a failure.
 *
 * Correlation is by order reference and the provider's own identifiers —
 * never by a name, an email, a telephone, a token or a secret (issue #1).
 * The scrubber in `scrub.ts` is the last line of defence; the types here
 * are the first: there is nowhere to put a buyer in this object.
 */

export type MonitoringProviderId = "sentry" | "fixture" | "none";

export type MonitoringSource =
  | "client"
  | "server"
  | "webhook"
  | "fulfillment"
  | "storage"
  | "email";

/**
 * Why this event exists, in the vocabulary an alert is configured against.
 *
 * Issue #1 asks for alerts on signature failures, a fulfillment backlog,
 * repeated token guessing and unusual payment retries. The other kinds are
 * the same failures captured so they can be found; they are not themselves
 * alert conditions.
 */
export type MonitoringKind =
  | "signature-failure"
  | "token-guessing"
  | "unusual-payment-retries"
  | "fulfillment-backlog"
  | "client-error"
  | "server-error"
  | "webhook-failure"
  | "storage-failure"
  | "email-failure";

export interface MonitoringEvent {
  kind: MonitoringKind;
  source: MonitoringSource;
  /** A sentence about what failed, already scrubbed. */
  message: string;
  /** WeCreate's own order reference, when one is known. */
  orderReference?: string;
  /** The payment provider's transaction identity, when one is known. */
  providerTransactionId?: string;
  /** The payment provider's event identity, when one is known. */
  providerEventId?: string;
}

export interface MonitoringProvider {
  readonly id: MonitoringProviderId;
  capture(event: MonitoringEvent): Promise<void>;
}
