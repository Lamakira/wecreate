import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";

import { ProjectDetails } from "@/components/portfolio/project-details";
import { ProjectWork } from "@/components/portfolio/project-work";
import { NotFoundContent } from "@/components/shell/not-found-content";
import { SitePage } from "@/components/shell/site-page";
import { gatePortfolio, readPortfolioPage } from "@/managed-content";
import { pageMetadata } from "@/seo/page-metadata";
import { keepOutOfSearchResults } from "@/site-config";

/**
 * This route is not held to the instant-navigation bar.
 *
 * The site's header marks the current navigation entry from `usePathname()`,
 * which no shell shared by every project can know, so this route cannot
 * prerender one. Making the header stream would change the chrome on all six
 * public pages to spare one secondary surface: a project is normally opened as
 * a lightbox over the portfolio, and this page is where a shared link, a
 * crawler or a visitor without JavaScript lands. The content it renders is
 * cached and tagged, so what it costs is a render, not a round trip to the CMS.
 */
export const instant = false;

/** The route's own params. Typed here rather than taken from Next's generated
 *  route types, which do not exist until the first build. */
interface ProjectRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProjectRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await readPortfolioPage();
  const { isEnabled: isPreview } = await draftMode();
  const { projects } = gatePortfolio(content.portfolio, isPreview);
  const project = projects.find((candidate) => candidate.slug === slug);
  if (!project) {
    // The route renders the not-found body itself (see below), so the noindex
    // that `notFound()` would have added has to be said here.
    return {
      ...pageMetadata(content.settings.seo, { title: "Page introuvable" }),
      ...keepOutOfSearchResults(),
    };
  }

  return {
    ...pageMetadata(content.settings.seo, {
      title: project.title,
      description: project.description,
    }),
    alternates: { canonical: `/portfolio/${project.slug}` },
  };
}

/**
 * One Portfolio Project, on a page of its own.
 *
 * The portfolio opens projects in a lightbox, which is the approved design; this
 * is where a shared link, a crawler and a visitor without JavaScript arrive at
 * the same project instead. The two show the same thing because they render the
 * same component.
 *
 * A missing project renders the not-found body inside this route's own
 * `SitePage`, built from the content already read, rather than calling
 * `notFound()`: that would hand over to the 404 page, which reads the site
 * again — a second provider round trip for the one answer that has nothing to
 * show. The answer is 200 with `noindex` rather than 404 — Cache Components
 * streams this route's shell before the slug is known, so the status is
 * already committed — and `generateMetadata` adds the `noindex` itself.
 */
export default async function ProjectRoute({ params }: ProjectRouteProps) {
  const { slug } = await params;
  const content = await readPortfolioPage();
  const { isEnabled: isPreview } = await draftMode();
  const { projects } = gatePortfolio(content.portfolio, isPreview);
  const project = projects.find((candidate) => candidate.slug === slug);

  // A project that has not passed the publication gate does not exist here, in
  // the same way an unpublished one does not: same answer, no hint that a
  // different one would be given to someone else.
  if (!project) {
    return (
      <SitePage
        settings={content.settings}
        legalDocuments={content.legalDocuments}
      >
        <NotFoundContent />
      </SitePage>
    );
  }

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
      <section className="wc-container py-section-xs">
        <Link
          href="/portfolio"
          className="mb-heading-gap inline-block text-micro tracking-24 uppercase text-wc-text-muted transition-colors duration-300 hover:text-wc-text"
        >
          ← Retour au portfolio
        </Link>

        <ProjectWork project={project} />

        <div className="pt-heading-gap">
          <ProjectDetails project={project} as="h1" showRequirements={isPreview} />
        </div>
      </section>
    </SitePage>
  );
}
