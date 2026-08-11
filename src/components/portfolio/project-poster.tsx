"use client";

/* eslint-disable @next/next/no-img-element -- Both images here arrive from a
 * CDN that has already sized and reformatted them: Mux issues thumbnails and
 * preview loops at the width we ask for, and Sanity's asset URLs carry their
 * own transform (see `managed-content/sanity/query.ts`). Routing them through
 * a second optimiser would add a round trip and change nothing a visitor sees.
 */

import { useState } from "react";

import {
  useMediaQuery,
  useMotionSuppressed,
} from "@/lib/use-motion-preferences";
import { posterAlternativeText, posterUrl } from "@/managed-content/portfolio";
import type { PortfolioProject } from "@/managed-content/types";

interface ProjectPosterProps {
  project: PortfolioProject;
  /** Whether hovering may start the short preview loop. */
  isInteractive?: boolean;
}

/**
 * A project's still frame, at the project's own aspect ratio.
 *
 * The poster is a plain `<img>` rather than an optimised one on purpose: it
 * arrives from a CDN that has already sized it — Mux issues thumbnails at the
 * width we ask for, and Sanity's asset URLs carry their own transform — so
 * putting a second optimiser in front of it would cost a round trip and change
 * nothing a visitor sees.
 *
 * The preview loop on top of it is the design's hover behaviour, and it is
 * strictly opt-in: it exists only where a fine pointer says this is a desktop,
 * only when motion is not suppressed, and only while the pointer is actually
 * over the card. Nothing is downloaded before that — a portfolio that preloaded
 * six films would be unusable on the connections this site is built for.
 */
export function ProjectPoster({
  project,
  isInteractive = true,
}: ProjectPosterProps) {
  const motionSuppressed = useMotionSuppressed();
  const hasFinePointer = useMediaQuery("(pointer: fine)", false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const poster = posterUrl(project);
  const alternativeText = posterAlternativeText(project);
  const preview = project.playbackAsset?.preview ?? null;
  const mayPreview =
    isInteractive && Boolean(preview) && hasFinePointer && !motionSuppressed;

  return (
    <div
      data-testid="project-poster-frame"
      style={{ aspectRatio: project.media.ratio }}
      className="relative grid place-items-center overflow-hidden bg-[linear-gradient(140deg,#1A1A1A,#3A3A3A_50%,#0F0F0F)]"
      onPointerEnter={mayPreview ? () => setIsPreviewing(true) : undefined}
      onPointerLeave={mayPreview ? () => setIsPreviewing(false) : undefined}
    >
      {poster ? (
        <img
          src={poster}
          alt={alternativeText}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-signature group-hover:scale-105"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-mono text-micro tracking-18 text-wc-muted-2"
        >
          {project.media.placeholderLabel}
        </span>
      )}

      {isPreviewing && preview ? (
        preview.type.startsWith("video/") ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            data-testid="project-preview"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={preview.src} type={preview.type} />
          </video>
        ) : (
          <img
            src={preview.src}
            alt=""
            aria-hidden="true"
            data-testid="project-preview"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : null}

      {project.playbackAsset ? (
        <span
          aria-hidden="true"
          className="absolute right-3.5 bottom-3 text-badge tracking-20 uppercase text-wc-soft"
        >
          ▶ aperçu
        </span>
      ) : null}
    </div>
  );
}
