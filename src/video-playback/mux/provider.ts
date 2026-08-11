import type { PlaybackAsset } from "@/managed-content/types";

import type { PlaybackAssociation, VideoPlaybackProvider } from "../provider";

const STREAM_ORIGIN = "https://stream.mux.com";
const IMAGE_ORIGIN = "https://image.mux.com";

/**
 * Public streaming is capped at 1080p (ADR-0007). WeCreate's archival masters
 * are 4K and stay off the website entirely; asking a Benin mobile connection to
 * carry a 4K rendition would be the opposite of adaptive.
 */
const MAX_RESOLUTION = "1080p";

/** Wide enough for the largest poster the design uses, on a 2× screen. */
const POSTER_WIDTH = 1600;

/**
 * The hover preview: a few silent seconds at a small size. Deliberately an
 * image rather than a rendition of the film — a card that starts downloading
 * video on hover is exactly what "never preload every full video" forbids.
 */
const PREVIEW_WIDTH = 480;
const PREVIEW_SECONDS = 6;
const PREVIEW_FPS = 15;

/**
 * Mux as WeCreate's video platform.
 *
 * Everything here is URL construction against Mux's public playback and image
 * endpoints, which is why it needs no SDK and no credentials: by the time an
 * association exists, Mux has already ingested the upload, transcoded it and
 * issued the playback id. Uploading is the Studio's job (`src/sanity/`), and
 * playing is `../player`'s.
 */
export const muxPlaybackProvider: VideoPlaybackProvider = {
  resolve({
    playbackId,
    isReady,
    alternativeText,
    textTracks,
  }: PlaybackAssociation): PlaybackAsset {
    const captions = textTracks.map((track) => ({
      src: `${STREAM_ORIGIN}/${playbackId}/text/${track.id}.vtt`,
      language: track.language,
      label: track.label,
    }));

    // Still transcoding. The association is real, so the project is not
    // unfinished — it simply has nothing to play yet, and an asset with no
    // renditions is what makes the page show its poster instead of a player
    // that would fail.
    if (!isReady || !playbackId) {
      return {
        streamId: null,
        posterUrl: "",
        alternativeText,
        sources: [],
        preview: null,
        captions,
      };
    }

    return {
      streamId: playbackId,
      posterUrl: `${IMAGE_ORIGIN}/${playbackId}/thumbnail.webp?width=${POSTER_WIDTH}`,
      alternativeText,
      sources: [
        {
          src: `${STREAM_ORIGIN}/${playbackId}.m3u8?max_resolution=${MAX_RESOLUTION}`,
          type: "application/vnd.apple.mpegurl",
        },
      ],
      preview: {
        src: `${IMAGE_ORIGIN}/${playbackId}/animated.webp?width=${PREVIEW_WIDTH}&start=0&end=${PREVIEW_SECONDS}&fps=${PREVIEW_FPS}`,
        type: "image/webp",
      },
      captions,
    };
  },
};
