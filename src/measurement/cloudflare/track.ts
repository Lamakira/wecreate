import { publicProperties, type MeasurementEvent } from "@/measurement/events";

declare global {
  interface Window {
    zaraz?: {
      q?: unknown[];
      track?: (name: string, properties?: Record<string, string>) => void;
    };
  }
}

/**
 * Cloudflare Zaraz's public queue, so a call made before the CDN snippet
 * arrives is not lost.
 *
 * Production injects Zaraz at the edge (`/cdn-cgi/zaraz/i.js`) once the site
 * is proxied. Staging has no CDN (see README, *Deploying*), so this stub is
 * what holds events until one is. It never invents a visitor identity.
 */
export function ensureZarazQueue(): void {
  const zaraz = (window.zaraz ??= {});
  zaraz.q ??= [];
  if (typeof zaraz.track === "function") {
    return;
  }
  zaraz.track = (name, properties) => {
    zaraz.q!.push(["track", name, properties ?? {}]);
  };
}

/**
 * Record one anonymous event through Cloudflare Zaraz.
 *
 * `zaraz.track` is the product this ticket settles on for custom events.
 * Page views and Core Web Vitals are Cloudflare Web Analytics' job, via the
 * beacon, and are not sent from here.
 */
export function track(event: MeasurementEvent): void {
  if (typeof window === "undefined") {
    return;
  }
  ensureZarazQueue();
  window.zaraz?.track?.(event.name, publicProperties(event));
}
