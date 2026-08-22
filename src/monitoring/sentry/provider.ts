import "server-only";

import type { MonitoringEvent, MonitoringProvider } from "../types";

/**
 * Sentry, and the only module in the application that knows it exists
 * (ADR-0008).
 *
 * **One REST call and no SDK**, for the reason the Resend and FedaPay
 * adapters are: posting an envelope is a `POST` with a body and a header, and
 * a dependency for that would be a dependency to audit, update and keep in
 * step with Next.js, in exchange for stack-trace parsing this application
 * does not need. Failures here are already named, correlated, and scrubbed
 * before they arrive.
 *
 * `SENTRY_DSN` is server-only and there is no `NEXT_PUBLIC_SENTRY_*`
 * anything. Client errors arrive at `/api/observation` and are forwarded
 * from here; the browser never holds the DSN.
 */

const SEND_TIMEOUT_MS = 5_000;

interface ParsedDsn {
  envelopeUrl: string;
  publicKey: string;
  dsn: string;
}

function parseDsn(dsn: string): ParsedDsn | undefined {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !projectId) return undefined;
    return {
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: decodeURIComponent(url.username),
      dsn,
    };
  } catch {
    return undefined;
  }
}

function eventId(): string {
  // Web Crypto rather than `node:crypto`: `onRequestError` is compiled for
  // Edge as well as Node, and a Node builtin in this graph is a build warning
  // on every acceptance run.
  return crypto.randomUUID().replaceAll("-", "");
}

function envelope(parsed: ParsedDsn, event: MonitoringEvent): string {
  const id = eventId();
  const sentAt = new Date().toISOString();
  const header = JSON.stringify({
    event_id: id,
    sent_at: sentAt,
    dsn: parsed.dsn,
  });
  const item = JSON.stringify({ type: "event" });
  const payload = JSON.stringify({
    event_id: id,
    timestamp: sentAt,
    platform: "node",
    level: "error",
    logger: "wecreate",
    environment: process.env.NODE_ENV ?? "production",
    message: event.message,
    tags: {
      kind: event.kind,
      source: event.source,
    },
    extra: {
      ...(event.orderReference
        ? { orderReference: event.orderReference }
        : {}),
      ...(event.providerTransactionId
        ? { providerTransactionId: event.providerTransactionId }
        : {}),
      ...(event.providerEventId
        ? { providerEventId: event.providerEventId }
        : {}),
    },
    fingerprint: [event.kind, event.source],
  });
  return `${header}\n${item}\n${payload}`;
}

async function send(event: MonitoringEvent): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.error("SENTRY_DSN is not a DSN this adapter can send to.");
    return;
  }

  const response = await fetch(parsed.envelopeUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_client=wecreate/0.1.0, sentry_key=${parsed.publicKey}`,
    },
    body: envelope(parsed, event),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  }).catch((error: unknown) => {
    console.error(
      "Sentry did not accept an event.",
      error instanceof Error ? error.name : "unknown",
    );
    return undefined;
  });

  if (response && !response.ok) {
    console.error(`Sentry answered ${response.status}.`);
  }
}

export const sentryMonitoringProvider: MonitoringProvider = {
  id: "sentry",

  async capture(event) {
    await send(event);
  },
};
