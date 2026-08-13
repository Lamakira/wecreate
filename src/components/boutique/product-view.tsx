import Link from "next/link";

import { AvailabilityBadge } from "@/components/boutique/availability-badge";
import { PurchaseNotice } from "@/components/boutique/purchase-notice";
import { MediaFrame } from "@/components/primitives/media-frame";
import { formatEffectiveDate, formatXof } from "@/lib/format";
import { prefilledMessage, whatsAppMessageUrl } from "@/lib/whatsapp";
import {
  DIGITAL_PRODUCT_FAMILY_LABELS,
  productAvailability,
  type PurchaseContext,
} from "@/managed-content/digital-products";
import type { EffectiveLegalRevision } from "@/managed-content/legal";
import type {
  BoutiqueContent,
  ContactDetails,
  DigitalProduct,
} from "@/managed-content/types";

interface ProductViewProps {
  product: DigitalProduct;
  boutique: BoutiqueContent;
  purchase: PurchaseContext;
  /**
   * WeCreate's channels, for the one question a buyer may still have. The whole
   * object, as every other component that offers a way to reach WeCreate takes
   * it: an editor changes a number once and the site follows.
   */
  contact: ContactDetails;
  /** The licence in force, or `undefined` while none has taken effect. */
  licence: EffectiveLegalRevision | undefined;
  /** Preview only: what this product still needs before it may be sold. */
  showRequirements?: boolean;
}

/**
 * One Digital Product, on the page a shared link, a crawler and a buyer
 * deciding all arrive at.
 *
 * It answers, in this order, the four questions issue #1 says a shopper needs
 * before they can decide: what it is, what is in it, what it costs and whether
 * they can have it, and what they are allowed to do with it. Then who to ask.
 *
 * Two of those answers can be honestly empty, and are left out rather than
 * faked. WeCreate has not stated what is inside each product, so the inclusions
 * block is absent until it does — an invented page count is a promise to
 * somebody who paid for it. And the licence link appears only once a licence has
 * taken effect, because a product cannot be sold under terms that do not exist.
 */
export function ProductView({
  product,
  boutique,
  purchase,
  contact,
  licence,
  showRequirements,
}: ProductViewProps) {
  const availability = productAvailability(product, purchase);
  const question = prefilledMessage(
    boutique.support.whatsappMessageTemplate,
    product.title,
  );

  return (
    <div data-surface="light" className="bg-wc-white text-wc-pure">
      <section className="wc-container pt-[clamp(28px,5vw,64px)] pb-section-sm">
        <Link
          href="/boutique"
          className="mb-heading-gap inline-block text-micro tracking-24 uppercase text-wc-muted-on-light transition-colors duration-300 hover:text-wc-pure"
        >
          ← {boutique.backLabel}
        </Link>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(28px,4vw,72px)]">
          <div className="relative">
            <MediaFrame
              media={product.cover}
              surface="light"
              sizes="(max-width: 900px) 100vw, 50vw"
            />
            <span className="absolute top-4 left-4 bg-wc-pure px-2.5 py-1.5 text-badge tracking-20 uppercase text-wc-white">
              {product.format}
            </span>
          </div>

          <div>
            {product.family ? (
              <p className="m-0 mb-4 text-micro tracking-28 uppercase text-wc-muted-on-light">
                {DIGITAL_PRODUCT_FAMILY_LABELS[product.family]}
              </p>
            ) : null}
            <h1 className="m-0 mb-5 font-display text-[clamp(32px,4.6vw,62px)] leading-[1.04] font-medium">
              {product.title}
            </h1>
            <p className="m-0 text-body-lg font-light text-wc-ink">
              {product.summary}
            </p>
            {product.description ? (
              <p
                data-testid="product-description"
                className="m-0 mt-5 text-body-lg font-light text-wc-ink"
              >
                {product.description}
              </p>
            ) : null}

            {product.inclusions.length > 0 ? (
              <section
                data-testid="product-inclusions"
                aria-labelledby="product-inclusions-heading"
                className="mt-8 border-t border-wc-line-light pt-6"
              >
                <h2
                  id="product-inclusions-heading"
                  className="m-0 mb-3.5 text-micro tracking-26 uppercase text-wc-muted-on-light"
                >
                  {boutique.inclusionsKicker}
                </h2>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {product.inclusions.map((inclusion) => (
                    <li
                      key={inclusion}
                      className="flex gap-3 text-body font-light text-wc-ink"
                    >
                      <span aria-hidden="true" className="text-wc-pure">
                        —
                      </span>
                      {inclusion}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-wc-line-light pt-6">
              <span
                data-testid="product-price"
                className="font-display text-[34px] leading-none"
              >
                {formatXof(product.priceXof)}
              </span>
              <AvailabilityBadge availability={availability} />
            </div>

            {product.isArchived ? (
              <p
                data-testid="product-archived-notice"
                className="m-0 mt-5 border border-wc-muted-on-light p-5 text-body-sm font-light text-wc-ink"
              >
                <strong className="font-semibold text-wc-pure">
                  Retiré de la vente.
                </strong>{" "}
                Ce produit n&apos;est plus proposé à l&apos;achat. Cette page
                reste en ligne pour les commandes passées&nbsp;: si vous
                l&apos;avez acheté, votre accès et vos téléchargements ne
                changent pas.
              </p>
            ) : null}

            {showRequirements ? (
              <div className="mt-5">
                <PurchaseNotice product={product} purchase={purchase} />
              </div>
            ) : null}

            <section
              aria-labelledby="product-licence-heading"
              className="mt-8 border-t border-wc-line-light pt-6"
            >
              <h2
                id="product-licence-heading"
                className="m-0 mb-3.5 text-micro tracking-26 uppercase text-wc-muted-on-light"
              >
                {boutique.licence.kicker}
              </h2>
              <p
                data-testid="product-licence"
                className="m-0 text-body font-light text-wc-ink"
              >
                {boutique.licence.note}
              </p>
              {licence ? (
                <p className="m-0 mt-3.5 text-body-sm font-light text-wc-ink">
                  <Link
                    href={licence.path}
                    className="border-b border-wc-muted-on-light pb-1 transition-colors duration-300 hover:border-wc-pure"
                  >
                    {boutique.licence.linkLabel}
                    <span className="sr-only"> — {licence.title}</span>
                  </Link>{" "}
                  <span className="text-wc-muted-on-light">
                    · en vigueur depuis le{" "}
                    {formatEffectiveDate(licence.effectiveFrom)}
                  </span>
                </p>
              ) : null}
            </section>

            <section
              aria-labelledby="product-support-heading"
              className="mt-8 border-t border-wc-line-light pt-6"
            >
              <h2
                id="product-support-heading"
                className="m-0 mb-3.5 text-micro tracking-26 uppercase text-wc-muted-on-light"
              >
                {boutique.support.kicker}
              </h2>
              <p
                data-testid="product-support"
                className="m-0 mb-4 text-body font-light text-wc-ink"
              >
                {boutique.support.note}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-micro tracking-20 uppercase">
                <a
                  href={whatsAppMessageUrl(contact.whatsappUrl, question)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-b border-wc-muted-on-light pb-1 transition-colors duration-300 hover:border-wc-pure"
                >
                  {boutique.support.whatsappLabel}
                  <span className="sr-only"> — nouvel onglet</span>
                </a>
                <a
                  href={`mailto:${contact.email}?subject=${encodeURIComponent(product.title)}`}
                  className="border-b border-wc-muted-on-light pb-1 transition-colors duration-300 hover:border-wc-pure"
                >
                  {boutique.support.emailLabel}
                </a>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
