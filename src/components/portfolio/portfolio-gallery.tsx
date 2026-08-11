"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";

import { ProjectDialog } from "@/components/portfolio/project-dialog";
import { ProjectPoster } from "@/components/portfolio/project-poster";
import { PublicationNotice } from "@/components/portfolio/publication-notice";
import { SectionEmptyState } from "@/components/primitives/section-empty-state";
import { SplitHeading } from "@/components/primitives/split-heading";
import {
  PORTFOLIO_UNIVERSES,
  type PortfolioContent,
  type PortfolioProject,
  type PortfolioUniverse,
} from "@/managed-content/types";

interface PortfolioGalleryProps {
  portfolio: PortfolioContent;
  /** Preview only: show what each project still needs before publication. */
  showRequirements?: boolean;
}

type Filter = PortfolioUniverse | null;

/** `0 projet`, `1 projet`, `2 projets` — French takes the singular at zero. */
function projectCount(count: number): string {
  return `${count} projet${count > 1 ? "s" : ""}`;
}

/**
 * The portfolio: its filters, its count and its masonry of Portfolio Projects.
 *
 * Filtering happens here rather than on the server. The whole approved list is
 * already on the page — it is the page — so narrowing it is instant and costs a
 * visitor on a Benin mobile connection nothing at all, which a round trip per
 * filter would not be. A visitor without JavaScript sees every project and every
 * card still leads to its own page.
 *
 * Only universes that actually have published work are offered: an empty filter
 * advertises a category WeCreate cannot yet prove it works in.
 */
export function PortfolioGallery({
  portfolio,
  showRequirements,
}: PortfolioGalleryProps) {
  const { projects, kicker, allUniversesLabel, emptyStateText } = portfolio;
  const [filter, setFilter] = useState<Filter>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const visible = filter
    ? projects.filter((project) => project.universe === filter)
    : projects;
  const universes = PORTFOLIO_UNIVERSES.filter((universe) =>
    projects.some((project) => project.universe === universe),
  );
  const openProject = projects.find((project) => project.id === openProjectId);

  function open(event: MouseEvent<HTMLAnchorElement>, project: PortfolioProject) {
    // A modified click is a request for the project's own page, in this tab or
    // another. Only a plain one means "show me this here".
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    setOpenProjectId(project.id);
  }

  return (
    <>
      <section className="wc-container pt-[clamp(28px,5vw,64px)]">
        <p
          data-testid="portfolio-count"
          className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-muted-2"
        >
          {kicker} · {projectCount(visible.length)}
        </p>
        <SplitHeading
          as="h1"
          headline={portfolio.headline}
          className="m-0 max-w-[22ch] font-display text-page-title font-medium"
        />

        {universes.length > 0 ? (
          <div
            role="group"
            aria-label="Filtrer par univers"
            className="mt-[clamp(30px,4vw,48px)] flex flex-wrap gap-2.5 border-t border-wc-line-dark pt-[26px]"
          >
            <FilterPill
              label={allUniversesLabel}
              isActive={filter === null}
              onSelect={() => setFilter(null)}
            />
            {universes.map((universe) => (
              <FilterPill
                key={universe}
                label={universe}
                isActive={filter === universe}
                onSelect={() => setFilter(universe)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="wc-container pt-[clamp(24px,4vw,48px)] pb-section">
        {visible.length === 0 ? (
          <SectionEmptyState text={emptyStateText} testId="portfolio-empty" />
        ) : (
          <ul
            data-testid="portfolio-grid"
            className="m-0 list-none p-0"
            style={{
              columns: "3 300px",
              columnGap: "var(--spacing-grid-gap-sm)",
            }}
          >
            {visible.map((project) => (
              <li
                key={project.id}
                className="mb-grid-gap-sm break-inside-avoid"
              >
                <Link
                  href={`/portfolio/${project.slug}`}
                  onClick={(event) => open(event, project)}
                  className="group block border border-wc-line-dark bg-wc-surface transition-colors duration-500 hover:border-wc-muted"
                >
                  <ProjectPoster project={project} />
                  <div className="px-[18px] pt-[18px] pb-[22px]">
                    <h2 className="m-0 mb-[7px] font-display text-[21px] leading-[1.15] font-medium">
                      {project.title}
                    </h2>
                    <p className="m-0 text-micro tracking-18 uppercase text-wc-muted-2">
                      {project.client} · {project.projectType}
                    </p>
                  </div>
                </Link>
                {showRequirements ? (
                  <div className="mt-2.5">
                    <PublicationNotice project={project} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {openProject ? (
        <ProjectDialog
          project={openProject}
          onClose={() => setOpenProjectId(null)}
          showRequirements={showRequirements}
        />
      ) : null}
    </>
  );
}

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onSelect: () => void;
}

function FilterPill({ label, isActive, onSelect }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`border px-5 py-3 text-micro font-semibold tracking-20 uppercase transition-colors duration-300 ${
        isActive
          ? "border-wc-white bg-wc-white text-wc-pure"
          : "border-wc-border bg-transparent text-wc-soft hover:border-wc-white"
      }`}
    >
      {label}
    </button>
  );
}
