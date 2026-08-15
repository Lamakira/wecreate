import { createHmac, randomUUID } from "node:crypto";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { TEST_PAYMENT_WEBHOOK_SECRET } from "../../../playwright.config";

/**
 * Payment events, delivered the way a payment provider delivers them.
 *
 * Issue #1 asks for webhook behaviour to be driven "through Playwright's HTTP
 * request context against the same running application", and that is exactly
 * what this is: a real POST to the real endpoint of the real build, carrying a
 * body and a signature header. Nothing here reaches inside the application.
 *
 * The signature scheme below is the *fixture provider's*, not FedaPay's. The
 * fixture stands in for the provider at the application's outbound boundary, so
 * it signs deliveries the way a provider does — with a shared secret over the
 * raw body — while FedaPay's own scheme lives in the adapter and is proved by
 * `tests/contract/fedapay.spec.ts`. It is spelled out here rather than imported
 * so that changing how the fixture signs has to be a deliberate change to this
 * file too.
 */

/** Where the payment provider delivers its events. */
export const WEBHOOK_PATH = "/api/paiement/fedapay";

/** The provider's own header, carrying the signature over the raw body. */
export const SIGNATURE_HEADER = "x-fedapay-signature";

/** The provider events these scenarios send, in the provider's vocabulary. */
export type PaymentEventName =
  | "transaction.approved"
  | "transaction.canceled"
  | "transaction.declined"
  | "transaction.created"
  | "transaction.transferred";

export interface DeliveryOptions {
  /** The provider's transaction identity, which is how an order is found. */
  transaction: string;
  name: PaymentEventName;
  /** The provider's identity for this delivery. Two deliveries sharing one are the same event. */
  eventId?: string;
  occurredAt?: string;
}

/** One delivery body, exactly as it will be signed and sent. */
export function deliveryBody({
  transaction,
  name,
  eventId = `evt-${randomUUID()}`,
  occurredAt = "2026-08-15T09:30:00.000Z",
}: DeliveryOptions): string {
  return JSON.stringify({
    id: eventId,
    name,
    created_at: occurredAt,
    entity: { id: transaction, klass: "v1/transaction" },
  });
}

/** The fixture's signature over one raw body. */
export function sign(body: string, secret = TEST_PAYMENT_WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * POST one body to the endpoint exactly as written, with a signature over it.
 *
 * The body is sent as bytes rather than as a string, and that is not a detail:
 * given a string and a JSON content type, Playwright re-serialises anything
 * that is not already valid JSON — which would mean signing one body and
 * sending another, and a malformed-event scenario testing nothing at all.
 */
export async function deliver(
  request: APIRequestContext,
  body: string,
  signature: string = sign(body),
): Promise<number> {
  const response = await request.post(WEBHOOK_PATH, {
    headers: {
      "content-type": "application/json",
      [SIGNATURE_HEADER]: signature,
    },
    data: Buffer.from(body, "utf8"),
  });
  return response.status();
}

/**
 * Deliver one event and answer with the endpoint's status.
 *
 * `signature` is overridable so a scenario can send a forged one.
 */
export async function deliverPaymentEvent(
  request: APIRequestContext,
  options: DeliveryOptions & { signature?: string },
): Promise<number> {
  const body = deliveryBody(options);
  return deliver(request, body, options.signature ?? sign(body));
}

/**
 * The provider's transaction identity for the payment this browser just started.
 *
 * The fixture hosted page prints everything WeCreate handed the provider in its
 * own address, which is how a scenario learns the transaction id a real webhook
 * would carry — without reading the application's storage.
 */
export function transactionFromHostedPage(page: Page): string {
  const transaction = new URL(page.url()).searchParams.get("transaction");
  expect(transaction, "the hosted payment page names its transaction").toBeTruthy();
  return transaction as string;
}

/** What `/commande/etat` answers this browser. */
export interface OrderState {
  payment: string;
  fulfillment: string;
  /** Whether a payment on this order is still waiting on a verified event. */
  awaiting: boolean;
}

/**
 * Ask the order-state boundary the way the verification view asks it.
 *
 * From inside the page rather than from the test's own HTTP client, because the
 * order in progress is named by an http-only cookie scoped to `/commande` and
 * the question is precisely whether *this browser* may have an answer.
 */
export async function fetchOrderState(page: Page): Promise<{
  status: number;
  cacheControl: string;
  body: string;
}> {
  return page.evaluate(async () => {
    const response = await fetch("/commande/etat", { cache: "no-store" });
    return {
      status: response.status,
      cacheControl: response.headers.get("cache-control") ?? "",
      body: await response.text(),
    };
  });
}

export async function readOrderState(page: Page): Promise<OrderState> {
  const answer = await fetchOrderState(page);
  expect(answer.status).toBe(200);
  return JSON.parse(answer.body) as OrderState;
}
