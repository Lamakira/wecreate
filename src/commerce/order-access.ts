import { formatDay } from "@/lib/format";

import type { OrderAccess, OrderAccessGrant } from "./types";

/**
 * The rules Order Access carries with it, wherever it is stored.
 *
 * Pure functions and constants over the records in `types.ts`, as `orders.ts`
 * is for an order: how long a buyer may come back, how many times they may take
 * each file, how long one generated address lasts, and how all three are said
 * in French. The Supabase adapter and the fixture both answer to these rather
 * than each inventing their own, and the pages print them rather than composing
 * their own sentence.
 */

/**
 * How long a buyer may open their purchase for, without an account.
 *
 * Thirty days from the moment the payment was approved (issue #1). It is
 * measured from the approval rather than from the receipt being sent, so a slow
 * mail queue never shortens what somebody paid for.
 */
export const ORDER_ACCESS_DAYS = 30;

/** Successful downloads each purchased Digital Product starts with. */
export const DOWNLOADS_PER_GRANT = 5;

/**
 * How long one generated address for a private file is good for.
 *
 * Fifteen minutes (issue #1). Short because the address is the whole of the
 * authorisation once it exists: anyone holding it can take the file, so it has
 * to stop being useful quickly. A buyer who was too slow simply asks again —
 * and asking again inside this window is the *same* download rather than
 * another one, so a normal delay never costs part of what they paid for.
 */
export const PRIVATE_LINK_SECONDS = 15 * 60;

/**
 * When access for a payment approved at this moment stops working.
 *
 * Anchored to the approval and to nothing else: however long a delivery took to
 * start, a buyer's thirty days are thirty days from the moment their money
 * arrived (issue #1). A deadline computed when the receipt went out would be
 * one WeCreate shortened by being slow.
 */
export function accessExpiryFrom(approvedAt: Date, days: number): string {
  return new Date(
    approvedAt.getTime() + days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/** Whether this access may still be used. */
export function isAccessLive(access: OrderAccess): boolean {
  const expires = Date.parse(access.expiresAt);
  return Number.isFinite(expires) && expires > Date.now();
}

/**
 * How much of the address last handed over for one grant is still good.
 *
 * The rule, in one place, because two systems answer to it — as
 * `paymentEventEffect()` and `commerce.payment_event_effect` do for a Payment
 * State. Postgres enforces it in `commerce.live_link_seconds` and the fixture
 * applies it here: change one and change the other.
 *
 * Zero means there is no live address, and zero is what makes the next one cost
 * a download. Above zero, asking again is the *same* download and the address
 * is signed to die at the same moment it always would have — extending it would
 * mean a buyer who kept pressing never spent a second one.
 */
export function liveLinkSeconds(linkExpiresAt: string | null): number {
  if (!linkExpiresAt) return 0;

  const expires = Date.parse(linkExpiresAt);
  if (!Number.isFinite(expires)) return 0;
  return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
}

/**
 * What is left of one grant, in plain French.
 *
 * “3 téléchargements sur 5 restants”, and the singular WeCreate would write for
 * one or none. Issue #1 asks for the allowance to be shown in exactly these
 * words and for nothing about buckets, tokens or signatures to be shown at all,
 * which is why this sentence names a count and a file and neither of those.
 */
export function allowanceLabel(grant: OrderAccessGrant): string {
  const many = grant.downloadsRemaining > 1;
  return `${grant.downloadsRemaining} téléchargement${many ? "s" : ""} sur ${
    grant.downloadsAllowed
  } restant${many ? "s" : ""}`;
}

/** When the buyer's access runs out, as a date they can plan around. */
export function expiryLabel(access: OrderAccess): string {
  return `Accès valable jusqu'au ${formatDay(access.expiresAt)}`;
}
