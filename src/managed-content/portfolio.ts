import type { Discipline } from "@/discipline";

import type { PortfolioProject } from "./types";

/**
 * What a Portfolio Project is still missing before WeCreate may publish it.
 *
 * The names are the editor's, not the model's: they are what the Studio and
 * the preview banner say out loud, so an editor is told what to do rather than
 * which field is null.
 */
export type PublicationRequirement =
  | "title"
  | "slug"
  | "client"
  | "universe"
  | "projectType"
  | "description"
  | "role"
  | "deliverables"
  | "poster"
  | "alternativeText"
  | "publicationPermission"
  | "playbackAsset"
  | "captionsOrTranscript"
  | "images"
  | "imagesAlternativeText";

/** French wording for each requirement, shown to editors in preview. */
export const PUBLICATION_REQUIREMENT_LABELS: Record<
  PublicationRequirement,
  string
> = {
  title: "le titre",
  slug: "l'adresse",
  client: "le client",
  universe: "l'univers",
  projectType: "le type de prestation",
  description: "la description",
  role: "le rôle de WeCreate",
  deliverables: "les livrables",
  poster: "l'affiche",
  alternativeText: "le texte alternatif de l'affiche",
  publicationPermission: "l'autorisation de publication du client",
  playbackAsset: "la vidéo",
  captionsOrTranscript: "les sous-titres ou la transcription",
  images: "les images",
  imagesAlternativeText: "le texte alternatif de chaque image",
};

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Whether the project is published as a film. A Vidéographie project is; the
 * other two Disciplines are published as images.
 */
export function isFilmed(project: PortfolioProject): boolean {
  return project.discipline === "videographie";
}

/**
 * The still image that stands in for a project everywhere it is listed.
 *
 * An editor may upload one, but they rarely need to: for a film the video
 * platform generates a poster from the film itself, which is both better framed
 * and one fewer thing to remember, and for images the first one stands in. The
 * uploaded image wins when there is one.
 */
export function posterUrl(project: PortfolioProject): string | null {
  if (!isBlank(project.media.imageUrl)) {
    return project.media.imageUrl;
  }
  const generated = isFilmed(project)
    ? (project.playbackAsset?.posterUrl ?? "")
    : (project.images[0]?.url ?? "");
  return isBlank(generated) ? null : generated;
}

/** How that poster is described to someone who cannot see it. */
export function posterAlternativeText(project: PortfolioProject): string {
  if (!isBlank(project.media.imageUrl)) {
    return project.media.alternativeText;
  }
  if (!isFilmed(project)) {
    return project.images[0]?.alternativeText ?? "";
  }
  return project.playbackAsset?.alternativeText || project.media.alternativeText;
}

/**
 * Everything a Portfolio Project still lacks before it may be shown publicly.
 *
 * Publication is an editorial and a rights decision, not a technical one, so
 * the rule lives here rather than in a CMS schema: the Studio mirrors it as
 * field validation, but this is what actually decides whether a visitor sees
 * the project. An empty list means the project is ready.
 *
 * Speech is the one requirement the model cannot infer. An editor declares
 * whether the film's spoken content carries meaning; when it does, captions or
 * an equivalent transcript become as required as the client's permission.
 *
 * A film (Vidéographie) is held to its universe, poster, video and speech; a
 * Branding or Site web project to its images and their descriptions. The first
 * image is the poster, so "the images" already covers a missing poster.
 */
export function publicationRequirements(
  project: PortfolioProject,
): PublicationRequirement[] {
  const missing: PublicationRequirement[] = [];

  if (isBlank(project.title)) missing.push("title");
  if (isBlank(project.slug)) missing.push("slug");
  if (isBlank(project.client)) missing.push("client");
  const filmed = isFilmed(project);
  if (filmed && !project.universe) missing.push("universe");
  if (isBlank(project.projectType)) missing.push("projectType");
  if (isBlank(project.description)) missing.push("description");
  if (isBlank(project.role)) missing.push("role");
  if (project.deliverables.length === 0) missing.push("deliverables");
  if (!filmed) {
    if (
      !isBlank(project.media.imageUrl) &&
      isBlank(project.media.alternativeText)
    ) {
      missing.push("alternativeText");
    }
    if (!project.hasPublicationPermission) missing.push("publicationPermission");
    if (project.images.length === 0) missing.push("images");
    if (project.images.some((image) => isBlank(image.alternativeText))) {
      missing.push("imagesAlternativeText");
    }
    return missing;
  }

  if (isBlank(posterUrl(project))) missing.push("poster");
  if (isBlank(posterAlternativeText(project))) missing.push("alternativeText");
  if (!project.hasPublicationPermission) missing.push("publicationPermission");
  if (!project.playbackAsset) missing.push("playbackAsset");

  if (
    project.spokenContent === "captions" &&
    (project.playbackAsset?.captions.length ?? 0) === 0
  ) {
    missing.push("captionsOrTranscript");
  }
  if (project.spokenContent === "transcript" && isBlank(project.transcript)) {
    missing.push("captionsOrTranscript");
  }

  return missing;
}

/**
 * Whether this project may be shown to a visitor.
 *
 * A project that fails is not broken — it is unfinished. It stays visible in
 * preview, where the editor can see what is left to do, and never reaches the
 * public site.
 */
export function isPublishable(project: PortfolioProject): boolean {
  return publicationRequirements(project).length === 0;
}

/**
 * The Portfolio Projects a Discipline's homepage reel may show: the ones that
 * belong to it, a film for Vidéographie and images for the other two.
 */
export function projectsInDiscipline(
  projects: PortfolioProject[],
  discipline: Discipline,
): PortfolioProject[] {
  return projects.filter((project) => project.discipline === discipline);
}
