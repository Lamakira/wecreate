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
 * The four are told apart by their heading, their structure and what a buyer
 * can do next — never by a colour, and never by a symbol carrying the meaning
 * on its own (issue #1). None of them offers a second payment: WeCreate cannot
 * charge twice for one Order Snapshot, and an order that settled is settled.
 *
 * **`approved` promises nothing WeCreate cannot currently do.** It says the
 * money arrived, which is true and verified, and stops there. Sending the
 * receipt and opening the downloads is fulfillment, it is tracked separately
 * (ADR-0005) and it does not exist yet — issue #12 builds it. A page that
 * announced an email no system will send would be the one lie this whole slice
 * is built to avoid.
 */
export interface PaymentReturnCopy {
  heading: string;
  lede: string;
  /**
   * What the buyer does now, once nothing else is going to change on its own.
   * Absent while the payment is still being verified: the next thing to do then
   * is nothing at all, and the page says so in its own words.
   */
  nextStep: string | null;
}

export const PAYMENT_RETURN_COPY: Record<PaymentState, PaymentReturnCopy> = {
  pending: {
    heading: "Vérification du paiement.",
    lede: "Nous attendons la confirmation sécurisée de FedaPay. Ne relancez pas le paiement maintenant : cela peut prendre quelques instants.",
    nextStep: null,
  },
  approved: {
    heading: "Paiement approuvé.",
    lede: "FedaPay a confirmé votre paiement et votre commande est enregistrée à ce titre. Notez sa référence : c'est elle qui l'identifie partout.",
    nextStep:
      "Nous préparons la suite et vous écrivons à l'adresse de livraison. Si vous avez la moindre question d'ici là, écrivez-nous avec cette référence.",
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
