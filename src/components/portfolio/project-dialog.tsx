"use client";

import { ProjectDetails } from "@/components/portfolio/project-details";
import { ProjectPlayback } from "@/components/portfolio/project-playback";
import { useModalDialog } from "@/lib/use-modal-dialog";
import type { PortfolioProject } from "@/managed-content/types";

interface ProjectDialogProps {
  project: PortfolioProject;
  onClose: () => void;
  /** Preview only: show what the project still needs before publication. */
  showRequirements?: boolean;
}

/**
 * A Portfolio Project, opened over the portfolio.
 *
 * The film first, then everything written about it — the design's lightbox. It
 * is a real modal dialog: named by the project's title, focused on open,
 * dismissed with Escape or the close button, and returning focus to the card it
 * was opened from. The same project is also a page of its own at
 * `/portfolio/[slug]`, which is where a shared link, a crawler, or a visitor
 * without JavaScript arrives.
 */
export function ProjectDialog({
  project,
  onClose,
  showRequirements,
}: ProjectDialogProps) {
  const { panelRef, closeButtonRef } = useModalDialog(true, onClose);
  const headingId = `project-${project.id}-title`;

  return (
    <div className="fixed inset-0 z-1001 flex items-center justify-center overflow-y-auto bg-wc-pure/94 p-[clamp(16px,4vw,56px)]">
      <button
        type="button"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="project-dialog"
        className="relative my-auto w-[min(1080px,100%)] animate-wc-fade-fast"
      >
        <div className="mb-3 flex justify-end">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-button tracking-20 uppercase text-wc-muted-2 transition-colors duration-300 hover:text-wc-white"
          >
            Fermer ×
          </button>
        </div>

        <ProjectPlayback project={project} />

        <div className="pt-7">
          <ProjectDetails
            project={project}
            as="h2"
            headingId={headingId}
            showRequirements={showRequirements}
          />
        </div>
      </div>
    </div>
  );
}
