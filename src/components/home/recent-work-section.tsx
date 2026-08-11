import Link from "next/link";

import { ProjectPoster } from "@/components/portfolio/project-poster";
import { CtaLink } from "@/components/primitives/cta-link";
import { Reveal } from "@/components/primitives/reveal";
import { SectionEmptyState } from "@/components/primitives/section-empty-state";
import { SplitHeading } from "@/components/primitives/split-heading";
import type {
  PortfolioProject,
  RecentWorkContent,
} from "@/managed-content/types";

/** The reel is a glimpse, not the portfolio. Six, as the design has it. */
const REEL_LENGTH = 6;

interface RecentWorkSectionProps {
  section: RecentWorkContent;
  /** The published Portfolio Projects, newest first. */
  projects: PortfolioProject[];
}

/**
 * A short reel of recent Portfolio Projects.
 *
 * The projects are the portfolio's own, not a second list an editor maintains
 * alongside it: a project is written once and appears in both places. When
 * nothing is published the section keeps its heading and its link to the full
 * portfolio and states plainly that there is nothing yet — WeCreate never shows
 * placeholder work as if it were real.
 */
export function RecentWorkSection({ section, projects }: RecentWorkSectionProps) {
  const reel = projects.slice(0, REEL_LENGTH);

  return (
    <section
      aria-labelledby="recent-work-heading"
      className="wc-container py-section-xs"
    >
      <Reveal className="mb-heading-gap flex flex-wrap items-baseline justify-between gap-6">
        <SplitHeading
          as="h2"
          id="recent-work-heading"
          headline={section.headline}
          className="m-0 font-display text-section font-medium"
        />
        <CtaLink cta={section.link} variant="underline" />
      </Reveal>

      {reel.length === 0 ? (
        <SectionEmptyState
          text={section.emptyStateText}
          testId="recent-work-empty"
        />
      ) : (
        // `items-start` because the reel mixes 9:16 and 16:9 cards: without it
        // a landscape card is stretched to the height of the portrait card
        // beside it and gains a large empty area under its caption.
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-start gap-grid-gap-sm p-0">
          {reel.map((project) => (
            <Reveal as="li" key={project.id}>
              {/* The handoff opens the reel's cards in the lightbox too. Here
                  they navigate instead: the dialog, its focus trap and the
                  player would all have to ship with the landing page, which is
                  the one page whose weight decides whether a visitor on a Benin
                  mobile connection stays. The card leads to the same project. */}
              <Link
                href={`/portfolio/${project.slug}`}
                className="group block h-full overflow-hidden border border-wc-line-dark bg-wc-surface-2"
              >
                <ProjectPoster project={project} isInteractive={false} />
                <div className="px-4 pt-3.5 pb-[18px]">
                  <p className="m-0 mb-[5px] text-meta font-medium">{project.title}</p>
                  <p className="m-0 text-micro tracking-18 uppercase text-wc-muted-2">
                    {project.client} · {project.projectType}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>
      )}
    </section>
  );
}
