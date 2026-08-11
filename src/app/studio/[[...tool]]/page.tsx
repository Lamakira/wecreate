import type { Metadata, Viewport } from "next";

import { isSanityConfigured } from "@/sanity/env";
import { StudioClient } from "./studio-client";
import { StudioNotConfigured } from "./studio-not-configured";

/**
 * The Studio, mounted inside the application.
 *
 * Same origin as the public site, so the Presentation tool previews the real
 * Next.js pages and the draft-mode cookie it sets is first-party.
 *
 * When no Sanity project is configured the route renders setup instructions
 * rather than failing the build — a fresh checkout must build and pass its
 * acceptance suite with no production credentials.
 */
export const metadata: Metadata = {
  title: "Studio WeCreate",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function StudioPage() {
  return isSanityConfigured ? <StudioClient /> : <StudioNotConfigured />;
}
