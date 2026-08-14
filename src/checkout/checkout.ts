import { isPayable, lastAttempt } from "@/commerce/orders";
import type { OrderSnapshot } from "@/commerce/types";
import type { DigitalCartBlocker, DigitalCartView } from "@/digital-cart/cart";
import type {
  EffectiveLegalRevision,
  LegalCheckoutTerms,
} from "@/managed-content/legal";

/**
 * What the checkout is, at the moment a buyer arrives at it.
 *
 * One resolved answer rather than a page assembling conditions of its own,
 * for the reason the Digital Cart has `blockedBy`: every surface — the black
 * ticket, the heading, the form, the control — has to agree about what is
 * happening, and a page that re-derives "may this be paid for" somewhere in its
 * markup will eventually reach a different conclusion from the action that
 * takes the money. The action reads this too, and acts on the same answer.
 *
 * Pure over its inputs, like `cart.ts`: `index.ts` gathers them.
 */

/** Why WeCreate is not taking money at all today. */
export type CheckoutClosure = "legalTermsPending" | "paymentUnavailable";

/**
 * What a visitor is told, in French.
 *
 * Neither sentence names an internal state. A buyer can act on "this is not
 * open yet" and on nothing else this side knows, and a checkout that explained
 * which credential was missing would be telling everyone who asked.
 */
export const CHECKOUT_CLOSURE_LABELS: Record<CheckoutClosure, string> = {
  legalTermsPending:
    "Les conditions de vente de WeCreate ne sont pas encore publiées. La boutique ouvrira dès qu'elles le seront.",
  paymentUnavailable:
    "Le paiement en ligne n'est pas encore activé. Écrivez-nous et nous vous répondrons directement.",
};

export type CheckoutState =
  | { status: "closed"; reason: CheckoutClosure }
  /** An order has already reached the payment provider and is not settled. */
  | { status: "awaitingPayment"; order: OrderSnapshot }
  | { status: "empty" }
  /** Something in the cart has to be settled before an order may be created. */
  | {
      status: "notPayable";
      cart: DigitalCartView;
      blockedBy: DigitalCartBlocker;
    }
  | {
      status: "payable";
      cart: DigitalCartView;
      /** The Legal Revisions this buyer accepts before paying. */
      mustAccept: EffectiveLegalRevision[];
      /**
       * An order this submission pays again rather than replacing.
       *
       * Set only where an earlier attempt never reached the provider and the
       * cart still holds exactly what that order recorded. It is what keeps a
       * transaction-creation failure from becoming a second Order Snapshot.
       */
      resuming: OrderSnapshot | null;
    };

export interface CheckoutInputs {
  /** Whether this deployment has a payment provider at all. */
  canPay: boolean;
  /** The order this browser is already carrying, if the data plane knows one. */
  orderInProgress: OrderSnapshot | undefined;
  /** The Digital Cart, resolved against today's catalogue. */
  cart: DigitalCartView;
  /** Whether a sale may happen, and under which revisions. */
  legal: LegalCheckoutTerms;
}

/**
 * Whether the cart still holds exactly what an order recorded.
 *
 * The question decides whether a buyer is paying again for the order they
 * already have or buying something else. Comparing the SKUs and the amounts is
 * the whole of it: a title that changed since is editorial, and an Order
 * Snapshot keeps the one it recorded either way.
 */
function matchesCart(order: OrderSnapshot, cart: DigitalCartView): boolean {
  return (
    order.lines.length === cart.lines.length &&
    cart.lines.every(
      (line, index) =>
        order.lines[index].sku === line.sku &&
        order.lines[index].unitPriceXof === line.priceXof,
    )
  );
}

/**
 * Which of those a buyer is looking at.
 *
 * The order matters, and each step is the answer to a question the next one
 * cannot ask usefully.
 *
 * Without a payment provider nothing can be paid, not even an order that
 * already exists, so that is first. An order that has already reached the
 * provider comes next, and it is the one case where the checkout offers no way
 * to pay at all: WeCreate cannot yet know whether that payment went through —
 * only a verified webhook can say (issue #11) — and opening a second payment
 * page for the same order is how a buyer pays twice. The legal gate is then
 * what stands between a cart and a *new* order; an order created under terms
 * that were in force stays payable under them. The cart's own answers come
 * last, because they are the only ones a buyer can act on here.
 */
export function resolveCheckout({
  canPay,
  orderInProgress,
  cart,
  legal,
}: CheckoutInputs): CheckoutState {
  if (!canPay) {
    return { status: "closed", reason: "paymentUnavailable" };
  }

  // An order whose window has closed is neither resumed nor shown: issue #1
  // asks for a buyer past it to start again at current prices rather than under
  // commercial terms nobody has looked at for a day.
  const waiting = orderInProgress && isPayable(orderInProgress) ? orderInProgress : undefined;
  const reachedProvider = waiting && lastAttempt(waiting)?.state !== "failed";
  if (waiting && reachedProvider) {
    return { status: "awaitingPayment", order: waiting };
  }

  if (legal.status === "blocked") {
    return { status: "closed", reason: "legalTermsPending" };
  }

  if (cart.isEmpty) {
    return { status: "empty" };
  }

  if (cart.blockedBy) {
    return { status: "notPayable", cart, blockedBy: cart.blockedBy };
  }

  return {
    status: "payable",
    cart,
    mustAccept: legal.mustAccept,
    resuming: waiting && matchesCart(waiting, cart) ? waiting : null,
  };
}
