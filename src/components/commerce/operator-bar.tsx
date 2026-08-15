import Link from "next/link";

import { signOutAction } from "@/commerce/actions";

import { CommerceButton } from "./commerce-button";

/** The two surfaces a Commerce Operator works on, and nothing else. */
const SURFACES = [
  { href: "/commerce", label: "Fichiers livrés" },
  { href: "/commerce/commandes", label: "Commandes" },
] as const;

/**
 * Who is working, what they are looking at, and the way to the other surface.
 *
 * The back office is two jobs — the files WeCreate sells, and the orders
 * somebody has a problem with — and an operator moves between them all day
 * (issue #15). The individual's own address is printed beside the way out
 * because every audit entry is going to name it: there is no shared account
 * here, and the surface says whose hands are on it.
 */
export function OperatorBar({
  title,
  operatorEmail,
  current = "/commerce",
}: {
  title: string;
  operatorEmail: string;
  /** Which surface this is, so the link to it is not offered again. */
  current?: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="m-0 text-section font-light">{title}</h1>
        <form action={signOutAction} className="flex items-baseline gap-4">
          <span className="text-body-sm font-light text-wc-muted-2">
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
        {SURFACES.map((surface) =>
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
              className="text-micro uppercase tracking-24 text-wc-white"
            >
              {surface.label}
            </span>
          ) : (
            <Link
              key={surface.href}
              href={surface.href}
              className="text-micro uppercase tracking-24 text-wc-muted-2 underline underline-offset-4"
            >
              {surface.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
