import Link from "next/link";

import { CtaLink } from "@/components/primitives/cta-link";
import { MediaFrame } from "@/components/primitives/media-frame";
import { Reveal } from "@/components/primitives/reveal";
import { SectionEmptyState } from "@/components/primitives/section-empty-state";
import { SplitHeading } from "@/components/primitives/split-heading";
import type { RecentWorkContent } from "@/managed-content/types";

interface RecentWorkSectionProps {
  section: RecentWorkContent;
}

/**
 * A short reel of recent Portfolio Projects.
 *
 * Issue #3 owns the Portfolio Project itself; here the list is whatever
 * Managed Content offers. When nothing is published the section keeps its
 * heading and its link to the full portfolio and states plainly that there is
 * nothing yet — WeCreate never shows placeholder work as if it were real.
 */
export function RecentWorkSection({ section }: RecentWorkSectionProps) {
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

      {section.projects.length === 0 ? (
        <SectionEmptyState
          text={section.emptyStateText}
          testId="recent-work-empty"
        />
      ) : (
        // `items-start` because the reel mixes 9:16 and 16:9 cards: without it
        // a landscape card is stretched to the height of the portrait card
        // beside it and gains a large empty area under its caption.
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-start gap-grid-gap-sm p-0">
          {section.projects.map((project) => (
            <Reveal as="li" key={project.id}>
              <Link
                href={project.href}
                className="group block h-full overflow-hidden border border-wc-line-dark bg-wc-surface-2"
              >
                <MediaFrame
                  media={project.media}
                  sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="transition-transform duration-700 ease-signature group-hover:scale-105"
                />
                <div className="px-4 pt-3.5 pb-[18px]">
                  <p className="m-0 mb-[5px] text-meta font-medium">{project.title}</p>
                  <p className="m-0 text-micro tracking-18 uppercase text-wc-muted-2">
                    {project.client} · {project.category}
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
