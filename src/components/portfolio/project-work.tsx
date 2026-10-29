import { ProjectImages } from "@/components/portfolio/project-images";
import { ProjectPlayback } from "@/components/portfolio/project-playback";
import { isFilmed } from "@/managed-content/portfolio";
import type { PortfolioProject } from "@/managed-content/types";

interface ProjectWorkProps {
  project: PortfolioProject;
}

/**
 * What a project shows of itself, wherever it is opened: the film for
 * Vidéographie, the images for Branding and Site web.
 *
 * There is no player for work that is not a film.
 */
export function ProjectWork({ project }: ProjectWorkProps) {
  return isFilmed(project) ? (
    <ProjectPlayback project={project} />
  ) : (
    <ProjectImages project={project} />
  );
}
