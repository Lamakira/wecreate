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
