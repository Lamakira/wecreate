import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { resolveCommerceProviderId } from "@/commerce/provider";
import { CommerceNotConfigured } from "@/components/commerce/not-configured";

export const metadata: Metadata = {
  title: "Espace commerce · WeCreate",
  // Never indexed anywhere, on any deployment. Unlike the public pages, this is
  // not a question of which environment is crawlable: a staff surface has no
  // business in a search result even in production (issue #1).
  robots: { index: false, follow: false },
};

/**
 * The back office cannot render before it knows who is asking, and who is
 * asking is in a cookie. Nothing here is prerenderable, and marking it so is
 * honest rather than a deferral.
 */
export const instant = false;

/**
 * WeCreate's commerce back office.
 *
 * Deliberately outside the `(site)` layout: no header, no footer, no Digital
 * Cart, no marketing chrome. This is not a page of the website that happens to
 * need a password — it is the other side of the business, and the only thing it
 * shares with the public site is the identity's two colours and its typefaces.
 *
 * It holds Digital Product commerce and nothing else. Service Enquiries,
 * Calendly bookings and project schedules are not here and never will be
 * (ADR-0006).
 *
 * Whether there is a data plane at all is answered once, here, rather than by
 * each page: without one there is nothing for any of them to show, and a
 * sign-in form that could never accept anyone would be the wrong answer.
 */
export default function CommerceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-wc-black text-wc-white">
      <header className="border-b border-wc-line-dark">
        <div className="wc-container flex flex-wrap items-baseline justify-between gap-2 py-5">
          <p className="m-0 text-micro uppercase tracking-24 text-wc-muted-2">
            WeCreate · Espace commerce
          </p>
          <Link
            href="/"
            className="text-micro uppercase tracking-24 text-wc-soft underline underline-offset-4"
          >
            Retour au site
          </Link>
        </div>
      </header>
      <main id="contenu" className="wc-container py-12">
        {resolveCommerceProviderId() === "none" ? (
          <CommerceNotConfigured />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
