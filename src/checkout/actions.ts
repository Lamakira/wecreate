"use server";

import { redirect } from "next/navigation";

import { newOrderReference } from "@/commerce/orders";
import {
  getCommerceProvider,
  type CommerceProvider,
  type PaymentAttemptOutcome,
} from "@/commerce/provider";
import type { BuyerContact, OrderSnapshot, PaymentAttempt } from "@/commerce/types";
import type { DigitalCartLine } from "@/digital-cart/cart";
import type { EffectiveLegalRevision } from "@/managed-content/legal";
import { getPaymentProvider, type PaymentProvider } from "@/payments/provider";
import { PaymentProviderUnreachable } from "@/payments/types";
import { siteUrl } from "@/site-config";

import type { CheckoutFormState } from "./form";
import { isAccepted, readGuestDetails, type GuestFormValues } from "./guest";
import { readCheckout } from "./index";
import type { CheckoutMessageKey } from "./messages";
import { clearOrderInProgress, writeOrderInProgress } from "./session";

/**
 * Starting a payment, and giving up on one.
 *
 * Server Functions rather than an endpoint, for the reasons the Digital Cart's
 * are: they write a cookie, which a page cannot, and Next.js refuses one
 * invoked from another origin, which is the CSRF protection issue #1 asks for
 * on a state-changing surface.
 *
 * `startPaymentAction` is an entry point in its own right. The page does not
 * render the guest form unless the checkout is payable, and this asks again
 * anyway — a form is not a security boundary, and everything that decides what
 * a buyer is charged is resolved here, at the moment the order is written, from
 * published content and the commerce data plane. Nothing that arrived in a
 * request decides a price, a product, a total or which terms were accepted.
 *
 * The order in which things happen is the point of the whole file: the Order
 * Snapshot and its pending attempt are written **before** a payment provider is
 * contacted, so a transaction that reached FedaPay always has a record on this
 * side to explain it.
 */

function submitted(formData: FormData): GuestFormValues {
  const field = (name: string) => String(formData.get(name) ?? "");
  return {
    fullName: field("fullName"),
    email: field("email"),
    telephone: field("telephone"),
    company: field("company"),
  };
}

/**
 * Record what the provider answered, and say whether that was written down.
 *
 * A payment page WeCreate cannot record the transaction id for is one it will
 * not send a buyer to: the id is how a later webhook is matched to this order
 * (issue #11), and an unrecorded redirect is a payment nobody could reconcile.
 * The attempt stays `pending`, which is the honest state and a diagnosable one.
 */
async function settle(
  commerce: CommerceProvider,
  attemptId: string,
  outcome: PaymentAttemptOutcome,
): Promise<boolean> {
  try {
    await commerce.settlePaymentAttempt(attemptId, outcome);
    return true;
  } catch (error) {
    console.error("Recording a payment attempt failed.", error);
    return false;
  }
}

/**
 * Hand one attempt to the payment provider, and return where the buyer pays.
 *
 * `null` means there is nowhere to send them, and the attempt says why. The
 * order is untouched either way: nothing here may move a Payment State, and a
 * buyer who never reached a payment page has certainly not paid.
 */
async function handOff(
  commerce: CommerceProvider,
  payments: PaymentProvider,
  order: OrderSnapshot,
  attempt: PaymentAttempt,
  buyer: BuyerContact,
): Promise<string | null> {
  let redirectUrl: string;
  let providerTransactionId: string;

  try {
    const hosted = await payments.createHostedPayment({
      reference: order.reference,
      // The total the data plane computed from the lines it stored. No amount
      // that travelled through a browser reaches a payment provider.
      amountXof: order.totalXof,
      // What the buyer reads on the provider's page. The reference and nothing
      // else: a description is stored by the provider and shown in its
      // dashboard, and neither is a place for a buyer's details.
      description: `Commande ${order.reference} · WeCreate`,
      buyer: {
        fullName: buyer.fullName,
        email: buyer.email,
        telephone: buyer.telephone,
      },
      returnUrl: `${siteUrl()}/commande/retour`,
    });
    redirectUrl = hosted.redirectUrl;
    providerTransactionId = hosted.providerTransactionId;
  } catch (error) {
    const reason =
      error instanceof PaymentProviderUnreachable
        ? error.message
        : "the payment provider failed unexpectedly";
    // Correlated by the order reference, which is not a secret, and carrying
    // nothing about the buyer (issue #1).
    console.error(`No payment page for ${order.reference}: ${reason}`);
    await settle(commerce, attempt.id, { status: "failed", reason });
    return null;
  }

  const recorded = await settle(commerce, attempt.id, {
    status: "redirected",
    providerTransactionId,
  });
  return recorded ? redirectUrl : null;
}

/** Both providers, or neither: a checkout needs somewhere to write and someone to pay. */
async function providers(): Promise<
  { commerce: CommerceProvider; payments: PaymentProvider } | undefined
