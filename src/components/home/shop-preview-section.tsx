import Link from "next/link";

import { CtaLink } from "@/components/primitives/cta-link";
import { MediaFrame } from "@/components/primitives/media-frame";
import { Reveal } from "@/components/primitives/reveal";
import { SectionEmptyState } from "@/components/primitives/section-empty-state";
import { formatXof } from "@/lib/format";
import { productPath } from "@/managed-content/digital-products";
import type {
  DigitalProduct,
  ShopPreviewContent,
} from "@/managed-content/types";

/** A teaser, not the Boutique. Three, as the design has it. */
const TEASER_LENGTH = 3;

interface ShopPreviewSectionProps {
  section: ShopPreviewContent;
  /** The Digital Products an editor has marked featured. */
  products: DigitalProduct[];
}

/**
 * A teaser for the Boutique.
 *
 * The products are the Boutique's own — the ones an editor marked featured —
 * rather than a second list maintained beside it, exactly as *Travaux récents*
 * is the portfolio's own list. A product is written once and appears in both
 * places, and one an editor archives leaves both at once.
 *
 * Each card links to the product and stops there. It deliberately does not offer
 * "Ajouter au panier": adding to the Digital Cart arrives with issue #9, and no
 * product is purchase-enabled until the Commerce Launch Gate opens, so a buy
 * button here could only be a lie.
 */
export function ShopPreviewSection({
  section,
  products,
}: ShopPreviewSectionProps) {
  const teaser = products.slice(0, TEASER_LENGTH);

  return (
    <section
      aria-labelledby="shop-preview-heading"
      className="wc-container py-section"
    >
      <Reveal className="mb-heading-gap flex flex-wrap items-baseline justify-between gap-6">
        <h2
          id="shop-preview-heading"
          className="m-0 font-display text-section font-medium"
        >
          {section.title}
        </h2>
        <CtaLink cta={section.link} variant="underline" />
      </Reveal>

      {teaser.length === 0 ? (
        <SectionEmptyState
          text={section.emptyStateText}
          testId="shop-preview-empty"
        />
      ) : (
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[clamp(14px,2vw,24px)] p-0">
          {teaser.map((product) => (
            <Reveal
              as="li"
              key={product.id}
              className="flex h-full flex-col border border-wc-line-dark bg-wc-surface transition-colors duration-[400ms] hover:border-wc-muted"
            >
              <MediaFrame
                media={product.cover}
                sizes="(max-width: 640px) 100vw, 33vw"
              />
              <div className="flex flex-1 flex-col gap-3 p-[22px]">
                <span className="self-start bg-wc-white px-2 py-1 text-badge tracking-22 uppercase text-wc-pure">
                  {product.format}
                </span>
                <h3 className="m-0 font-display text-product-title font-medium">
                  {product.title}
                </h3>
                <p className="m-0 flex-1 text-body-sm font-light text-wc-soft">
                  {product.summary}
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-wc-line-dark pt-3.5">
                  <span className="text-body font-semibold">
                    {formatXof(product.priceXof)}
                  </span>
                  <Link
                    href={productPath(product.slug)}
                    className="border-b border-wc-muted pb-1 text-micro tracking-20 uppercase transition-colors duration-300 hover:border-wc-white"
                  >
                    <span className="sr-only">{product.title} - </span>
                    {section.linkLabel}
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      )}
    </section>
  );
}
