import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shell/placeholder-page";

/**
 * Placeholder route.
 *
 * The homepage ships the six-link navigation, so this path has to resolve.
 * issue #4 — Turn service interest into a Service Enquiry replaces this file with the real page and its approved copy.
 */
export const metadata: Metadata = {
  title: "Services",
};

export default function ServicesPage() {
  return <PlaceholderPage title="Services" />;
}
