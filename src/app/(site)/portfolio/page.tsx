import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { SitePage } from "@/components/shell/site-page";
import { readPortfolioPage } from "@/managed-content";
import { isPublishable } from "@/managed-content/portfolio";
import { pageOpenGraph } from "@/seo/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readPortfolioPage();
  const { seo } = content.portfolio;

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/portfolio" },
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
 * The portfolio.
 *
 * Everything a visitor sees here has already passed the publication gate —
 * an unfinished or unauthorised project is absent from the list, not hidden
 * inside it. In preview the gate is lifted and each project carries what it
 * still needs, so an editor reviews their work in the real page.
 */
export default async function PortfolioPage() {
  const content = await readPortfolioPage();
  const { isEnabled: isPreview } = await draftMode();
  const portfolio = isPreview
    ? content.portfolio
    : {
        ...content.portfolio,
        projects: content.portfolio.projects.filter(isPublishable),
      };

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
      <PortfolioGallery portfolio={portfolio} showRequirements={isPreview} />
    </SitePage>
  );
}
