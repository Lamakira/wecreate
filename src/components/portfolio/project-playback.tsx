import { posterAlternativeText, posterUrl } from "@/managed-content/portfolio";
import type { PortfolioProject } from "@/managed-content/types";
import { PlaybackPoster, VideoPlayer } from "@/video-playback/video-player";

interface ProjectPlaybackProps {
  project: PortfolioProject;
}

/**
 * A project's film, wherever it is opened.
 *
 * Both places a project can be opened — the portfolio's dialog and the
 * project's own page — go through here, so the fallbacks cannot drift apart.
 *
 * The poster it falls back to is the project's own, not the player's: an editor
 * who uploaded an affiche should see it when the video is missing, which is
 * exactly the moment the poster matters most.
 */
export function ProjectPlayback({ project }: ProjectPlaybackProps) {
  const poster = posterUrl(project);

  if (!project.playbackAsset) {
    return (
      <PlaybackPoster
        posterUrl={poster}
        alternativeText={posterAlternativeText(project)}
        notice="Aucune vidéo n'est associée à ce projet pour le moment."
      />
    );
  }

  return (
    <VideoPlayer
      asset={project.playbackAsset}
      posterUrl={poster}
      alternativeText={posterAlternativeText(project)}
      title={project.title}
    />
  );
}
