import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { BrandQuoteSection } from "@/components/home/brand-quote-section";
import { FinalCtaSection } from "@/components/home/final-cta-section";
import { HeroSection } from "@/components/home/hero-section";
import { PositioningMarquee } from "@/components/home/positioning-marquee";
import { ProofSection } from "@/components/home/proof-section";
import { RecentWorkSection } from "@/components/home/recent-work-section";
import { ShopPreviewSection } from "@/components/home/shop-preview-section";
import { UniversesSection } from "@/components/home/universes-section";
import { SitePage } from "@/components/shell/site-page";
import { readHome } from "@/managed-content";
import { isDiscoverable } from "@/managed-content/digital-products";
import { isPublishable } from "@/managed-content/portfolio";
import { pageOpenGraph } from "@/seo/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readHome();
  const { seo } = content.homePage;

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/" },
    openGraph: pageOpenGraph(
      {
        title: seo.title,
        description: seo.description,
        imageUrl: seo.openGraphImageUrl,
      },
      content.settings.seo,
    ),
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
  const content = await readHome();
  const { homePage } = content;
  const { isEnabled: isPreview } = await draftMode();
  // The reel is the portfolio's own list, gated the same way, so the homepage
  // cannot show work the portfolio would refuse to publish. The Boutique teaser
  // works the same way: the featured products are the Boutique's own, already
  // without the ones an editor has archived.
  const projects = isPreview
    ? content.portfolio.projects
    : content.portfolio.projects.filter(isPublishable);
  const products = isPreview
    ? content.boutique.products
    : content.boutique.products.filter(isDiscoverable);

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
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
    </SitePage>
  );
}
