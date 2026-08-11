import {
  PUBLICATION_REQUIREMENT_LABELS,
  publicationRequirements,
} from "@/managed-content/portfolio";
import type { PortfolioProject } from "@/managed-content/types";

interface PublicationNoticeProps {
  project: PortfolioProject;
}

/**
 * What a Portfolio Project still needs before WeCreate may publish it.
 *
 * Only ever rendered in preview, and only for a project that is not ready. It
 * is the editor's half of the publication rule: the application refuses to show
 * an unfinished project to a visitor, and this is where it says why, in the
 * page the editor is already looking at rather than in a validation panel
 * somewhere else.
 */
export function PublicationNotice({ project }: PublicationNoticeProps) {
  const missing = publicationRequirements(project);
  if (missing.length === 0) {
    return null;
  }

  return (
    <p
      data-testid="project-requirements"
      className="m-0 border border-wc-border p-4 text-body-sm font-light text-wc-soft"
    >
      Non publiable pour le moment. Il manque&nbsp;:{" "}
      {missing
        .map((requirement) => PUBLICATION_REQUIREMENT_LABELS[requirement])
        .join(", ")}
      .
    </p>
  );
}
