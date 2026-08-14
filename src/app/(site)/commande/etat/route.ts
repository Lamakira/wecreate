import { NextResponse } from "next/server";

import { readOrderInProgress } from "@/checkout/session";
import { getCommerceProvider } from "@/commerce/provider";
import type { FulfillmentState, PaymentState } from "@/commerce/types";

/**
 * Where an order stands, for the page watching it.
 *
 * The verification view polls this while a buyer waits, so three things about
 * it are deliberate.
 *
 * The order-state boundary, in the vocabulary of CONTEXT.md: a Payment State
 * and a Fulfillment State, never an "order status".
 *
 * **It answers about the order this browser is carrying, not one it names.** No
 * reference in the path, no reference in a query — the http-only cookie the
 * checkout set is what identifies the order, which is why this route lives
 * under `/commande` rather than under `/api`: that is where the cookie is
 * scoped. A reference in a URL is a reference in an access log, a referrer and
 * a browser history.
 *
 * **It answers two words.** Not an order with two fields read off it — see
 * `OrderState`. A surface polled every few seconds is the last place to hand
 * back a total, a product or an address, even a masked one.
 *
 * **Uncertainty is `unknown`, never a failure.** A browser with no order, an
 * order nobody here has heard of and a data plane that cannot be reached all
 * answer the same way, and the page waiting on it keeps waiting. Issue #1 is
 * explicit that connectivity uncertainty must never become a failed payment.
 */

/**
 * What this route answers, which is not quite what the data plane holds.
 *
 * `unknown` lives here and only here: it is not a fifth Payment State but this
 * boundary saying it cannot tell — a browser with no order, an order nobody
 * knows, a data plane that did not answer. The page reading it treats all three
 * as "keep waiting", and never as a failure.
 */
interface OrderStateBody {
  payment: PaymentState | "unknown";
  fulfillment: FulfillmentState | "unknown";
}

const NOTHING: OrderStateBody = { payment: "unknown", fulfillment: "unknown" };

export async function GET(): Promise<Response> {
  return NextResponse.json(await orderState(), {
    headers: {
      // Payment truth changes underneath this address by definition. Nothing
      // between here and the browser may keep an answer.
      "cache-control": "no-store, must-revalidate",
    },
  });
}

async function orderState(): Promise<OrderStateBody> {
  const reference = await readOrderInProgress();
  if (!reference) return NOTHING;

  const provider = await getCommerceProvider();
  if (!provider) return NOTHING;

  try {
    return (await provider.readOrderState(reference)) ?? NOTHING;
  } catch (error) {
    console.error(`Reading the state of order ${reference} failed.`, error);
    return NOTHING;
  }
}
