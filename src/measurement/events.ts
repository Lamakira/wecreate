/**
 * Anonymous events this application is willing to record.
 *
 * Names and properties are the whole public interface. Nothing here may carry
 * a visitor's name, email, telephone, an Order Access token, a WhatsApp
 * address (those embed a phone number), a playback identifier, or a cart's
 * contents. A Service Enquiry is a destination category, not a conversation.
 */

export type ServiceEnquiryDestination = "whatsapp" | "discovery_call";

export type MeasurementEvent =
  | { name: "service_enquiry"; destination: ServiceEnquiryDestination }
  | { name: "product_added"; product: string }
  | { name: "checkout_started" };

/** The properties Cloudflare Zaraz may be given for one event. Never PII. */
export function publicProperties(
  event: MeasurementEvent,
): Record<string, string> {
  switch (event.name) {
    case "service_enquiry":
      return { destination: event.destination };
    case "product_added":
      return { product: event.product };
    case "checkout_started":
      return {};
  }
}
