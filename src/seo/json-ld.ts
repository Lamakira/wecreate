import {
  productAvailability,
  productPath,
  type DigitalProductAvailability,
  type PurchaseContext,
} from "@/managed-content/digital-products";
import type { DigitalProduct, SiteSettings } from "@/managed-content/types";

/**
 * JSON-LD as a crawler reads it.
 *
 * Schema.org graphs, not a vendor format. They are assembled here so a page
 * only has to say which entity it is about, and so a Product offer cannot
 * drift from the availability the Boutique already computed.
 */

const SCHEMA = "https://schema.org";

const AVAILABILITY_URL: Record<DigitalProductAvailability, string> = {
  available: `${SCHEMA}/InStock`,
  forthcoming: `${SCHEMA}/PreOrder`,
  unavailable: `${SCHEMA}/OutOfStock`,
};

/** Escape `<` so a title cannot break out of the JSON-LD script tag. */
export function jsonLdText(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * The E.164 number a `wa.me` address already carries, or nothing.
 *
 * Structured data needs a telephone, not a chat URL. Inventing one would be
 * worse than omitting it, so a destination that is not WhatsApp's own link
 * contributes no number.
 */
export function telephoneFromWhatsAppUrl(url: string): string | undefined {
  const match = url.match(/(?:wa\.me|whatsapp\.com\/send\?phone=)\/?(\d+)/i);
  return match ? `+${match[1]}` : undefined;
}

function postalAddress(locationLabel: string): Record<string, string> {
  const [locality, country] = locationLabel.split(",").map((part) => part.trim());
  return {
    "@type": "PostalAddress",
    addressLocality: locality,
    addressCountry:
      country === "Bénin" || country === "Benin" ? "BJ" : (country ?? "BJ"),
  };
}

/** WeCreate as a local business, from the contact details an editor maintains. */
export function localBusinessJsonLd(
  settings: SiteSettings,
  origin: string,
): Record<string, unknown> {
  const telephone = telephoneFromWhatsAppUrl(settings.contact.whatsappUrl);

  return {
    "@context": SCHEMA,
    "@type": "LocalBusiness",
    name: settings.brandName,
    description: settings.seo.defaultDescription,
    url: origin,
    email: settings.contact.email,
    ...(telephone ? { telephone } : {}),
    address: postalAddress(settings.contact.locationLabel),
    sameAs: settings.socialAccounts.map((account) => account.url),
  };
}

/**
 * One Digital Product as an offer, using the availability the Boutique already
 * decided. Ratings, reviews and a made-up stock count stay absent: they would
 * be claims WeCreate has not made.
 */
export function digitalProductJsonLd(input: {
  product: DigitalProduct;
  purchase: PurchaseContext;
  origin: string;
}): Record<string, unknown> {
  const { product, origin } = input;
  const availability = productAvailability(product, input.purchase);
  const url = new URL(productPath(product.slug), origin).toString();

  return {
    "@context": SCHEMA,
    "@type": "Product",
    name: product.title,
    description: product.summary,
    sku: product.sku,
    url,
    ...(product.cover.imageUrl ? { image: product.cover.imageUrl } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "XOF",
      price: String(product.priceXof),
      availability: AVAILABILITY_URL[availability],
    },
  };
}
