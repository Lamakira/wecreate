import type { PlaybackAsset } from "@/managed-content/types";

import { muxPlaybackProvider } from "./mux/provider";

/**
 * A caption track the platform holds for this video.
 *
 * The CMS knows which tracks exist and what language each is in; only the
 * playback provider knows where to fetch one from, which is why the address is
 * absent here and present in the resolved `CaptionTrack`.
 */
export interface TextTrackAssociation {
  id: string;
  /** BCP 47 language tag. */
  language: string;
  /** What a viewer picks from the track menu. */
  label: string;
}

/**
 * What Managed Content stores when an editor associates a video with a project.
 *
 * It is deliberately thin. The editor uploads a file; the provider ingests,
 * transcodes and issues an identity for it; everything else — renditions,
 * poster, preview loop — is derived at read time by the adapter. Nothing an
 * editor types appears here except the words: the alternative text, and the
 * caption tracks they approved.
 */
export interface PlaybackAssociation {
  /** The provider's identity for the prepared video. */
  playbackId: string;
  /** False while the provider is still processing the upload. */
  isReady: boolean;
  alternativeText: string;
  textTracks: TextTrackAssociation[];
}

/**
 * The single outbound boundary between WeCreate and its video platform
 * (ADR-0007, ADR-0008).
 *
 * One method, because one thing is being asked: turn an association into
 * something a page can show. An upload that is still transcoding resolves to an
 * asset with no renditions rather than to nothing — the association is real,
 * and the project keeps its poster and its words while the platform catches up.
 * `null` means something different and is the caller's to decide: no video has
 * been associated with this project at all.
 */
export interface VideoPlaybackProvider {
  resolve(association: PlaybackAssociation): PlaybackAsset;
}

/**
 * Which video platform this application talks to.
 *
 * Resolution is pure: it derives public URLs from an identity the platform
 * already issued, so it needs no credentials, no network call and nothing to
 * defer. A checkout with no Mux account still builds and serves the site — it
 * simply has no association to resolve, and projects keep their posters and
 * their words.
 */
export const videoPlaybackProvider: VideoPlaybackProvider = muxPlaybackProvider;
