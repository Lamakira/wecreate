import type { PaymentProspect } from "@/commerce/orders";
import type { PaymentState } from "@/commerce/types";

/**
 * What the checkout says when a submission does not become a payment.
 *
 * Each sentence names what the buyer should do next rather than what went
 * wrong, and none of them names a provider, a credential or an internal state:
 * a public error on a transaction surface says as little about the system as it
 * can while still being useful (issue #1).
 */

export type CheckoutMessageKey =
  | "notOpen"
  | "cartChanged"
  | "productWithdrawn"
  | "paymentUnreachable"
  | "alreadyWithProvider"
  | "orderUnavailable";

export const CHECKOUT_MESSAGES: Record<CheckoutMessageKey, string> = {
  notOpen: "La commande n'est pas ouverte pour le moment. Réessayez plus tard.",
  cartChanged:
    "Votre panier a changé pendant la saisie. Vérifiez-le avant de continuer.",
  productWithdrawn:
    "Un produit de votre panier vient d'être retiré de la vente. Rien n'a été débité : vérifiez votre panier.",
  paymentUnreachable:
    "La page de paiement n'a pas pu être ouverte et rien n'a été débité. Vous pouvez réessayer.",
  alreadyWithProvider:
    "Un paiement est déjà en cours pour cette commande. Suivez-le avant d'en lancer un autre.",
  orderUnavailable:
    "Cette commande n'est plus en attente de paiement. Repartez de votre panier.",
};

export function checkoutMessage(key: CheckoutMessageKey | null): string | null {
  return key ? CHECKOUT_MESSAGES[key] : null;
}

/**
 * What the payment return route says, one surface per Payment State.
 *
 * Here rather than on the page for the reason `CART_BLOCKER_LABELS` is beside
 * the cart's rule: the checkout's words live in one file, so a state that gains
 * a meaning gains its sentence in the same edit.
 *
 * They are told apart by their heading, their structure and what a buyer can do
 * next — never by a colour, and never by a symbol carrying the meaning on its
 * own (issue #1). What a buyer can do is not a Payment State's to decide on its
 * own, though, which is why `paymentReturnCopy()` below takes the prospect too:
 * a refusal may be tried again against the same Order Snapshot for twenty-four
 * hours (issue #13), and the same refusal is a dead end once they are up.
 *
 * **`approved` says what happened to the money and nothing about the
 * delivery.** The two are tracked separately (ADR-0005), and on this page they
 * are printed separately: the sentence below settles the payment, and what
 * follows it — the rows of what was bought, where the files open from, or a way
 * to be helped — is decided by the Fulfillment State beside it. A page that
 * announced an email which failed to send would be the one lie this whole
 * surface is built to avoid.
 */
export interface PaymentReturnCopy {
  heading: string;
  lede: string;
  /**
   * What the buyer does now, once nothing more will be collected for this order.
   *
   * Absent while a payment is outstanding: the next thing to do then is nothing
   * at all, and the page says so in its own words. An order that may still be
   * paid has `PAYMENT_RETRY_COPY` instead, and its own control beside it.
   */
  nextStep: string | null;
}

export const PAYMENT_RETURN_COPY: Record<PaymentState, PaymentReturnCopy> = {
  pending: {
    heading: "Vérification du paiement.",
    lede: "Nous attendons la confirmation sécurisée de FedaPay. Ne relancez pas le paiement maintenant : cela peut prendre quelques instants.",
    // Only ever read while a payment is outstanding, which is the one situation
    // with nothing for a buyer to do. A pending order with nothing outstanding
    // is `PAYMENT_UNPAID_COPY` below, because "we are waiting for FedaPay" is
    // not true of an order FedaPay was never asked about.
    nextStep: null,
  },
  approved: {
    heading: "Paiement approuvé.",
    lede: "FedaPay a confirmé votre paiement et votre commande est enregistrée à ce titre. Notez sa référence : c'est elle qui l'identifie partout.",
    nextStep:
      "Le paiement est terminé : il n'y a rien d'autre à régler pour cette commande.",
  },
  failed: {
    heading: "Paiement non abouti.",
    lede: "Le paiement n'a pas abouti et rien n'a été débité pour cette commande.",
    nextStep:
      "Vous pouvez repartir de la boutique et commander à nouveau. Cette commande-ci reste enregistrée sous sa référence, et rien ne sera encaissé pour elle.",
  },
  cancelled: {
    heading: "Paiement annulé.",
    lede: "Le paiement a été annulé et rien n'a été débité pour cette commande.",
    nextStep:
      "Vous pouvez repartir de la boutique quand vous voulez. Cette commande-ci reste enregistrée sous sa référence, et rien ne sera encaissé pour elle.",
  },
};

