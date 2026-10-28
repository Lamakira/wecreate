"use client";

import { useLayoutEffect } from "react";

import type { Discipline } from "@/discipline";

/**
 * Tells the document root which Discipline the page on screen belongs to.
 *
 * `globals.css` themes the whole document from the root. Matching
 * `:root:has([data-discipline])` alone is not enough once a visitor moves
 * between pages: with Cache Components, Next.js keeps the page they left in
 * the document, hidden by React's `<Activity>`, so a Branding homepage left for
 * the Boutique would still match and paint the Boutique cream. The hidden page's
 * attribute is the one React cannot take back — so the visible page claims the
 * root itself, and gives it up when Activity hides it (the pattern Next.js
 * documents in *Preserving UI state*, under *Global styles*).
 *
 * Layout effect rather than effect, so the root changes before the browser
 * paints the new page. Before hydration, and without JavaScript, there is only
 * ever one page in the document and the stylesheet's `:has` fallback themes it.
 */
export function DisciplineRoot({ discipline }: { discipline: Discipline }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.discipline = discipline;
    return () => {
      // The page arriving may already have claimed the root; leave its claim.
      if (root.dataset.discipline === discipline) {
        delete root.dataset.discipline;
      }
    };
  }, [discipline]);

  return null;
}
