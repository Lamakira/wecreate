/**
 * Opening a WhatsApp conversation with something already written in it.
 *
 * Two places do this and they are deliberately not the same thing: a service
 * pack starts a Service Enquiry (ADR-0006), while a Digital Product's *Une
 * question ?* is support about a product a visitor may already own. What they
 * share is the mechanics — a template an editor writes, and an address — so the
 * mechanics live here and neither borrows the other's vocabulary.
 */

/**
 * A message built from an editor's template, where `%s` is the subject.
 *
 * `%s` matches the convention Managed Content already uses for SEO title
 * templates. A template that has lost its placeholder still carries the subject
 * rather than silently dropping it: a visitor who presses a button must never
 * land in an empty chat.
 */
export function prefilledMessage(template: string, subject: string): string {
  return template.includes("%s")
    ? template.replaceAll("%s", subject)
    : `${template} ${subject}`.trim();
}

/**
 * A WhatsApp address carrying a prefilled message.
 *
 * Percent-encoded rather than built through `URLSearchParams`, which encodes a
 * space as `+`. WhatsApp's own links use `%20`, and a message full of plus signs
 * is what a visitor would otherwise have to delete before writing.
 */
export function whatsAppMessageUrl(
  whatsappUrl: string,
  message: string,
): string {
  const separator = whatsappUrl.includes("?") ? "&" : "?";
  return `${whatsappUrl}${separator}text=${encodeURIComponent(message)}`;
}
