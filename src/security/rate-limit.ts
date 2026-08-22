import "server-only";

/**
 * How quickly a caller may try the surfaces abuse actually reaches.
 *
 * In-memory, and that is a decision: this application runs as one Node process
 * on one machine (ADR-0011). Next.js still compiles this module into more than
 * one graph — server actions, route handlers, instrumentation — so the Map
 * lives on `globalThis`, which is the one object every graph in the process
 * actually shares. A second process would be a second set of buckets, which
 * is why this is not a substitute for nginx — it is the line that can speak
 * French, capture a monitoring event, and be proved by the acceptance suite.
 *
 * Issue #1 asks for rate limits on checkout retry, Order Access, staff login,
 * signature failures and token guessing. Each surface has its own budget.
 * Identity-keyed limits (an email, an order) stop a spray against one target;
 * address-keyed limits stop a spray against many. The two are checked together
 * where both apply.
 *
 * Windows are sliding. A burst that fills a bucket keeps it full for the
 * window, and a quiet caller is not punished for traffic that has aged out.
 */

export type RateLimitSurface =
  | "staff-login"
  | "staff-mfa"
  | "order-access-token"
  | "checkout-retry"
  | "webhook-unsigned"
  | "client-observation";

interface Budget {
  /** How many attempts the window will take. */
  max: number;
  /** How long an attempt occupies a slot, in milliseconds. */
  windowMs: number;
}

/**
 * The budgets themselves.
 *
 * Generous enough that a Commerce Operator mistyping a password, a buyer
 * following a garbled link, or the acceptance suite's own refused-login
 * scenarios never trip them — and tight enough that a script walking tokens
 * or stuffing passwords is noticeable within a minute. Changing a number
 * here is a product decision; the security-regression spec spells the same
 * numbers out by hand so a change has to be deliberate there too.
 */
export const RATE_LIMITS: Record<RateLimitSurface, Budget> = {
  "staff-login": { max: 8, windowMs: 15 * 60_000 },
  "staff-mfa": { max: 8, windowMs: 15 * 60_000 },
  "order-access-token": { max: 20, windowMs: 15 * 60_000 },
  "checkout-retry": { max: 6, windowMs: 60 * 60_000 },
  "webhook-unsigned": { max: 12, windowMs: 15 * 60_000 },
  "client-observation": { max: 20, windowMs: 15 * 60_000 },
};

interface Attempt {
  at: number;
}

const processStore = globalThis as typeof globalThis & {
  __wecreateRateLimits?: Map<string, Attempt[]>;
};

function rateLimitBuckets(): Map<string, Attempt[]> {
  processStore.__wecreateRateLimits ??= new Map();
  return processStore.__wecreateRateLimits;
}

function bucketKey(surface: RateLimitSurface, key: string): string {
  return `${surface}:${key}`;
}

function prune(surface: RateLimitSurface, key: string, now: number): Attempt[] {
  const budget = RATE_LIMITS[surface];
  const buckets = rateLimitBuckets();
  const kept = (buckets.get(bucketKey(surface, key)) ?? []).filter(
    (attempt) => now - attempt.at < budget.windowMs,
  );
  buckets.set(bucketKey(surface, key), kept);
  return kept;
}

/**
 * Whether this caller still has a slot, recording the attempt either way.
 *
 * Recording a refused attempt is what keeps the bucket full: a script that
 * is already over the limit does not get a free try the moment one slot
 * would otherwise age out in the middle of its burst.
 */
export function consume(surface: RateLimitSurface, key: string): boolean {
  const now = Date.now();
  const budget = RATE_LIMITS[surface];
  const attempts = prune(surface, key, now);
  const allowed = attempts.length < budget.max;
  attempts.push({ at: now });
  rateLimitBuckets().set(bucketKey(surface, key), attempts);
  return allowed;
}

/**
 * Every named bucket must have a slot, or none of them is consumed as allowed.
 *
 * Staff login is the case this exists for: the email and the address are two
 * budgets, and a spray that rotates emails still fills the address one.
 */
export function consumeAll(
  checks: ReadonlyArray<{ surface: RateLimitSurface; key: string }>,
): boolean {
  const now = Date.now();
  const allowed = checks.every(({ surface, key }) => {
    const budget = RATE_LIMITS[surface];
    return prune(surface, key, now).length < budget.max;
  });

  for (const { surface, key } of checks) {
    const attempts = prune(surface, key, now);
    attempts.push({ at: now });
    rateLimitBuckets().set(bucketKey(surface, key), attempts);
  }

  return allowed;
}

/**
 * Empty every bucket.
 *
 * The acceptance suite is one Node process serving every scenario, and a
 * test that fills a bucket would otherwise fail the next one. Only the test
 * hook calls this, and only when the monitoring provider is the fixture.
 */
export function resetRateLimits(): void {
  rateLimitBuckets().clear();
}
