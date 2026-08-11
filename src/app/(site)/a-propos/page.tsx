import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shell/placeholder-page";

/**
 * Placeholder route.
 *
 * The homepage ships the six-link navigation, so this path has to resolve.
 * issue #5 — Complete the About and Contact journeys replaces this file with the real page and its approved copy.
 */
export const metadata: Metadata = {
  title: "À propos",
};

export default function AProposPage() {
  return <PlaceholderPage title="À propos" />;
}
