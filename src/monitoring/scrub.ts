import "server-only";

import type { MonitoringEvent } from "./types";

/**
 * What must never leave this process in an error event.
 *
 * Secrets are taken from the environment at capture time, so a rotation is
 * honoured without a redeploy of this list. Patterns catch the things a
 * stack trace or a copied message might still carry: an email, a telephone,
 * an Order Access token, a bearer header.
 *
 * The event's own correlation fields are copied through rather than run
 * through the replacer — they are identifiers this application chose to be
 * safe to log (issue #1).
 */

const SECRET_VARIABLES = [
  "FEDAPAY_SECRET_KEY",
  "FEDAPAY_WEBHOOK_SECRET",
  "WECREATE_PAYMENT_WEBHOOK_SECRET",
  "WECREATE_PAYMENT_EVENT_SECRET",
  "RESEND_API_KEY",
  "SANITY_API_READ_TOKEN",
  "SANITY_WEBHOOK_SECRET",
  "SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WECREATE_PREVIEW_SECRET",
  "WECREATE_REVALIDATE_SECRET",
] as const;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const TELEPHONE = /\+[1-9]\d{7,14}/g;
/** 32 bytes of base64url, the shape of an Order Access token. */
const ACCESS_TOKEN = /\b[A-Za-z0-9_-]{43}\b/g;
const BEARER = /bearer\s+[^\s]+/gi;

function secretValues(): string[] {
  return SECRET_VARIABLES.map((name) => process.env[name])
    .filter((value): value is string => Boolean(value && value.length >= 8))
    .sort((left, right) => right.length - left.length);
}

/** Replace one value in a string without leaking how long the secret was. */
function withoutSecrets(text: string): string {
  let scrubbed = text;
  for (const secret of secretValues()) {
    if (!secret) continue;
    scrubbed = scrubbed.split(secret).join("[redacted]");
  }
  return scrubbed
    .replace(BEARER, "bearer [redacted]")
    .replace(EMAIL, "[redacted-email]")
    .replace(TELEPHONE, "[redacted-telephone]")
    .replace(ACCESS_TOKEN, "[redacted-token]");
}

/**
 * The event that is safe to hand to a monitoring provider.
 *
 * Correlation fields are kept as they are: an order reference is fifty bits
 * of randomness, not a secret, and a provider's transaction id is what an
 * operator has in a dashboard. Everything else is a sentence, and the
 * sentence is what is scrubbed.
 */
export function scrubEvent(event: MonitoringEvent): MonitoringEvent {
  return {
    kind: event.kind,
    source: event.source,
    message: withoutSecrets(event.message).slice(0, 500),
    ...(event.orderReference ? { orderReference: event.orderReference } : {}),
    ...(event.providerTransactionId
      ? { providerTransactionId: event.providerTransactionId }
      : {}),
    ...(event.providerEventId ? { providerEventId: event.providerEventId } : {}),
  };
}

/**
 * A path that may be attached to a server error, with the credential taken
 * out of it.
 *
 * `/commande/acces/<token>` is the address in the buyer's mail. A server
 * error on the way in must not reprint the token in Sentry. Query strings
 * are dropped wholesale: they are how a forged payment return arrives, and
 * nothing in them is a reason an error happened.
 */
export function scrubPath(path: string): string {
  const [pathname] = path.split("?");
  return withoutSecrets(
    (pathname ?? path).replace(
      /\/commande\/acces\/[A-Za-z0-9_-]{43}/,
      "/commande/acces/[jeton]",
    ),
  );
}
