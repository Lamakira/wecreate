"use client";

import Link from "next/link";
import { useState } from "react";

import { AddToCartButton } from "@/components/boutique/add-to-cart-button";
import { AvailabilityBadge } from "@/components/boutique/availability-badge";
import { PurchaseNotice } from "@/components/boutique/purchase-notice";
import { MediaFrame } from "@/components/primitives/media-frame";
import { Reveal } from "@/components/primitives/reveal";
import { SectionEmptyState } from "@/components/primitives/section-empty-state";
import { SplitHeading } from "@/components/primitives/split-heading";
import { formatXof } from "@/lib/format";
import {
  DIGITAL_PRODUCT_FAMILY_LABELS,
  productAvailability,
  productPath,
  type PurchaseContext,
} from "@/managed-content/digital-products";
import {
  DIGITAL_PRODUCT_FAMILIES,
  type BoutiqueContent,
  type DigitalProduct,
  type DigitalProductFamily,
} from "@/managed-content/types";

interface BoutiqueCatalogueProps {
  boutique: BoutiqueContent;
  purchase: PurchaseContext;
  /** Preview only: show what each product still needs before it may be sold. */
  showRequirements?: boolean;
}

type Filter = DigitalProductFamily | null;

/** `0 produit`, `1 produit`, `2 produits` — French takes the singular at zero. */
function productCount(count: number): string {
  return `${count} produit${count > 1 ? "s" : ""}`;
}

/**
 * The Boutique: its family filters and its Digital Products.
 *
 * The page runs on the light band, which is the design handoff's own choice for
 * it — the one place the site inverts, so a catalogue reads as a catalogue
 * rather than as another editorial section.
 *
 * Filtering happens here rather than on the server, for the reason the portfolio
 * filters here: the whole list is already on the page, so narrowing it is
 * instant and costs a visitor on a Benin mobile connection nothing. Every
 * product stays in the document whatever the filter, so a crawler and a visitor
 * without JavaScript reach all six product pages from this one.
 *
 * The handoff opens on a family tab with the other families hidden. A *Tous*
 * chip is offered first instead: with the *Packs Services* tab removed (issue
 * #1) two families remain, and defaulting to one of them would hide half a
 * catalogue this small — and hide it from the crawler too, which is the part
 * that cannot be clicked past.
 */
