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
import { DEFAULT_DISCIPLINE, disciplinePath, type Discipline } from "@/discipline";
import { gateBoutique, gatePortfolio, readHome } from "@/managed-content";
import { homePageOf } from "@/managed-content/home";
import { projectsInDiscipline } from "@/managed-content/portfolio";
import { pageMetadata } from "@/seo/page-metadata";

/**
 * The homepage.
 *
 * A fixed sequence of named sections, each rendered only when Managed Content
 * says it is visible. The order is the design's and is not editable: this is a
 * composed page, not a page builder.
 *
 * Rendered in the Discipline it is given, and each Discipline has its own
 * blocks: Vidéographie's, Branding's and Site web's are three documents in the
 * Studio with the same fixed sections (issue #59).
 */
export async function HomePage({ discipline }: { discipline: Discipline }) {
  const content = await readHome(discipline);
  const homePage = homePageOf(content, discipline);
  const { isEnabled: isPreview } = await draftMode();
  // The reel is the portfolio's own list, gated the same way, so the homepage
  // cannot show work the portfolio would refuse to publish. The Boutique teaser
  // works the same way: the featured products are the Boutique's own, already
  // without the ones an editor has archived.
  const { projects } = gatePortfolio(content.portfolio, isPreview);
  const { products } = gateBoutique(content.boutique, isPreview);

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
      discipline={discipline}
    >
      <HeroSection hero={homePage.hero} discipline={discipline} />
      {homePage.positioningMarquee.isVisible ? (
        <PositioningMarquee marquee={homePage.positioningMarquee} />
      ) : null}
      {homePage.universes.isVisible ? (
        <UniversesSection section={homePage.universes} />
      ) : null}
      {homePage.recentWork.isVisible ? (
        <RecentWorkSection
          section={homePage.recentWork}
          projects={projectsInDiscipline(projects, discipline)}
        />
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

/**
 * The metadata of a Discipline's homepage.
 *
 * Vidéographie's title stays the brand's own, untemplated, exactly as `/` has
 * always had it — Next.js would not apply a same-segment template to it either.
 * Branding and Site web carry the CMS title template like any other page.
 */
export async function homePageMetadata(
  discipline: Discipline,
): Promise<Metadata> {
  const content = await readHome(discipline);
  const { seo } = homePageOf(content, discipline);

  return {
    ...pageMetadata(
      content.settings.seo,
      {
        title: seo.title,
        description: seo.description,
        imageUrl: seo.openGraphImageUrl,
      },
      { template: discipline !== DEFAULT_DISCIPLINE },
    ),
    alternates: { canonical: disciplinePath(discipline) },
  };
}
