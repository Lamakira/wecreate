/* eslint-disable @next/next/no-img-element -- Sanity's asset URLs carry their
 * own transform (see `managed-content/sanity/query.ts`), so the image arrives
 * already sized and reformatted; a second optimiser would change nothing a
 * visitor sees.
 */

import type { PortfolioProject } from "@/managed-content/types";

interface ProjectImagesProps {
  project: PortfolioProject;
}

/**
 * The work of a Branding or Site web project: its images, in order.
 *
 * Each image carries its own size, so the page reserves its space before it
 * arrives. Hook-free on purpose: it is rendered inside the portfolio's client
 * dialog and on the project's own server-rendered page alike.
 */
export function ProjectImages({ project }: ProjectImagesProps) {
  if (project.images.length === 0) {
    return (
      <p className="m-0 text-body text-wc-text-muted">
        Aucune image n&apos;est associée à ce projet pour le moment.
      </p>
    );
  }
  return (
    <ul
      data-testid="project-images"
      className="m-0 grid list-none gap-grid-gap-sm p-0"
    >
      {project.images.map((image, index) => (
        <li key={image.key}>
          <img
            src={image.url}
            alt={image.alternativeText}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            className="block h-auto max-h-[85vh] w-full object-contain"
          />
        </li>
      ))}
    </ul>
  );
}