export function BoutiqueCatalogue({
  boutique,
  purchase,
  showRequirements,
}: BoutiqueCatalogueProps) {
  const { products, kicker, allFamiliesLabel, emptyStateText } = boutique;
  const [filter, setFilter] = useState<Filter>(null);

  const visible = filter
    ? products.filter((product) => product.family === filter)
    : products;
  const families = DIGITAL_PRODUCT_FAMILIES.filter((family) =>
    products.some((product) => product.family === family),
  );

  return (
    <div data-surface="light" className="bg-wc-white text-wc-pure">
      <section className="wc-container pt-[clamp(28px,5vw,64px)]">
        <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-muted-on-light">
          {kicker}
        </p>
        <SplitHeading
          as="h1"
          headline={boutique.headline}
          className="m-0 max-w-[22ch] font-display text-page-title font-medium"
        />
        <p className="mt-[26px] max-w-[52ch] text-body-lg font-light text-wc-ink">
          {boutique.intro}
        </p>

        {families.length > 0 ? (
          <div
            role="group"
            aria-label="Filtrer par famille de produits"
            className="mt-[clamp(30px,4vw,48px)] flex flex-wrap gap-2.5 border-t border-wc-line-light pt-[26px]"
          >
            <FilterPill
              label={allFamiliesLabel}
              isActive={filter === null}
              onSelect={() => setFilter(null)}
            />
            {families.map((family) => (
              <FilterPill
                key={family}
                label={DIGITAL_PRODUCT_FAMILY_LABELS[family]}
                isActive={filter === family}
                onSelect={() => setFilter(family)}
              />
            ))}
          </div>
        ) : null}

        {/* The filter is instant and silent on screen — the design prints no
            result count in the Boutique — so the change is announced instead of
            being left for a screen-reader user to discover by exploring. */}
        <p role="status" data-testid="boutique-count" className="sr-only">
          {productCount(visible.length)}
        </p>
      </section>

      <section className="wc-container pt-[clamp(24px,4vw,48px)] pb-section">
        {visible.length === 0 ? (
          <SectionEmptyState text={emptyStateText} testId="boutique-empty" />
        ) : (
          <ul
            data-testid="boutique-grid"
            className="grid list-none grid-cols-[repeat(auto-fit,minmax(270px,1fr))] items-start gap-[clamp(16px,2vw,28px)] p-0"
          >
            {visible.map((product) => (
              <Reveal as="li" key={product.id} className="h-full">
                <ProductCard
                  product={product}
                  boutique={boutique}
                  purchase={purchase}
                  showRequirements={showRequirements}
                />
              </Reveal>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface ProductCardProps {
  product: DigitalProduct;
  boutique: BoutiqueContent;
  purchase: PurchaseContext;
  showRequirements?: boolean;
}

/**
 * One product in the grid.
 *
 * The cover, the title, the summary and the way in are a single link, so the
 * card is one stop for a keyboard and one target for a thumb. What sits outside
 * it is the price and whether the product can be bought — facts about the
 * product rather than a second way to open it.
 *
 * *Ajouter au panier* is the design handoff's own control, and it appears only
 * on a product WeCreate can actually sell. Before the Commerce Launch Gate no
 * product is purchase-enabled, so the whole grid ships without one: a buy button
 * that could not take money is worse than none.
 */
function ProductCard({
  product,
  boutique,
  purchase,
  showRequirements,
}: ProductCardProps) {
  const availability = productAvailability(product, purchase);

  return (
    <div
      data-testid="product-card"
      data-family={product.family ?? ""}
      className="flex h-full flex-col border border-wc-line-light bg-wc-white transition-colors duration-[400ms] hover:border-wc-pure"
    >
      <Link href={productPath(product.slug)} className="group flex flex-1 flex-col">
        <div className="relative">
          <MediaFrame
            media={product.cover}
            surface="light"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
          <span className="absolute top-3 left-3 bg-wc-pure px-2.5 py-1.5 text-badge tracking-20 uppercase text-wc-white">
            {product.format}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 px-[22px] pt-6 pb-[22px]">
          <h2 className="m-0 font-display text-[23px] leading-[1.2] font-medium">
            {product.title}
          </h2>
          <p className="m-0 flex-1 text-body-sm font-light text-wc-ink">
            {product.summary}
          </p>
          <span className="self-start border-b border-wc-muted-on-light pb-1 text-micro tracking-20 uppercase text-wc-muted-on-light transition-colors duration-300 group-hover:text-wc-pure">
            {boutique.detailLinkLabel}
          </span>
        </div>
      </Link>

      <div className="mx-[22px] flex flex-wrap items-center justify-between gap-3 border-t border-wc-line-light py-4">
        <span className="text-body font-semibold">
          {formatXof(product.priceXof)}
        </span>
        <AvailabilityBadge availability={availability} />
      </div>

      {availability === "available" ? (
        <div className="px-[22px] pb-[22px]">
          <AddToCartButton productId={product.id} title={product.title} />
        </div>
      ) : null}

      {showRequirements ? (
        <div className="px-[22px] pb-[22px]">
          <PurchaseNotice product={product} purchase={purchase} />
        </div>
      ) : null}
    </div>
  );
}

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onSelect: () => void;
}

/** The portfolio's filter chip, inverted for the Boutique's white band. */
function FilterPill({ label, isActive, onSelect }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`border px-[22px] py-[13px] text-micro font-semibold tracking-20 uppercase transition-colors duration-300 ${
        isActive
          ? "border-wc-pure bg-wc-pure text-wc-white"
          : "border-wc-muted-on-light bg-transparent text-wc-ink hover:border-wc-pure"
      }`}
    >
      {label}
    </button>
  );
}
