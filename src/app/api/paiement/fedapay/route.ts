import { NextResponse, type NextRequest } from "next/server";

import { getCommerceProvider } from "@/commerce/provider";
import { getPaymentProvider } from "@/payments/provider";

/**
 * Where the payment provider says what happened, and the only thing in this
 * application that can move a Payment State.
 *
 * Everything a buyer's browser does is a suggestion; this is the one caller
 * whose word counts, and only because it proves who it is. The order of what
 * happens below is the security of the whole surface:
 *
 * 1. **A deployment that takes no money has no endpoint.** No payment provider
 *    means 404, not 500 and not 401 — a project with no FedaPay does not
 *    advertise that this address means something.
 * 2. **The body is bounded before it is read.** A signature check over an
 *    unbounded body is work an unauthenticated caller gets to ask for.
 * 3. **The raw body is verified before it is parsed.** The signature is over
 *    bytes, so re-serialising a parsed body and checking that would be checking
 *    something other than what was sent. Nothing is interpreted until the
 *    provider is proved to have sent it.
 * 4. **What comes back says as little as possible.** Every verified delivery
 *    gets the same acknowledgement whatever it turned out to mean, because the
 *    difference between "that transaction is one of ours" and "it is not" is
 *    something a prober would like to know and a provider does not need to.
 *
 * The verification itself is the provider's own and lives in its adapter
 * (ADR-0008): this file knows that events are signed, and nothing about how.
 */

/**
 * The most a payment event can weigh.
 *
 * FedaPay's transaction events are a few kilobytes. Sixty-four leaves room for
 * a provider adding fields without leaving room for a body worth buffering.
 */
const MAX_EVENT_BYTES = 64 * 1024;

/** One answer for every verified delivery, whatever it meant. */
const ACKNOWLEDGED = { received: true } as const;

function refused(status: number): NextResponse {
  // No reason, and never the provider's or the order's. A public endpoint says
  // what happened with its status code and nothing else (issue #1).
  return NextResponse.json({ received: false }, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  const payments = await getPaymentProvider();
  if (!payments) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    return refused(415);
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_EVENT_BYTES) {
    return refused(413);
  }

  const body = await request.text();
  // Checked again against what actually arrived: a `content-length` is a claim,
  // and a chunked request makes none at all.
  if (Buffer.byteLength(body, "utf8") > MAX_EVENT_BYTES) {
    return refused(413);
  }

  const reading = payments.readPaymentEvent({
    body,
    headers: request.headers,
  });

  switch (reading.status) {
    case "unsigned":
      // Logged without the body: an unverified payload is attacker-controlled
      // text, and issue #1 asks for signature failures to be alerted on.
      console.warn("A payment event arrived without a valid signature.");
      return refused(401);
    case "malformed":
      console.warn("A signed payment event could not be read.");
      return refused(400);
    case "ignored":
      // Genuine, and about something WeCreate does not track. Acknowledged
      // rather than refused: a provider told 400 redelivers forever.
      return NextResponse.json(ACKNOWLEDGED);
  }

  const commerce = await getCommerceProvider();
  if (!commerce) {
    // Nowhere to record it. 503 rather than a quiet 200, so the provider
    // redelivers instead of a payment being silently lost.
    console.error("A payment event arrived with no commerce data plane to record it.");
    return refused(503);
  }

  try {
    const record = await commerce.recordPaymentEvent(reading.event);
    // Correlated by the provider's own identifiers, which are not secrets and
    // are what an operator has in front of them in a provider dashboard.
    console.info(
      `Payment event ${reading.event.providerEventType} for transaction ${reading.event.providerTransactionId}: ${record.disposition}.`,
    );
  } catch (error) {
    console.error("Recording a payment event failed.", error);
    // The provider will try again, which is the correct outcome: an event this
    // deployment could not write down has not been processed.
    return refused(500);
  }

  return NextResponse.json(ACKNOWLEDGED);
}
