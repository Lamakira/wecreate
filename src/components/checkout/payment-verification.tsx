"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * The page watching for a confirmation that arrives somewhere else.
 *
 * A buyer comes back from the hosted page with nothing that proves anything.
 * What decides their Payment State is a verified webhook, delivered to a
 * different address, at a moment nobody can predict — so this asks the server,
 * every few seconds, whether it has heard yet. It is the only client-side code
 * on the checkout, and it exists because the alternative is a page that lies:
 * either a static *en attente* a buyer has to guess when to reload, or an
 * optimistic *merci pour votre achat* nothing has confirmed.
 *
 * Four rules shape it, and each is an answer to a way this could go wrong.
 *
 * **It backs off, and it stops.** The delays grow from two seconds to twenty,
 * and after enough of them it says so and leaves the page alone. A tab left
 * open for a week must not be polling a payment endpoint on a metered Benin
 * mobile connection.
 *
 * **It waits rather than concludes.** A request that failed, timed out or
 * answered `unknown` is not evidence of anything and is treated as such: the
 * page keeps saying *Vérification du paiement*. Issue #1 is explicit that
 * connectivity uncertainty must never become a failed payment.
 *
 * **Offline is said out loud, and is not a failure.** A buyer whose connection
 * dropped is told the check will resume, not that their payment did not work.
 *
 * **It asks for nothing while nobody is looking.** A hidden tab and an offline
 * browser both stop the timer entirely; the browser's own `online` and
 * `visibilitychange` events start it again, which is faster than any interval
 * would have been anyway.
 *
 * When the answer changes it refreshes the route rather than rendering the new
 * state itself. The server owns what a buyer is told about their money — this
 * component's whole job is knowing when to ask again.
 */

/** Growing delays between checks. The last one is the ceiling. */
const BACKOFF_MS = [2_000, 3_000, 5_000, 8_000, 13_000, 20_000];

/** How many checks before this stops asking. Roughly twenty minutes. */
const MAX_CHECKS = 60;

/** Where the server answers with two words and nothing else. */
const ORDER_STATE_URL = "/commande/etat";

/**
 * Whether this browser currently believes it has no connection.
 *
 * Subscribed to rather than copied into state on mount: `navigator.onLine` is
 * an external store, and reading it through React's own hook for those is what
 * keeps the server-rendered markup and the first client render agreeing. The
 * server has no connection status to report, so it renders the online branch —
 * which is also what a browser that never fires either event will keep showing.
 */
function useIsOffline(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
}

export function PaymentVerification() {
  const router = useRouter();
  const offline = useIsOffline();
  const [stopped, setStopped] = useState(false);
  // Kept across reconnections, so a flapping connection cannot buy itself an
  // unbounded number of checks by restarting the effect.
  const checks = useRef(0);

  useEffect(() => {
    // Nothing is scheduled while there is no connection, and nothing needs to
    // be: coming back online changes `offline`, which runs this effect again.
    if (offline || stopped) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };

    const schedule = () => {
      clear();
      if (cancelled) return;
      if (checks.current >= MAX_CHECKS) {
        setStopped(true);
        return;
      }
      timer = setTimeout(
        check,
        BACKOFF_MS[Math.min(checks.current, BACKOFF_MS.length - 1)],
      );
    };

    async function check(): Promise<void> {
      if (cancelled) return;

      // A hidden tab is asked for nothing at all. The listener below starts a
      // check the moment it comes back, which is sooner than any interval.
      if (document.visibilityState === "hidden") {
        clear();
        return;
      }

      checks.current += 1;
      try {
        const response = await fetch(ORDER_STATE_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`${response.status}`);

        const { payment } = (await response.json()) as { payment?: string };
        // `unknown` is the server saying it cannot tell — an unreachable data
        // plane, or a browser no longer carrying an order. Neither is news.
        if (payment && payment !== "pending" && payment !== "unknown") {
          cancelled = true;
          clear();
          router.refresh();
          return;
        }
      } catch {
        // A check that did not answer says nothing about the payment. Wait
        // longer and ask again.
      }
      schedule();
    }

    const resume = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      // Immediately, rather than after the next delay: the buyer has just come
      // back, and this is the moment they are looking at the page.
      clear();
      void check();
    };

    document.addEventListener("visibilitychange", resume);
    // A first check waits, because the page was rendered from the server a
    // moment ago and already says what it knew. A *resumed* one does not: this
    // effect only runs again because the connection came back, and the answer
    // may have arrived while it was gone.
    if (checks.current > 0) {
      void check();
    } else {
      schedule();
    }

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [router, offline, stopped]);

  return (
    <p
      data-testid="payment-verification"
      className="m-0 mt-8 border-t border-wc-line-light pt-6 text-body font-light text-wc-muted-on-light"
      // Announced once it settles rather than on every check: a reader using a
      // screen reader should hear the answer, not the asking.
      aria-live="polite"
    >
      {offline ? (
        <span data-testid="payment-offline">
          <strong className="font-semibold text-wc-pure">
            Vous êtes hors ligne.
          </strong>{" "}
          La vérification reprend dès que la connexion revient. Votre paiement
          suit son cours de son côté : rien n&apos;est perdu.
        </span>
      ) : stopped ? (
        <span data-testid="payment-verification-paused">
          Cette page a cessé de vérifier automatiquement. Rechargez-la pour
          reprendre — et dans tous les cas, nous vous écrivons dès que le
          paiement est confirmé : rien ne dépend de cette page.
        </span>
      ) : (
        "Nous vérifions automatiquement toutes les quelques secondes. Cette page se met à jour toute seule."
      )}
    </p>
  );
}
