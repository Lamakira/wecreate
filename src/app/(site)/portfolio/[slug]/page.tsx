import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectDetails } from "@/components/portfolio/project-details";
import { ProjectPlayback } from "@/components/portfolio/project-playback";
import { readPortfolioProject } from "@/managed-content";

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
  const project = await readPortfolioProject((await params).slug);
  if (!project) {
    return {};
  }

  return {
    title: project.title,
    description: project.description,
    alternates: { canonical: `/portfolio/${project.slug}` },
    openGraph: {
      title: project.title,
      description: project.description,
    },
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
 * A missing project resolves to the site's not-found page. That answer is 200
 * with `noindex` rather than 404 — Cache Components streams this route's shell
 * before the slug is known, so the status is already committed. See
 * `src/app/(site)/not-found.tsx`.
 */
export default async function ProjectRoute({ params }: ProjectRouteProps) {
  const { slug } = await params;
  const project = await readPortfolioProject(slug);
  const { isEnabled: isPreview } = await draftMode();

  // A project that has not passed the publication gate does not exist here, in
  // the same way an unpublished one does not: same answer, no hint that a
  // different one would be given to someone else.
  if (!project) {
    notFound();
  }

  return (
    <section className="wc-container py-section-xs">
      <Link
        href="/portfolio"
        className="mb-heading-gap inline-block text-micro tracking-24 uppercase text-wc-muted-2 transition-colors duration-300 hover:text-wc-white"
      >
        ← Retour au portfolio
      </Link>

      <ProjectPlayback project={project} />

      <div className="pt-heading-gap">
        <ProjectDetails project={project} as="h1" showRequirements={isPreview} />
      </div>
    </section>
  );
}
