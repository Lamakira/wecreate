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
  | "captionsOrTranscript";

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
};

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * The still image that stands in for a project everywhere it is listed.
 *
 * An editor may upload one, but they rarely need to: the video platform
 * generates a poster from the film itself, which is both better framed and one
 * fewer thing to remember. The uploaded image wins when there is one.
 */
export function posterUrl(project: PortfolioProject): string | null {
  if (!isBlank(project.media.imageUrl)) {
    return project.media.imageUrl;
  }
  const generated = project.playbackAsset?.posterUrl ?? "";
  return isBlank(generated) ? null : generated;
}

/** How that poster is described to someone who cannot see it. */
export function posterAlternativeText(project: PortfolioProject): string {
  if (!isBlank(project.media.imageUrl)) {
    return project.media.alternativeText;
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
 */
export function publicationRequirements(
  project: PortfolioProject,
): PublicationRequirement[] {
  const missing: PublicationRequirement[] = [];

  if (isBlank(project.title)) missing.push("title");
  if (isBlank(project.slug)) missing.push("slug");
  if (isBlank(project.client)) missing.push("client");
  if (!project.universe) missing.push("universe");
  if (isBlank(project.projectType)) missing.push("projectType");
  if (isBlank(project.description)) missing.push("description");
  if (isBlank(project.role)) missing.push("role");
  if (project.deliverables.length === 0) missing.push("deliverables");
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
