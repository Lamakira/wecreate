import type { BuyerContact } from "@/commerce/types";
import type { EffectiveLegalRevision } from "@/managed-content/legal";

/**
 * What a guest checkout may ask for, and what it refuses.
 *
 * Pure functions over what arrived, like `digital-products.ts` and `cart.ts` —
 * no request, no cookie, no provider — so the same rules answer wherever they
 * are applied. They are applied on the server, always: the form carries no
 * validation of its own at all, so every refusal a buyer sees is this file's,
 * and a submission that skipped the form entirely is held to exactly the same
 * rules (issue #1).
 *
 * The list of fields is the whole point. Issue #1 allows a full name, an email,
 * an international telephone and an optional company, and nothing else — no
 * postal address unless a verified provider or fiscal requirement makes one
 * mandatory, and no account. There is deliberately no marketing consent to
 * collect: a purchase never implies one, so the question is not asked rather
 * than asked and defaulted to off.
 */

/** The parts of the form a refusal can be about. */
export type GuestField = "fullName" | "email" | "telephone" | "company" | "legal";

export type GuestRefusal =
  | "fullNameMissing"
  | "fullNameTooLong"
  | "emailMalformed"
  | "telephoneMalformed"
  | "companyTooLong"
  | "legalNotAccepted";

/**
 * What the buyer is told, in French, and what to do about it.
 *
 * Beside the rule that produces it, as every other refusal in this application
 * is: a new way to be refused arrives with its own sentence rather than leaving
 * a form saying nothing.
 */
export const GUEST_REFUSAL_LABELS: Record<GuestRefusal, string> = {
  fullNameMissing: "Indiquez votre nom complet.",
  fullNameTooLong: "Ce nom est trop long : 120 caractères au maximum.",
  emailMalformed: "Indiquez une adresse email valide.",
  telephoneMalformed:
    "Indiquez un téléphone au format international, par exemple +229 01 97 00 00 00.",
  companyTooLong:
    "Ce nom d'entreprise est trop long : 120 caractères au maximum.",
  legalNotAccepted: "Acceptez les conditions indiquées pour continuer.",
};

/** Which field each refusal belongs beside. */
export const GUEST_REFUSAL_FIELDS: Record<GuestRefusal, GuestField> = {
  fullNameMissing: "fullName",
  fullNameTooLong: "fullName",
  emailMalformed: "email",
  telephoneMalformed: "telephone",
  companyTooLong: "company",
  legalNotAccepted: "legal",
};

/** Long enough for any real name, short enough to be a bound. */
const MAX_NAME_LENGTH = 120;
/** The longest address RFC 5321 allows. */
const MAX_EMAIL_LENGTH = 254;

/**
 * One `@`, something either side of it, a dot in the domain, and no spaces.
 *
 * Deliberately not an attempt at RFC 5322: the addresses that pattern accepts
 * and this one does not are addresses nobody has, and the only real proof an
 * email works is sending to it — which is what the receipt does, and why a
 * delivery that could not be sent is a Fulfillment State a buyer is shown.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * `+` and then eight to fifteen digits, which is what E.164 allows.
 *
 * International form is required rather than preferred: the number is what a
 * Mobile Money payment is collected against, and a national number is ambiguous
 * the moment it leaves the country it was written in.
 */
const TELEPHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

/** What the form sent, before any of it is believed. */
export interface GuestFormValues {
  fullName: string;
  email: string;
  telephone: string;
  company: string;
}

export const EMPTY_GUEST_FORM: GuestFormValues = {
  fullName: "",
  email: "",
  telephone: "",
  company: "",
};

export interface GuestSubmission {
  /** The buyer contact snapshot, tidied. Only meaningful when nothing is refused. */
  details: BuyerContact;
  /** At most one refusal per field, so a form can print each beside its input. */
  refusals: Partial<Record<GuestField, GuestRefusal>>;
}

/** Spaces of every kind, and the punctuation people write telephone numbers with. */
function normaliseTelephone(value: string): string {
  return value.replace(/[\s.\-()/  ]/g, "");
}

/** One run of whitespace between words, and none at either end. */
function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Read a guest's details, and say what is wrong with them.
 *
 * `mustAccept` is what `readEffectiveLegalTerms()` says a buyer has to accept
 * today, and `acceptedRevisionIds` is what they ticked. Comparing revision
 * identities rather than counting boxes is what makes this safe against terms
 * that changed while the form was open: a revision published between the page
 * being drawn and the button being pressed is not one this buyer agreed to, and
 * they are asked again.
 */
export function readGuestDetails(
  values: GuestFormValues,
  mustAccept: readonly EffectiveLegalRevision[],
  acceptedRevisionIds: readonly string[],
): GuestSubmission {
  const refusals: Partial<Record<GuestField, GuestRefusal>> = {};
  const refuse = (refusal: GuestRefusal) => {
    const field = GUEST_REFUSAL_FIELDS[refusal];
    refusals[field] ??= refusal;
  };

  const fullName = normaliseName(values.fullName);
  if (fullName.length === 0) refuse("fullNameMissing");
  else if (fullName.length > MAX_NAME_LENGTH) refuse("fullNameTooLong");

  const email = values.email.trim();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    refuse("emailMalformed");
  }

  const telephone = normaliseTelephone(values.telephone);
  if (!TELEPHONE_PATTERN.test(telephone)) refuse("telephoneMalformed");

  const company = normaliseName(values.company);
  if (company.length > MAX_NAME_LENGTH) refuse("companyTooLong");

  const accepted = new Set(acceptedRevisionIds);
  if (!mustAccept.every((revision) => accepted.has(revision.revisionId))) {
    refuse("legalNotAccepted");
  }

  return {
    details: {
      fullName,
      email,
      telephone,
      // Absent rather than empty: an optional field nobody filled in is not a
      // company called "".
      company: company.length > 0 ? company : null,
    },
    refusals,
  };
}

export function isAccepted(submission: GuestSubmission): boolean {
  return Object.keys(submission.refusals).length === 0;
}
