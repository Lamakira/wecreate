import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shell/placeholder-page";

/**
 * Placeholder route.
 *
 * The homepage ships the six-link navigation, so this path has to resolve.
 * issue #3 — Publish and play Portfolio Projects replaces this file with the real page and its approved copy.
 */
export const metadata: Metadata = {
  title: "Portfolio",
};

export default function PortfolioPage() {
  return <PlaceholderPage title="Portfolio" />;
}
