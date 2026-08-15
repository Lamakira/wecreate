import type { BuyerContact, ContactCorrection } from "./types";

/**
 * What a buyer's contact details are, and what may be done with them.
 *
 * Pure functions over `BuyerContact`, like `orders.ts` is over an order: what
 * shape an address and a telephone have, how each is written down where it may
 * not be written in full, and which of the two a delivery actually uses once a
 * Commerce Operator has corrected one.
 *
 * They live here rather than in the checkout that first collects them because
 * the same rules answer in two places that must not disagree — the guest form,
 * and the Contact Correction a Commerce Operator records months later. A
 * correction that accepted an address the checkout would have refused would put
 * a value in the delivery path that no other part of this application believes
 * in.
 */

/** The longest address RFC 5321 allows. */
export const MAX_EMAIL_LENGTH = 254;

/**
 * One `@`, something either side of it, a dot in the domain, and no spaces.
 *
 * Deliberately not an attempt at RFC 5322: the addresses that pattern accepts
 * and this one does not are addresses nobody has, and the only real proof an
 * email works is sending to it — which is what the receipt does, and why a
 * delivery that could not be sent is a Fulfillment State a buyer is shown.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * `+` and then eight to fifteen digits, which is what E.164 allows.
 *
 * International form is required rather than preferred: the number is what a
 * Mobile Money payment is collected against, and a national number is ambiguous
 * the moment it leaves the country it was written in.
 */
export const TELEPHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Spaces of every kind, and the punctuation people write telephone numbers
 * with.
 *
 * `\s` here is JavaScript's, which is every Unicode space — including the
 * non-breaking ones a number pasted out of a formatted page arrives with.
 * `commerce.tidy_telephone` spells that set out by hand, because Postgres's own
 * `\s` is the ASCII five and would refuse a number this accepts: change one and
 * change the other.
 */
export function normaliseTelephone(value: string): string {
  return value.replace(/[\s.\-()/]/g, "");
}

/** One run of whitespace between words, and none at either end. */
export function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isWellFormedEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

export function isWellFormedTelephone(value: string): boolean {
  return TELEPHONE_PATTERN.test(value);
}

/**
 * The delivery address, masked: `a***@exemple.com`.
 *
 * Enough for the buyer to recognise their own, and not enough for anyone
 * holding a reference to learn one.
 *
 * Postgres masks it in `commerce.mask_email`, because the whole point is that
 * the unmasked address never leaves the database. This is the fixture's half of
 * the same rule, and the two are written to agree: change one and change the
 * other.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) {
    // Not an address this application would have accepted. Nothing of it is
    // shown rather than guessing which half was the local part.
    return "***";
  }
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/**
 * A telephone, masked to what identifies it without reprinting it: `+229•••80`.
 *
 * It exists for one reader and one place — a Commerce Audit Entry recording
 * that somebody corrected a number. An operator reading the trail needs to see
 * *that* the number changed and to recognise which one they are looking at; a
 * full number in an append-only record that may never be deleted is a copy of
 * somebody's contact details that outlives every other copy of it, which is the
 * thing this application refuses to keep (issue #1). `commerce.mask_telephone`
 * is its twin — change one and change the other.
 */
export function maskTelephone(telephone: string): string {
  const digits = normaliseTelephone(telephone);
  if (digits.length < 6) return "***";
  return `${digits.slice(0, 4)}•••${digits.slice(-2)}`;
}

/**
 * Where a receipt goes now.
 *
 * The Order Snapshot keeps the address the buyer typed, whatever anyone
 * discovers about it afterwards; a Contact Correction is a separate fact
 * recorded beside it, and this is the one function that decides which of the
 * two a delivery uses. Postgres reads it as
 * `coalesce(o.corrected_email, o.buyer_email)` — change one and change the
 * other.
 */
export function deliveryAddress(
  buyer: BuyerContact,
  correction: ContactCorrection | null,
): string {
  return correction?.email ?? buyer.email;
}

/** The same, for the number a Mobile Money payment would be collected against. */
export function deliveryTelephone(
  buyer: BuyerContact,
  correction: ContactCorrection | null,
): string {
  return correction?.telephone ?? buyer.telephone;
}
