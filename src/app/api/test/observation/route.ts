import { NextResponse, type NextRequest } from "next/server";

import { areObservationTestHooksEnabled } from "@/site-config";

/**
 * Captured failures, for the acceptance suite.
 *
 * The suite cannot open Sentry, and must not: a real project would receive
 * the same events a production outage does, and nothing here may offer a
 * way to read one. The fixture monitoring provider keeps what it was asked
 * to record, and this reads it back — which is how a scenario asserts that
 * a forged webhook, a guessed token or a failed delivery was reported
 * without a secret, an email or a token in the event.
 *
 * Resetting also empties the in-memory rate-limit buckets. They live in
 * this process, and a scenario that fills one would otherwise fail the
 * next. Both are server state no actor can see, which is why they share
 * this hook.
 *
 * It is inert unless BOTH `WECREATE_TEST_HOOKS=1` and
 * `WECREATE_MONITORING_PROVIDER=fixture` are set, and answers 404 rather
 * than 403 when they are not.
 */

type TestObservationRequest = { action: "reset" };

export async function GET(): Promise<Response> {
  if (!areObservationTestHooksEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { readMonitoringEvents } = await import(
    "@/monitoring/fixture/provider"
  );
  return NextResponse.json(
    { events: readMonitoringEvents() },
    { headers: { "cache-control": "no-store, must-revalidate" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!areObservationTestHooksEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = (await request.json()) as TestObservationRequest;
  if (body.action !== "reset") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { resetMonitoringEvents } = await import(
    "@/monitoring/fixture/provider"
  );
  const { resetRateLimits } = await import("@/security/rate-limit");
  resetMonitoringEvents();
  resetRateLimits();

  return NextResponse.json({ ok: true, action: body.action });
}
