/**
 * The words a WeCreate team member sends with a client's questionnaire link
 * (issue #63), and the two addresses that open the client's own apps with those
 * words already written.
 *
 * Pure on purpose, with no `server-only`: the link maker is a client component
 * and builds these as the staff member types the client's number or address,
 * which therefore never reach the server. The message itself is composed on the
 * server (it carries the link and its expiry) and handed back to be shown.
 */

/** Characters kept per field of an invitation; the form refuses more. */
export const INVITATION_FIELD_MAX = 120;

/**
 * The Branding packs WeCreate sells, as the v2 handoff names them.
 *
 * Pending WeCreate's brochures (issue #55, decision 6). Suggestions only: the
 * field accepts any text, because the pack on the invitation is whatever was
 * agreed with the client.
 */
export const BRANDING_PACK_SUGGESTIONS = [
  "Identité Essentielle",
  "Identité Complète",
  "Identité Signature",
  "Sur mesure",
] as const;

/** The subject of the email a client receives with their link. */
export const INVITATION_EMAIL_SUBJECT =
  "WeCreate · Votre questionnaire de marque";

export interface InvitationMessageParts {
  client: string;
  /** Left out of the sentence when empty. */
  brand: string;
  pack: string;
  link: string;
  /** The expiry as a French date, already formatted. */
  expiresOn: string;
}

/** The message a client receives, the same on WhatsApp and by email. */
export function composeInvitationMessage({
  client,
  brand,
  pack,
  link,
  expiresOn,
}: InvitationMessageParts): string {
  return `Bonjour ${client},\n\nMerci pour votre confiance. Pour démarrer votre ${pack}${brand ? ` pour ${brand}` : ""}, remplissez notre questionnaire de marque (environ 10 minutes) :\n\n${link}\n\nCe lien vous est personnel et reste valable jusqu'au ${expiresOn}. Le délai de réalisation démarre à réception de vos réponses.\n\nL'équipe WeCreate`;
}

/** Benin's country code, assumed for a number written without one. */
const BENIN_DIALLING_CODE = "229";

/**
 * A number as WhatsApp's `wa.me` wants it: international, digits only.
 *
 * A number that starts with `+` or `00` is already international; anything
 * else is taken to be Beninese, because that is where WeCreate's clients are.
 */
function internationalDigits(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replaceAll(/\D/g, "");
  if (digits.length === 0) return "";
  if (trimmed.startsWith("+")) return digits;
  if (trimmed.startsWith("00")) return digits.slice(2);
  return `${BENIN_DIALLING_CODE}${digits}`;
}

/**
 * Where WhatsApp opens with the message written. Without a usable number it
 * opens on the contact picker, and the staff member chooses the client.
 */
export function whatsappHref(message: string, phone: string): string {
  const digits = internationalDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * A `mailto:` that opens the staff member's own mail client with the message
 * written. Spaces are `%20` rather than `+`, which mail clients print literally.
 */
export function mailtoHref(message: string, email: string): string {
  return `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(INVITATION_EMAIL_SUBJECT)}&body=${encodeURIComponent(message)}`;
}
