import { NextResponse, type NextRequest } from "next/server";

import { capture } from "@/monitoring/provider";
import { consume } from "@/security/rate-limit";
import { requestAddress } from "@/security/request-address";

/**
 * Where the browser reports a failure it cannot send to Sentry itself.
 *
 * The DSN is server-only (issue #17): nothing with `NEXT_PUBLIC_` may carry a
 * monitoring secret, so the client posts here and this forwards a scrubbed
 * event through the monitoring boundary. The client does not choose the
 * `kind` — a page that could tag its own reports `signature-failure` would
 * be a page that could page WeCreate by pressing a button.
 *
 * Bounded, rate-limited, and generic in its answers, like the payment
 * webhook: an unauthenticated public endpoint is not owed a reason.
 */

const MAX_REPORT_BYTES = 8 * 1024;

function refused(status: number): NextResponse {
  return NextResponse.json(
    { received: false },
    {
      status,
      headers: { "cache-control": "no-store, must-revalidate" },
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    return refused(415);
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_REPORT_BYTES) {
    return refused(413);
  }

  if (!consume("client-observation", requestAddress(request.headers))) {
    return refused(429);
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_REPORT_BYTES) {
    return refused(413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return refused(400);
  }

  const message =
    parsed &&
    typeof parsed === "object" &&
    "message" in parsed &&
    typeof parsed.message === "string"
      ? parsed.message
      : "client error";

  await capture({
    kind: "client-error",
    source: "client",
    message,
  });

  return NextResponse.json(
    { received: true },
    { headers: { "cache-control": "no-store, must-revalidate" } },
  );
}
