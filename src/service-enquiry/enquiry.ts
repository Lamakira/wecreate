/**
 * A Service Enquiry: a visitor's move from a service offer into a conversation
 * with WeCreate.
 *
 * It creates nothing. No order, no reservation, no availability hold, no
 * payment (ADR-0006) — which is why this module builds addresses and no state.
 * Both destinations are outside WeCreate's origin and both are ordinary links,
 * so they work with scripting disabled and cannot be slowed down by a third
 * party's widget.
 */

import type {
  ContactDetails,
  ServiceEnquiryContent,
} from "@/managed-content/types";

/**
 * Everything a service offer needs to become a Service Enquiry: where the two
 * conversations go, what their buttons say, and how to write a price that is
 * quoted rather than published.
 *
 * One value rather than three, because these travel together through every
 * component on the Services page and none of them means anything alone.
 */
export interface ServiceEnquiryContext {
  enquiry: ServiceEnquiryContent;
  contact: ContactDetails;
  /** Shown in place of a price for a pack quoted on request. */
  onRequestLabel: string;
}

/**
 * The offer a Service Enquiry is about, written the way it should arrive in
 * WeCreate's inbox: the pack, then the universe it belongs to.
 */
export function serviceOfferLabel(packName: string, universe: string): string {
  return `${packName} — ${universe}`;
}

/**
 * The message that opens the conversation, from the editor's template.
 *
 * `%s` is the offer, matching the `%s` convention Managed Content already uses
 * for SEO title templates. A template that has lost its placeholder still sends
 * the offer rather than silently dropping it: a visitor who presses a pack's
 * button must never land in an empty chat.
 */
export function serviceEnquiryMessage(template: string, offer: string): string {
  return template.includes("%s")
    ? template.replaceAll("%s", offer)
    : `${template} ${offer}`.trim();
}

/**
 * A WhatsApp address carrying a prefilled message.
 *
 * Percent-encoded rather than built through `URLSearchParams`, which encodes a
 * space as `+`. WhatsApp's own links use `%20`, and a message full of plus
 * signs is what a visitor would otherwise have to delete before writing.
 */
export function whatsAppEnquiryUrl(
  whatsappUrl: string,
  message: string,
): string {
  const separator = whatsappUrl.includes("?") ? "&" : "?";
  return `${whatsappUrl}${separator}text=${encodeURIComponent(message)}`;
}
