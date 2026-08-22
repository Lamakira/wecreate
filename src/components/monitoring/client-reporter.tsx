"use client";

import { useEffect } from "react";

/**
 * The public site's way of reporting a failure the server never saw.
 *
 * It posts to `/api/observation` rather than to Sentry: the DSN is a
 * monitoring secret and must not enter the bundle (issue #17). The endpoint
 * assigns the kind, rate-limits, and scrubs; this component sends a sentence
 * and nothing else — no order reference, no path, no cookies.
 *
 * Mounted in the document shell so a failure on `/studio` or `/commerce`
 * is reported the same way as one on a marketing page. Failures in this
 * reporter itself are swallowed: a monitoring outage must not take the
 * page down with it.
 */

function report(message: string): void {
  void fetch("/api/observation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: message.slice(0, 500) }),
    keepalive: true,
  }).catch(() => {
    // The reporter is best-effort. A failed report is not a reason to throw.
  });
}

export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      report(event.message || "client error");
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandled rejection",
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
