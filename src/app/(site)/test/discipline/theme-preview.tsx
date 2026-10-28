import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomePage } from "@/components/home/home-page";
import type { Discipline } from "@/discipline";
import { areTestHooksEnabled, keepOutOfSearchResults } from "@/site-config";

/**
 * The homepage rendered in a Discipline that has no address of its own yet.
 *
 * Issue #56 makes a page able to declare its Discipline; giving Branding and
 * Site web their own addresses is #59. Until then the acceptance suite needs a
 * page in each theme to measure, and these routes are it — the real homepage
 * composition, header and footer included, through the same `SitePage` a
 * Discipline's own route will use.
 *
 * They exist only where the test hooks do, and answer 404 everywhere else, the
 * same way `/api/test/*` does. Remove them once #59 ships the real addresses.
 */
export function themePreviewMetadata(): Metadata {
  return { title: "Aperçu de thème", ...keepOutOfSearchResults() };
}

export function ThemePreview({ discipline }: { discipline: Discipline }) {
  if (!areTestHooksEnabled()) {
    notFound();
  }
  return <HomePage discipline={discipline} />;
}
