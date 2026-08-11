import Link from "next/link";

import { CtaLink } from "@/components/primitives/cta-link";
import { MediaFrame } from "@/components/primitives/media-frame";
import { Reveal } from "@/components/primitives/reveal";
import { SectionEmptyState } from "@/components/primitives/section-empty-state";
import { formatXof } from "@/lib/format";
import type { ShopPreviewContent } from "@/managed-content/types";

interface ShopPreviewSectionProps {
  section: ShopPreviewContent;
}

/**
 * A teaser for the Boutique.
 *
 * Each card links to the product and stops there. It deliberately does not
 * offer "Ajouter au panier": adding to the Digital Cart arrives with issue #9,
 * and no product is purchase-enabled until the Commerce Launch Gate opens, so a
 * buy button here could only be a lie.
 */
export function ShopPreviewSection({ section }: ShopPreviewSectionProps) {
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

      {section.products.length === 0 ? (
        <SectionEmptyState
          text={section.emptyStateText}
          testId="shop-preview-empty"
        />
      ) : (
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[clamp(14px,2vw,24px)] p-0">
          {section.products.map((product) => (
            <Reveal
              as="li"
              key={product.id}
              className="flex h-full flex-col border border-wc-line-dark bg-wc-surface transition-colors duration-[400ms] hover:border-wc-muted"
            >
              <MediaFrame
                media={product.media}
                sizes="(max-width: 640px) 100vw, 33vw"
              />
              <div className="flex flex-1 flex-col gap-3 p-[22px]">
                <span className="self-start bg-wc-white px-2 py-1 text-badge tracking-22 uppercase text-wc-pure">
                  {product.badge}
                </span>
                <h3 className="m-0 font-display text-product-title font-medium">
                  {product.title}
                </h3>
                <p className="m-0 flex-1 text-body-sm font-light text-wc-soft">
                  {product.description}
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-wc-line-dark pt-3.5">
                  <span className="text-body font-semibold">
                    {formatXof(product.priceXof)}
                  </span>
                  <Link
                    href={product.href}
                    className="border-b border-wc-muted pb-1 text-micro tracking-20 uppercase transition-colors duration-300 hover:border-wc-white"
                  >
                    <span className="sr-only">{product.title} — </span>
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
