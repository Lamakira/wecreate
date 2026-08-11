import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shell/placeholder-page";

/**
 * Placeholder route.
 *
 * The homepage ships the six-link navigation, so this path has to resolve.
 * issue #7 — Browse CMS-managed Digital Products replaces this file with the real page and its approved copy.
 */
export const metadata: Metadata = {
  title: "Boutique",
};

export default function BoutiquePage() {
  return <PlaceholderPage title="Boutique" />;
}