> {
  const [commerce, payments] = await Promise.all([
    getCommerceProvider(),
    getPaymentProvider(),
  ]);
  return commerce && payments ? { commerce, payments } : undefined;
}

/**
 * Create the Order Snapshot and leave for the payment page.
 *
 * `previous` is untouched: everything this decides is read again from the
 * server, and what the buyer typed arrives in `formData`.
 */
export async function startPaymentAction(
  previous: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const values = submitted(formData);
  const refuse = (message: CheckoutMessageKey): CheckoutFormState => ({
    refusals: {},
    message,
    values,
  });

  const state = await readCheckout();
  if (state.status !== "payable") {
    return refuse(
      state.status === "closed"
        ? "notOpen"
        : state.status === "awaitingPayment"
          ? "alreadyWithProvider"
          : "cartChanged",
    );
  }

  const submission = readGuestDetails(
    values,
    state.mustAccept,
    formData.getAll("accept").map(String),
  );
  if (!isAccepted(submission)) {
    return { refusals: submission.refusals, message: null, values };
  }

  const both = await providers();
  if (!both) return refuse("notOpen");

  /*
   * An order whose payment page never opened is paid again rather than
   * replaced: a new attempt against the same Order Snapshot, with the products
   * and the prices it recorded. That is what issue #10 asks of a
   * transaction-creation failure, and `resolveCheckout()` is what decides
   * whether this submission is one — it is set only where the last attempt
   * never reached the provider and the cart still holds exactly what the order
   * recorded.
   *
   * The contact details the attempt is made with are the ones in front of us,
   * because the buyer just typed them. The Order Snapshot keeps the ones it
   * recorded, which is what WeCreate is bound by and where a receipt goes;
   * correcting those is an audited support action (issue #15).
   */
  const opened = state.resuming
    ? await both.commerce.openPaymentAttempt(state.resuming.reference)
    : await create(both.commerce, {
        lines: state.cart.lines,
        buyer: submission.details,
        mustAccept: state.mustAccept,
        provider: both.payments.id,
      });

  if (opened.status === "refused") {
    // The order was settled or withdrawn between the page and the button. This
    // browser should stop pointing at it, and the buyer is sent back to a cart
    // that still holds everything.
    await clearOrderInProgress();
    return refuse("orderUnavailable");
  }
  if (opened.status === "withoutDeliverable") {
    return refuse("productWithdrawn");
  }

  // Written before the provider is contacted, so a request that dies in flight
  // still leaves this browser pointing at the order it created.
  await writeOrderInProgress(opened.order.reference);

  const url = await handOff(
    both.commerce,
    both.payments,
    opened.order,
    opened.attempt,
    submission.details,
  );
  if (!url) return refuse("paymentUnreachable");

  redirect(url);
}

/** One outcome for both ways an attempt comes to exist. */
type OpenedAttempt =
  | { status: "opened"; order: OrderSnapshot; attempt: PaymentAttempt }
  | { status: "refused" }
  | { status: "withoutDeliverable" };

/** Everything a new Order Snapshot is written from. */
interface NewOrder {
  lines: readonly DigitalCartLine[];
  buyer: BuyerContact;
  mustAccept: readonly EffectiveLegalRevision[];
  provider: PaymentProvider["id"];
}

/** Write a new Order Snapshot, with the first attempt against it. */
async function create(
  commerce: CommerceProvider,
  { lines, buyer, mustAccept, provider }: NewOrder,
): Promise<OpenedAttempt> {
  const reference = newOrderReference();
  const created = await commerce.createOrder({
    reference,
    lines: lines.map((line) => ({
      productId: line.id,
      sku: line.sku,
      title: line.title,
      // Today's published price, which `payable` guarantees is also the amount
      // this buyer accepted.
      unitPriceXof: line.priceXof,
    })),
    buyer,
    // The identities the server resolved, not the ones the form named: a
    // checkbox says *that* a revision was accepted, and this says which.
    acceptedLegal: mustAccept.map((revision) => ({
      kind: revision.kind,
      revisionId: revision.revisionId,
      effectiveFrom: revision.effectiveFrom,
    })),
    provider,
  });

  if (created.status === "refused") {
    console.error(
      `Order ${reference} not created: no active Paid Deliverable Version for ${created.skusWithoutDeliverable.join(", ")}`,
    );
    return { status: "withoutDeliverable" };
  }

  return { status: "opened", order: created.order, attempt: created.attempt };
}

/**
 * Stop carrying this order.
 *
 * The order itself stays where it is, pending and diagnosable. What this ends
 * is the browser's claim to it, so a buyer whose payment is still unconfirmed
 * is not held to it for a day when what they wanted was to buy something else.
 */
export async function abandonOrderAction(): Promise<void> {
  await clearOrderInProgress();
  redirect("/commande");
}
