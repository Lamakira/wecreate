"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { PlaybackAsset } from "@/managed-content/types";

/**
 * Loaded only once a visitor has opened a project, and only when the asset is
 * an adaptive stream. It is the heaviest thing on the portfolio by some
 * distance, so it stays off the page until it is the thing being asked for.
 *
 * This import is what makes the adaptive path Mux's; everything else here is
 * about a Playback Asset, not about a vendor. A second provider would arrive
 * as a second import beside it and a discriminator on the asset.
 */
const MuxProjectPlayer = dynamic(() => import("./mux/player"), {
  ssr: false,
  loading: () => <PlaybackPoster posterUrl={null} alternativeText="" />,
});

interface PlaybackPosterProps {
  posterUrl: string | null;
  alternativeText: string;
  /** Shown over the poster when playback was meant to work and did not. */
  notice?: string;
}

/**
 * What stands in for the player: the film's own poster frame, at the shape the
 * player would have taken.
 *
 * Every degraded path lands here — no video associated, still transcoding, the
 * player failed to load, playback errored — because in all of them the honest
 * thing to show is the picture and the words, not an empty black rectangle.
 */
export function PlaybackPoster({
  posterUrl,
  alternativeText,
  notice,
}: PlaybackPosterProps) {
  return (
    <div
      data-testid="project-poster"
      className="relative grid aspect-video place-items-center overflow-hidden border border-wc-line-dark bg-[linear-gradient(140deg,#1A1A1A,#3A3A3A_50%,#0F0F0F)] bg-cover bg-center"
      style={posterUrl ? { backgroundImage: `url(${posterUrl})` } : undefined}
      role={posterUrl ? "img" : undefined}
      aria-label={posterUrl ? alternativeText : undefined}
    >
      {notice ? (
        <p className="m-0 max-w-[36ch] bg-wc-pure/70 px-5 py-3 text-center text-body-sm font-light text-wc-soft backdrop-blur-[2px]">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

interface VideoPlayerProps {
  asset: PlaybackAsset;
  /**
   * The still to show before and instead of playback. Passed in rather than
   * taken from the asset, because the editor's own poster outranks the one the
   * platform generated.
   */
  posterUrl: string | null;
  alternativeText: string;
  /** The film's title, for the player's own labelling and analytics. */
  title: string;
}

/**
 * A Playback Asset, played.
 *
 * Two shapes arrive here and the difference is not the vendor's, it is the
 * asset's: an adaptive stream carries a `streamId` and needs a player that
 * speaks HLS; a plain file is a `<video>` and nothing more. Development and the
 * acceptance suite run entirely on the second, which is what keeps playback
 * behaviour testable without a Mux account.
 *
 * Neither one autoplays. A portfolio film is the thing the visitor came for, so
 * it starts when they say so — on every device, not only the metered ones.
 */
export function VideoPlayer({
  asset,
  posterUrl,
  alternativeText,
  title,
}: VideoPlayerProps) {
  const [hasFailed, setHasFailed] = useState(false);
  const poster = posterUrl ?? (asset.posterUrl || null);
  const description = alternativeText || asset.alternativeText;

  if (hasFailed) {
    return (
      <PlaybackPoster
        posterUrl={poster}
        alternativeText={description}
        notice="La vidéo ne peut pas être lue pour le moment. Le projet est décrit ci-dessous."
      />
    );
  }

  // Associated but not playable: the platform is still transcoding it, or is
  // unreachable from this deployment. Neither is the visitor's problem.
  if (!asset.streamId && asset.sources.length === 0) {
    return (
      <PlaybackPoster
        posterUrl={poster}
        alternativeText={description}
        notice="La vidéo de ce projet n'est pas encore disponible. Le projet est décrit ci-dessous."
      />
    );
  }

  if (asset.streamId) {
    return (
      <MuxProjectPlayer
        playbackId={asset.streamId}
        posterUrl={poster ?? ""}
        title={title}
      />
    );
  }

  return (
    <video
      controls
      playsInline
      preload="none"
      poster={poster ?? undefined}
      onError={() => setHasFailed(true)}
      data-testid="project-player"
      aria-label={description || title}
      className="aspect-video w-full border border-wc-line-dark bg-wc-pure"
    >
      {asset.sources.map((source) => (
        <source key={source.src} src={source.src} type={source.type} />
      ))}
      {asset.captions.map((caption) => (
        <track
          key={caption.src}
          kind="captions"
          src={caption.src}
          srcLang={caption.language}
          label={caption.label}
        />
      ))}
    </video>
  );
}
