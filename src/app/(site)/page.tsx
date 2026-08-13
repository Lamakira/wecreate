import type { Metadata } from "next";

import { BrandQuoteSection } from "@/components/home/brand-quote-section";
import { FinalCtaSection } from "@/components/home/final-cta-section";
import { HeroSection } from "@/components/home/hero-section";
import { PositioningMarquee } from "@/components/home/positioning-marquee";
import { ProofSection } from "@/components/home/proof-section";
import { RecentWorkSection } from "@/components/home/recent-work-section";
import { ShopPreviewSection } from "@/components/home/shop-preview-section";
import { UniversesSection } from "@/components/home/universes-section";
import { readBoutique, readHomePage, readPortfolio } from "@/managed-content";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await readHomePage();

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/" },
    openGraph: {
      title: seo.title,
      description: seo.description,
      images: seo.openGraphImageUrl ? [seo.openGraphImageUrl] : undefined,
    },
  };
}

/**
 * The homepage.
 *
 * A fixed sequence of named sections, each rendered only when Managed Content
 * says it is visible. The order is the design's and is not editable: this is a
 * composed page, not a page builder.
 */
export default async function HomePageRoute() {
  const homePage = await readHomePage();
  // The reel is the portfolio's own list, gated the same way, so the homepage
  // cannot show work the portfolio would refuse to publish. The Boutique teaser
  // works the same way: the featured products are the Boutique's own, already
  // without the ones an editor has archived.
  const { projects } = await readPortfolio();
  const { products } = await readBoutique();

  return (
    <>
      <HeroSection hero={homePage.hero} />
      {homePage.positioningMarquee.isVisible ? (
        <PositioningMarquee marquee={homePage.positioningMarquee} />
      ) : null}
      {homePage.universes.isVisible ? (
        <UniversesSection section={homePage.universes} />
      ) : null}
      {homePage.recentWork.isVisible ? (
        <RecentWorkSection section={homePage.recentWork} projects={projects} />
      ) : null}
      {homePage.proof.isVisible ? <ProofSection section={homePage.proof} /> : null}
      {homePage.shopPreview.isVisible ? (
        <ShopPreviewSection
          section={homePage.shopPreview}
          products={products.filter((product) => product.isFeatured)}
        />
      ) : null}
      {homePage.brandQuote.isVisible ? (
        <BrandQuoteSection section={homePage.brandQuote} />
      ) : null}
      {homePage.finalCta.isVisible ? (
        <FinalCtaSection section={homePage.finalCta} />
      ) : null}
    </>
  );
}
