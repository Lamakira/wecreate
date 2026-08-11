"use client";

import { useEffect, useRef, useState } from "react";

import {
  useMediaQuery,
  useMotionSuppressed,
} from "@/lib/use-motion-preferences";
import type { PlaybackAsset } from "@/managed-content/types";

interface HeroPlaybackProps {
  playback: PlaybackAsset;
}

/**
 * The optional muted loop behind the hero.
 *
 * Three states, in the order the specification requires:
 *
 * - **Motion suppressed** (reduced motion, or Save-Data) — the poster only. No
 *   video element exists, so a metered connection is never charged for one.
 * - **Mobile** — the poster, with an explicit control. Playback starts because
 *   the visitor asked for it, never because the page loaded.
 * - **Pointer-capable desktop** — a muted autoplay loop, as the design intends.
 *
 * The poster is always painted, so the hero looks finished in every state
 * rather than falling back to bare gradient. The layer is decorative: it is
 * hidden from assistive technology, and the heading above it carries the
 * meaning.
 *
 * Issue #3 replaces `sources` with Mux-issued adaptive renditions; the states
 * below do not change when it does.
 */
export function HeroPlayback({ playback }: HeroPlaybackProps) {
  const motionSuppressed = useMotionSuppressed();
  // A fine pointer is the honest proxy for "a desktop that is not paying for
  // its bandwidth by the megabyte". Assumed absent until the browser says
  // otherwise, so nothing autoplays speculatively.
  const canAutoplay = useMediaQuery("(pointer: fine)", false);
  const [isRequested, setIsRequested] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const shouldPlay = !motionSuppressed && (canAutoplay || isRequested);

  useEffect(() => {
    if (shouldPlay && isRequested) {
      // Autoplay is declarative; a requested play is not, and may still be
      // refused by the browser. Nothing breaks if it is — the poster stays.
      videoRef.current?.play().catch(() => undefined);
    }
  }, [shouldPlay, isRequested]);

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${playback.posterUrl})` }}
      />

      {shouldPlay ? (
        <video
          ref={videoRef}
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={playback.posterUrl}
          data-testid="hero-playback"
          className="absolute inset-0 h-full w-full object-cover"
        >
          {playback.sources.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
        </video>
      ) : null}

      {!motionSuppressed && !canAutoplay && !isRequested ? (
        <button
          type="button"
          onClick={() => setIsRequested(true)}
          data-testid="hero-playback-start"
          className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 border border-wc-border bg-wc-pure/60 px-6 py-4 text-button font-semibold tracking-18 uppercase text-wc-white backdrop-blur-[2px] transition-colors duration-300 hover:border-wc-white"
        >
          Lire la vidéo
        </button>
      ) : null}
    </>
  );
}
