import { PublicationNotice } from "@/components/portfolio/publication-notice";
import type { PortfolioProject } from "@/managed-content/types";

interface ProjectDetailsProps {
  project: PortfolioProject;
  /** `h1` on the project's own page, `h2` inside the portfolio's dialog. */
  as: "h1" | "h2";
  /** Names the dialog that contains this, when there is one. */
  headingId?: string;
  /**
   * Preview only. An editor is shown what a project still needs before it may
   * be published; a visitor never sees an unfinished project at all.
   */
  showRequirements?: boolean;
}

function Label({ children }: { children: string }) {
  return (
    <p className="m-0 mb-3 text-micro tracking-24 uppercase text-wc-muted-2">
      {children}
    </p>
  );
}

/**
 * Everything WeCreate says about a project: who it was for, what it was, what
 * WeCreate did on it and what was handed over.
 *
 * Written once and used in both places a project is opened — the portfolio's
 * dialog and the project's own page — so the two cannot drift apart. The only
 * difference between them is which heading level the title takes.
 */
export function ProjectDetails({
  project,
  as: Heading,
  headingId,
  showRequirements = false,
}: ProjectDetailsProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-[clamp(20px,3vw,44px)] gap-y-8">
      <div>
        <Heading
          id={headingId}
          className={
            Heading === "h1"
              ? "m-0 mb-2.5 font-display text-page-title font-medium"
              : "m-0 mb-2.5 font-display text-[clamp(24px,3vw,38px)] leading-[1.1] font-medium"
          }
        >
          {project.title}
        </Heading>
        <p className="m-0 mb-4 text-micro tracking-20 uppercase text-wc-muted-2">
          {project.client} · {project.projectType}
        </p>
        <p className="m-0 text-body font-light text-wc-soft">
          {project.description}
        </p>

        {showRequirements ? (
          <div className="mt-6">
            <PublicationNotice project={project} />
          </div>
        ) : null}
      </div>

      <div>
        <Label>Rôle de WeCreate</Label>
        <p className="m-0 mb-6 text-body font-light text-wc-soft">
          {project.role}
        </p>

        <Label>Livrables</Label>
        <ul className="m-0 list-none p-0 text-body font-light text-wc-soft">
          {project.deliverables.map((deliverable) => (
            <li key={deliverable} className="mb-1 last:mb-0">
              — {deliverable}
            </li>
          ))}
        </ul>

        {project.transcript ? (
          <details className="mt-6 border-t border-wc-line-dark pt-5">
            <summary className="cursor-pointer text-micro tracking-24 uppercase text-wc-muted-2">
              Transcription
            </summary>
            <p className="m-0 mt-4 text-body-sm font-light whitespace-pre-line text-wc-soft">
              {project.transcript}
            </p>
          </details>
        ) : null}
      </div>
    </div>
  );
}
