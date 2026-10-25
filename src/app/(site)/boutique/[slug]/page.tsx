import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { permanentRedirect } from "next/navigation";

import { readPurchaseContextFrom } from "@/commerce";
import { ProductView } from "@/components/boutique/product-view";
import { NotFoundContent } from "@/components/shell/not-found-content";
import { SitePage } from "@/components/shell/site-page";
import {
  gateBoutique,
  readBoutiquePage,
  readLegalDay,
} from "@/managed-content";
import { findAtSlug, findSlugRedirect } from "@/managed-content/addresses";
import {
  DIGITAL_PRODUCT_LICENCE_KIND,
  productPath,
} from "@/managed-content/digital-products";
import { effectiveLegalTerms } from "@/managed-content/legal";
import { digitalProductJsonLd } from "@/seo/json-ld";
import { JsonLdScript } from "@/seo/json-ld-script";
import { pageMetadata } from "@/seo/page-metadata";
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
  const content = await readBoutiquePage();
  const product = findAtSlug(content.boutique.products, slug);
  if (!product) {
    // The route renders the not-found body itself (see below), so the noindex
    // that `notFound()` would have added has to be said here.
    return {
      ...pageMetadata(content.settings.seo, { title: "Page introuvable" }),
      ...keepOutOfSearchResults(),
    };
  }

  const { isEnabled: isPreview } = await draftMode();

  return {
    ...pageMetadata(content.settings.seo, {
      title: product.title,
      description: product.summary,
      imageUrl: product.cover.imageUrl,
    }),
    // The canonical address is the product's current one even when the visitor
    // arrived at a former slug, so a moved product does not compete with itself
    // in search.
    alternates: { canonical: productPath(product.slug) },
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
 * where it moved (issue #1). Or neither, and the not-found body is rendered
 * inside this route's own `SitePage`, built from the content already read,
 * rather than through `notFound()`: that would hand over to the 404 page, which
 * reads the site again — a second provider round trip for the one answer that
 * has nothing to show. The answer is 200 with `noindex`, which
 * `generateMetadata` adds itself, because the status is already committed by
 * the time the slug is known.
 *
 * The redirect below is the fallback rather than the mechanism: `src/proxy.ts`
 * has already answered 308 for a former address, because by the time this runs
 * the response has begun streaming and the status is committed.
 */
export default async function ProductRoute({ params }: ProductRouteProps) {
  const { slug } = await params;
  const content = await readBoutiquePage();
  const product = findAtSlug(content.boutique.products, slug);

  if (!product) {
    const movedTo = findSlugRedirect(content.boutique.products, slug);
    if (movedTo) {
      permanentRedirect(productPath(movedTo));
    }

    return (
      <SitePage
        settings={content.settings}
        legalDocuments={content.legalDocuments}
      >
        <NotFoundContent />
      </SitePage>
    );
  }

  const { isEnabled: isPreview } = await draftMode();
  // The product above is looked up in the ungated list, so an archived one
  // still answers at its own address; only the listing passed on is gated.
  const boutique = gateBoutique(content.boutique, isPreview);
  const purchase = await readPurchaseContextFrom(content.legalDocuments);
  const { inForce } = effectiveLegalTerms(
    content.legalDocuments,
    await readLegalDay(),
  );

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
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
        contact={content.settings.contact}
        licence={inForce.find(
          (revision) => revision.kind === DIGITAL_PRODUCT_LICENCE_KIND,
        )}
        showRequirements={isPreview}
      />
    </SitePage>
  );
}
