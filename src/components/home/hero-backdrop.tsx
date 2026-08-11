"use client";

import dynamic from "next/dynamic";

import { useMotionSuppressed } from "@/lib/use-motion-preferences";

// Loaded only when it is actually going to be used, so a visitor who prefers
// reduced motion or has Save-Data on never downloads the WebGL renderer at all.
// `ssr: false` because it is a canvas — there is nothing to prerender.
const HeroBackground = dynamic(
  () => import("./hero-background").then((module) => module.HeroBackground),
  { ssr: false },
);

/**
 * Decides whether the hero gets its generated background, and lays the scrim
 * over it when it does.
 *
 * The gradient behind is not a placeholder — it is the design's baseline, and
 * what every visitor sees who has asked for less motion, is on a metered
 * connection, or whose device cannot run WebGL.
 */
export function HeroBackdrop() {
  const motionSuppressed = useMotionSuppressed();

  if (motionSuppressed) {
    return null;
  }

  return (
    <>
      <HeroBackground />
      {/*
        The generated background is bright, moving and unpredictable: its pale
        folds sweep straight through the area the copy sits in, and white text,
        a #777 kicker and a #333 button border all but vanish against them.
        Contrast cannot be left to chance on a surface that changes every frame.

        This scrim restores a dark, stable ground exactly where the copy is —
        heaviest at the bottom left, releasing towards the top right so the silk
        still reads as the hero's subject. It is weighted rather than uniform so
        legibility costs the effect as little as possible.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,10,0.97)_0%,rgba(10,10,10,0.95)_52%,rgba(10,10,10,0.9)_74%,rgba(10,10,10,0.45)_90%,rgba(10,10,10,0.1)_100%),linear-gradient(to_right,rgba(10,10,10,0.72)_0%,rgba(10,10,10,0.3)_46%,rgba(10,10,10,0)_78%)]"
      />
    </>
  );
}
