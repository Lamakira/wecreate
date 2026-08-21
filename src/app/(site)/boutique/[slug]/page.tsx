import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";

import { readPurchaseContext } from "@/commerce";
import { ProductView } from "@/components/boutique/product-view";
import {
  readBoutique,
  readDigitalProduct,
  readDigitalProductSlugRedirect,
  readEffectiveLegalTerms,
  readSiteSettings,
} from "@/managed-content";
import {
  DIGITAL_PRODUCT_LICENCE_KIND,
  productPath,
} from "@/managed-content/digital-products";
import { digitalProductJsonLd } from "@/seo/json-ld";
import { JsonLdScript } from "@/seo/json-ld-script";
import { pageOpenGraph } from "@/seo/open-graph";
import { keepOutOfSearchResults, siteUrl } from "@/site-config";

/**
 * Not held to the instant-navigation bar, for the reason `/portfolio/[slug]` is
 * not: the header marks the current navigation entry from `usePathname()`, and
 * no shell shared by every product can know which address it is rendered for.
 */
export const instant = false;

/** The route's own params, typed here rather than taken from Next's generated
 *  route types, which do not exist until the first build. */
interface ProductRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await readDigitalProduct(slug);
  if (!product) {
    return {};
  }

  const { isEnabled: isPreview } = await draftMode();

  return {
    title: product.title,
    description: product.summary,
    // The canonical address is the product's current one even when the visitor
    // arrived at a former slug, so a moved product does not compete with itself
    // in search.
    alternates: { canonical: productPath(product.slug) },
    openGraph: await pageOpenGraph({
      title: product.title,
      description: product.summary,
      imageUrl: product.cover.imageUrl,
    }),
    // Two pages that must stay out of search results, and neither is about the
    // route: a preview is one editor's unpublished draft, and an archived
    // product is one WeCreate has withdrawn — its page exists for the orders
    // that reference it, not to be found by someone about to buy. Spread rather
    // than set, so an ordinary product leaves the key absent and inherits the
    // site-wide rule instead of overwriting it.
    ...(isPreview || product.isArchived ? keepOutOfSearchResults() : {}),
  };
}

/**
 * One Digital Product, on a page of its own.
 *
 * Three answers are possible, in this order. The address belongs to a product
 * and it is served — archived included, because an Order Snapshot, an Order
 * Access grant and a receipt all point here and have to keep resolving. The
 * address is one the product used to have, and the request is redirected to
 * where it moved (issue #1). Or neither, and it resolves to the site's not-found
 * page.
 *
 * The redirect below is the fallback rather than the mechanism: `src/proxy.ts`
 * has already answered 308 for a former address, because by the time this runs
 * the response has begun streaming and the status is committed.
 */
export default async function ProductRoute({ params }: ProductRouteProps) {
  const { slug } = await params;
  const product = await readDigitalProduct(slug);

  if (!product) {
    const movedTo = await readDigitalProductSlugRedirect(slug);
    if (movedTo) {
      permanentRedirect(productPath(movedTo));
    }
    notFound();
  }

  const boutique = await readBoutique();
  const settings = await readSiteSettings();
  const purchase = await readPurchaseContext();
  const { inForce } = await readEffectiveLegalTerms();
  const { isEnabled: isPreview } = await draftMode();

  return (
    <>
      <JsonLdScript
        data={digitalProductJsonLd({
          product,
          purchase,
          origin: siteUrl(),
        })}
      />
      <ProductView
        product={product}
        boutique={boutique}
        purchase={purchase}
        contact={settings.contact}
        licence={inForce.find(
          (revision) => revision.kind === DIGITAL_PRODUCT_LICENCE_KIND,
        )}
        showRequirements={isPreview}
      />
    </>
  );
}
