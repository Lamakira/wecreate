"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useLayoutEffect,
  useState,
  type MouseEvent,
} from "react";

import { ProjectDialog } from "@/components/portfolio/project-dialog";
import { ProjectPoster } from "@/components/portfolio/project-poster";
import { PublicationNotice } from "@/components/portfolio/publication-notice";
import { SectionEmptyState } from "@/components/primitives/section-empty-state";
import { SplitHeading } from "@/components/primitives/split-heading";
import { DISCIPLINES, disciplineLabel, type Discipline } from "@/discipline";
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
 * Projects are narrowed by Discipline first, then by universe. The Discipline
 * lives in the address (`/portfolio?discipline=branding`) so a homepage can
 * link straight to its own work and a filtered view can be shared; the universe
 * stays local, since it only ever refines films.
 *
 * The page is prerendered without knowing its address, so the grid is rendered
 * and hydrated unfiltered, exactly as before Disciplines existed, and
 * {@link AddressedDiscipline} narrows it once the browser has read the address.
 * Reading the address in the gallery itself would make the whole grid render
 * in the browser only, and a tap that arrived before it did would land on a
 * card or a filter that does nothing.
 *
 * Filtering happens here rather than on the server. The whole approved list is
 * already on the page — it is the page — so narrowing it is instant and costs a
 * visitor on a Benin mobile connection nothing at all, which a round trip per
 * filter would not be. A visitor without JavaScript sees every project and every
 * card still leads to its own page.
 *
 * Only universes and Disciplines that actually have published work are offered
 * — plus the Discipline the address asks for, so it never lands on a page whose
 * active filter is missing. An empty filter advertises a category WeCreate
 * cannot yet prove it works in.
 */
export function PortfolioGallery({
  portfolio,
  showRequirements,
}: PortfolioGalleryProps) {
  const { projects, kicker, allUniversesLabel, emptyStateText } = portfolio;
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [filter, setFilter] = useState<Filter>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const offeredDisciplines = DISCIPLINES.filter(
    (candidate) =>
      candidate === discipline ||
      projects.some((project) => project.discipline === candidate),
  );
  const inDiscipline = discipline
    ? projects.filter((project) => project.discipline === discipline)
    : projects;
  const visible = filter
    ? inDiscipline.filter((project) => project.universe === filter)
    : inDiscipline;
  const universes = PORTFOLIO_UNIVERSES.filter((universe) =>
    projects.some((project) => project.universe === universe),
  );
  const showsDisciplines = offeredDisciplines.length >= 2;
  const showsUniverses =
    universes.length > 0 && (!discipline || discipline === "videographie");

  function selectDiscipline(next: Discipline | null) {
    setDiscipline(next);
    setFilter(null);
    // The address follows the filter, so the view can be shared. A native
    // history call rather than the router's: it changes the address without
    // asking the server for the page again.
    window.history.replaceState(
      null,
      "",
      next ? `/portfolio?discipline=${next}` : "/portfolio",
    );
  }
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
      <Suspense fallback={null}>
        <AddressedDiscipline onRead={setDiscipline} />
      </Suspense>

      <section className="wc-container pt-[clamp(28px,5vw,64px)]">
        <p
          data-testid="portfolio-count"
          className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-text-muted"
        >
          {kicker} · {projectCount(visible.length)}
        </p>
        <SplitHeading
          as="h1"
          headline={portfolio.headline}
          className="m-0 max-w-[22ch] font-display text-page-title font-medium"
        />

        {showsDisciplines ? (
          <div
            role="group"
            aria-label="Filtrer par discipline"
            className="mt-[clamp(30px,4vw,48px)] flex flex-wrap gap-2.5 border-t border-wc-line pt-[26px]"
          >
            <FilterPill
              label={allUniversesLabel}
              isActive={discipline === null}
              onSelect={() => selectDiscipline(null)}
            />
            {offeredDisciplines.map((offered) => (
              <FilterPill
                key={offered}
                label={disciplineLabel(offered)}
                isActive={discipline === offered}
                onSelect={() => selectDiscipline(offered)}
              />
            ))}
          </div>
        ) : null}

        {showsUniverses ? (
          <div
            role="group"
            aria-label="Filtrer par univers"
            className={
              showsDisciplines
                ? "mt-2.5 flex flex-wrap gap-2.5"
                : "mt-[clamp(30px,4vw,48px)] flex flex-wrap gap-2.5 border-t border-wc-line pt-[26px]"
            }
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
                  className="group block border border-wc-line bg-wc-surface transition-colors duration-500 hover:border-wc-rule"
                >
                  <ProjectPoster project={project} />
                  <div className="px-[18px] pt-[18px] pb-[22px]">
                    <h2 className="m-0 mb-[7px] font-display text-[21px] leading-[1.15] font-medium">
                      {project.title}
                    </h2>
                    <p className="m-0 text-micro tracking-18 uppercase text-wc-text-muted">
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

/**
 * Reads the Discipline the address asks for, and hands it to the gallery.
 *
 * Renders nothing. It is the one part of the portfolio that `useSearchParams`
 * keeps out of the prerendered page, so the boundary around it costs the grid
 * nothing. A layout effect, so a visitor arriving from a homepage's link sees
 * the filtered portfolio on the first paint. An unknown value asks for no
 * filter at all.
 */
function AddressedDiscipline({
  onRead,
}: {
  onRead: (discipline: Discipline | null) => void;
}) {
  const requested = useSearchParams().get("discipline");
  const discipline =
    DISCIPLINES.find((candidate) => candidate === requested) ?? null;

  useLayoutEffect(() => {
    onRead(discipline);
  }, [discipline, onRead]);

  return null;
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
          ? "border-wc-text bg-wc-inverse text-wc-inverse-text"
          : "border-wc-line-strong bg-transparent text-wc-text-soft hover:border-wc-text"
      }`}
    >
      {label}
    </button>
  );
}
