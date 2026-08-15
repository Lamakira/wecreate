"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * The back office's submit button, which says when it is working.
 *
 * Every action here goes to a server and some of them carry a file, so a
 * button that looks unpressed after being pressed is the difference between
 * waiting and pressing again. It reports the wait three ways, because no one of
 * them reaches everybody: the label changes, `aria-busy` announces it, and the
 * button stops accepting a second press — which also makes a double upload or a
 * double activation impossible rather than merely unlikely.
 *
 * The only client component in the back office, and it is one for exactly this.
 * Without JavaScript `useFormStatus` never reports a pending submission, so the
 * button renders as an ordinary submit and the form posts the way it always
 * did.
 *
 * The same is true of the Order Dossier's forms, which post to a route handler
 * rather than to a Server Function: React does not manage those submissions, so
 * nothing here reports pending and the browser's own progress is what says the
 * page is going somewhere. Nothing there is protected from a second press by
 * this button, and nothing there needs to be — a correction that changes
 * nothing, a version already granted, a delivery already claimed and an anomaly
 * already settled are each refused by the data plane. The two that would happen
 * twice are a second access message and a second note, and both of those are
 * things an operator can see they have done.
 */
export function CommerceButton({
  children,
  pendingLabel = "En cours…",
  secondary = false,
}: {
  children: ReactNode;
  /** What it says while the server is answering. */
  pendingLabel?: string;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={
        secondary
          ? "border border-wc-border px-5 py-2 text-button uppercase tracking-24 text-wc-white disabled:text-wc-muted-2"
          : "border border-wc-white bg-wc-white px-5 py-2 text-button uppercase tracking-24 text-wc-pure disabled:border-wc-soft disabled:bg-wc-soft"
      }
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
