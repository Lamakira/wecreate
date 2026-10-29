import Link from "next/link";

import { signOutAction } from "@/commerce/actions";

import { CommerceButton } from "./commerce-button";

/**
 * The surfaces of the back office. `commerce` marks the ones that hold commerce
 * data, which a staff member who does not administer commerce is not offered:
 * they would only be refused (ADR-0013).
 */
const SURFACES = [
  { href: "/commerce", label: "Fichiers livrés", commerce: true },
  { href: "/commerce/commandes", label: "Commandes", commerce: true },
  {
    href: "/commerce/questionnaire",
    label: "Questionnaire de marque",
    commerce: false,
  },
] as const;

/**
 * Who is working, what they are looking at, and the way to the other surfaces.
 *
 * The back office is three jobs — the files WeCreate sells, the orders
 * somebody has a problem with, and the questionnaire links for Branding
 * clients — and staff move between them all day (issues #15, #63). The
 * individual's own address is printed beside the way out because every audit
 * entry is going to name it: there is no shared account here, and the surface
 * says whose hands are on it.
 */
export function OperatorBar({
  title,
  operatorEmail,
  current = "/commerce",
  showCommerce = true,
}: {
  title: string;
  operatorEmail: string;
  /** Which surface this is, so the link to it is not offered again. */
  current?: string;
  /** False for staff who do not administer commerce: its surfaces are hidden. */
  showCommerce?: boolean;
}) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="m-0 text-section font-light">{title}</h1>
        <form action={signOutAction} className="flex items-baseline gap-4">
          <span className="text-body-sm font-light text-wc-text-muted">
            {operatorEmail}
          </span>
          <CommerceButton secondary pendingLabel="Déconnexion…">
            Se déconnecter
          </CommerceButton>
        </form>
      </div>
      <nav
        data-testid="commerce-nav"
        aria-label="Espace commerce"
        className="mt-4 flex flex-wrap gap-x-6 gap-y-2"
      >
        {SURFACES.filter(
          (surface) => showCommerce || !surface.commerce,
        ).map((surface) =>
          surface.href === current ? (
            // The surface being looked at is named rather than linked. Partly
            // because a link to the page you are on is furniture nobody presses
            // — and partly because it is not harmless here: a `<Link>` pointing
            // at the current route has it prefetched, and the redirect after an
            // action then renders from that snapshot rather than from what the
            // action just changed. An operator would upload a file and be shown
            // the page as it was before they did.
            <span
              key={surface.href}
              aria-current="page"
              className="text-micro uppercase tracking-24 text-wc-text"
            >
              {surface.label}
            </span>
          ) : (
            <Link
              key={surface.href}
              href={surface.href}
              className="text-micro uppercase tracking-24 text-wc-text-muted underline underline-offset-4"
            >
              {surface.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
