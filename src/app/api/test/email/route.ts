import { NextResponse, type NextRequest } from "next/server";

import { areEmailTestHooksEnabled } from "@/site-config";

/**
 * The buyer's inbox, for the acceptance suite.
 *
 * Every other thing the suite does it does the way an actor does it. This is
 * the one it cannot: a receipt goes to an address, and there is no mailbox on
 * this machine. So the fixture email provider keeps what it was asked to send
 * and this reads it back — which is exactly the position a buyer is in when
 * they open their mail and follow the Order Access address in it.
 *
 * It also puts the provider out of action and brings it back, which is the
 * second thing no actor can do. Issue #14 asks for a delivery that failed to be
 * taken up again and finish, and for a claim left behind by a request nobody is
 * waiting on any more; a sender that always refuses can show neither.
 *
 * It is inert unless BOTH `WECREATE_TEST_HOOKS=1` and
 * `WECREATE_EMAIL_PROVIDER=fixture` are set, and answers 404 rather than 403
 * when they are not: on a deployment that sends real mail this address does not
 * exist, and does not advertise that it might.
 */

type TestEmailRequest =
  | { action: "reset" }
  | { action: "outage"; mode: "off" | "refuse" | "stall"; seconds?: number };

export async function GET(): Promise<Response> {
  if (!areEmailTestHooksEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { readOutbox } = await import("@/email/fixture/provider");
  return NextResponse.json(
    { messages: await readOutbox() },
    { headers: { "cache-control": "no-store, must-revalidate" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!areEmailTestHooksEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = (await request.json()) as TestEmailRequest;

  if (body.action === "outage") {
    const { setEmailOutage } = await import("@/email/fixture/provider");
    await setEmailOutage({
      mode: body.mode,
      seconds: Number(body.seconds) || 0,
    });
    return NextResponse.json({ ok: true, action: body.action });
  }

  if (body.action !== "reset") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { resetOutbox } = await import("@/email/fixture/provider");
  await resetOutbox();

  return NextResponse.json({ ok: true, action: body.action });
}