/**
 * What the page says while a *relaunched* payment is being verified.
 *
 * The heading a retry borrows, because what the buyer is waiting for is what
 * `pending` describes — and the Payment State printed underneath is still the
 * refusal that has not been replaced yet. Saying so is the point: a page
 * leading with *Paiement non abouti* while a fresh transaction is open with
 * FedaPay would invite exactly the second payment this whole surface exists to
 * prevent (issue #13).
 */
const PAYMENT_RETRY_VERIFYING: PaymentReturnCopy = {
  heading: PAYMENT_RETURN_COPY.pending.heading,
  lede: "Vous avez relancé le paiement de cette commande et nous attendons la confirmation sécurisée de FedaPay. Le résultat précédent reste affiché ci-dessous tant que rien n'a été confirmé.",
  nextStep: null,
};

/**
 * What the page says about an order no payment ever succeeded for.
 *
 * A Payment State of `pending` means nothing has confirmed anything, and that
 * covers two situations the `pending` copy above would misdescribe: a payment
 * page that never opened, and a payment nobody ever heard back about before the
 * order's twenty-four hours ran out. Neither is *Nous attendons la confirmation
 * de FedaPay*, because in neither is anything on its way.
 *
 * Its `nextStep` promises no refusal — none was ever recorded — and keeps the
 * one promise this application really does keep, since an approval arriving
 * late still settles the order and still sends the receipt.
 */
const PAYMENT_UNPAID_COPY: PaymentReturnCopy = {
  heading: "Paiement non confirmé.",
  lede: "Aucun paiement n'a été confirmé pour cette commande et rien n'a été débité.",
  nextStep:
    "Aucune confirmation n'est arrivée pendant les 24 heures de cette commande. Vous pouvez repartir de la boutique : si FedaPay confirme malgré tout ce paiement, nous vous écrivons à l'adresse enregistrée avec la commande.",
};

/**
 * Which of those the payment return page leads with.
 *
 * The Payment State alone cannot answer it, because the same recorded refusal
 * means two different things depending on whether a fresh transaction is open
 * against the order (issue #13). The decision lives here, beside the sentences
 * it chooses between, rather than on the page that prints them.
 */
export function paymentReturnCopy(
  state: PaymentState,
  prospect: PaymentProspect,
): PaymentReturnCopy {
  if (state === "pending") {
    return prospect === "awaiting" ? PAYMENT_RETURN_COPY.pending : PAYMENT_UNPAID_COPY;
  }
  return prospect === "awaiting"
    ? PAYMENT_RETRY_VERIFYING
    : PAYMENT_RETURN_COPY[state];
}

/**
 * What the page offers when this order may be paid again.
 *
 * One sentence and one control, and the control is a link back to the checkout
 * rather than a button that pays: the payment provider needs a buyer's name,
 * email and telephone, and the commerce data plane deliberately will not hand
 * those back for a reference (see `openPaymentAttempt`). So the buyer types
 * them again on the page that collects them, and the order they are typing
 * against is named on it.
 */
export const PAYMENT_RETRY_COPY = {
  nextStep: "Vous pouvez reprendre le paiement de cette commande pendant 24 heures à partir de son enregistrement : elle garde ses produits, ses prix et les conditions que vous avez acceptées. Cela ne crée pas de seconde commande et rien ne sera encaissé deux fois.",
  action: "Reprendre le paiement",
} as const;
