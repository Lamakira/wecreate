"use client";

import { useCallback, useSyncExternalStore } from "react";

interface NetworkInformation extends EventTarget {
  saveData?: boolean;
}

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
}

/**
 * Read a media query, without the mount-then-correct render that storing the
 * answer in state would cause.
 *
 * `serverFallback` is what the server and the very first client render assume.
 * Pick the quiet answer: it is the one that is safe to be wrong about.
 */
export function useMediaQuery(query: string, serverFallback: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

/**
 * Whether decorative motion and optional playback should be suppressed.
 *
 * Two independent signals, both meaning "do less": an explicit reduced-motion
 * preference, and Save-Data, which visitors on metered mobile connections in
 * Benin are likely to have on.
 *
 * Assumed true until the browser says otherwise, so nothing decorative can
 * start before the preference is known.
 */
export function useMotionSuppressed(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", onChange);
    connection()?.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
      connection()?.removeEventListener("change", onChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      connection()?.saveData === true,
    () => true,
  );
}
