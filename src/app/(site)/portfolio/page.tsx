import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { readPortfolio } from "@/managed-content";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await readPortfolio();

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/portfolio" },
    openGraph: {
      title: seo.title,
      description: seo.description,
      images: seo.openGraphImageUrl ? [seo.openGraphImageUrl] : undefined,
    },
  };
}

/**
 * The portfolio.
 *
 * Everything a visitor sees here has already passed the publication gate in
 * `readPortfolio()` — an unfinished or unauthorised project is absent from the
 * list, not hidden inside it. In preview the gate is lifted and each project
 * carries what it still needs, so an editor reviews their work in the real page.
 */
export default async function PortfolioPage() {
  const portfolio = await readPortfolio();
  const { isEnabled: isPreview } = await draftMode();

  return <PortfolioGallery portfolio={portfolio} showRequirements={isPreview} />;
}
