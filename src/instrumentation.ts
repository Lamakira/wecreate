import type { Instrumentation } from "next";

import { capture } from "@/monitoring/provider";
import { scrubPath } from "@/monitoring/scrub";

/**
 * Where uncaught server failures become monitoring events.
 *
 * Next.js calls `onRequestError` after it has already produced the response
 * the visitor sees, so this cannot change what they were told — it can only
 * record that something failed, with the path scrubbed of tokens and query
 * strings. Capture itself never throws.
 *
 * There is no `register()` that loads a vendor SDK. The Sentry adapter is
 * imported lazily from `src/monitoring/` the first time an event is captured,
 * the same way every other provider here is.
 */

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
) => {
  const message = error instanceof Error ? error.message : "server error";
  await capture({
    kind: "server-error",
    source: "server",
    message: `${request.method} ${scrubPath(request.path)}: ${message}`,
  });
};
