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
 * What the payment return route says, one heading and one paragraph per Payment
 * State.
 *
 * Here rather than on the page for the reason `CART_BLOCKER_LABELS` is beside
 * the cart's rule: the checkout's words live in one file, so a state that gains
 * a meaning gains its sentence in the same edit.
 *
 * Only `pending` can be reached today. The other three are written out rather
 * than left to a later ticket for one reason: a page with no words for a state
 * the database can hold would render nothing at all if it ever met one. Issue
 * #11 gives them their own surfaces, and none of them offers a second payment.
 */
export const PAYMENT_RETURN_COPY: Record<
  PaymentState,
  { heading: string; lede: string }
> = {
  pending: {
    heading: "Vérification du paiement.",
    lede: "Nous attendons la confirmation sécurisée de FedaPay. Ne relancez pas le paiement maintenant : cela peut prendre quelques instants.",
  },
  approved: {
    heading: "Paiement approuvé.",
    lede: "Votre paiement est confirmé. Le reçu et vos accès vous sont envoyés par email.",
  },
  failed: {
    heading: "Paiement non abouti.",
    lede: "Le paiement n'a pas abouti et rien n'a été débité pour cette commande.",
  },
  cancelled: {
    heading: "Paiement annulé.",
    lede: "Le paiement a été annulé et rien n'a été débité.",
  },
};
