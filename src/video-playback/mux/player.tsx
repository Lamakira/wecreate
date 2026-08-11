"use client";

import MuxPlayer from "@mux/mux-player-react";

/**
 * Mux's own player.
 *
 * This is the one module in the application allowed to import the Mux SDK
 * (ADR-0008), and it is loaded on demand rather than shipped with the page —
 * a visitor who never opens a project never downloads a player.
 *
 * It is here rather than in a component folder because it is the vendor half of
 * playback: adaptive delivery in browsers with no native HLS, and the aggregate
 * quality and engagement measurement ADR-0007 asks for. That measurement is
 * anonymous by construction: the metadata below carries the film's title and
 * nothing about who is watching it.
 */

interface MuxProjectPlayerProps {
  playbackId: string;
  posterUrl: string;
  /** Names the film in Mux's aggregate analytics. Never a viewer identity. */
  title: string;
}

export default function MuxProjectPlayer({
  playbackId,
  posterUrl,
  title,
}: MuxProjectPlayerProps) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="on-demand"
      // WeCreate's masters are 4K; the website never streams above 1080p.
      maxResolution="1080p"
      poster={posterUrl}
      title={title}
      metadata={{ video_title: title }}
      envKey={process.env.NEXT_PUBLIC_MUX_ENV_KEY}
      // Strict black and white, like everything else here.
      accentColor="#ffffff"
      primaryColor="#ffffff"
      secondaryColor="#000000"
      // Nothing plays because a page opened. The visitor asks first.
      preload="none"
      data-testid="project-player"
      style={{ aspectRatio: "16 / 9", width: "100%", display: "block" }}
    />
  );
}
