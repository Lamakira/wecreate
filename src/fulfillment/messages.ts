import type { DownloadRefusal } from "@/commerce/provider";

/**
 * What the delivery surfaces say, in French.
 *
 * Beside the rules the way `CHECKOUT_MESSAGES` is beside the checkout's: the
 * words for one journey live in one file, so a state that gains a meaning gains
 * its sentence in the same edit.
 *
 * Two things none of these sentences do. **None of them names a mechanism.**
 * No bucket, no token, no signature, no expiry in minutes — a buyer is told
 * that an address is personal and temporary and that asking for another costs
 * nothing, which is everything they can act on (issue #1). **None of them tells
 * a stranger anything.** An expired access and a token nobody was ever given
 * read identically, so working through guesses never reveals that an order
 * exists.
 */

export const ACCESS_COPY = {
  kicker: "Vos accès",
  heading: "Vos fichiers.",
  lede: "Votre paiement est confirmé. Téléchargez vos produits numériques ci-dessous, autant de fois que votre commande le permet.",
  /**
   * Said once, under the rows, rather than on each of them.
   *
   * It promises exactly what is true and nothing more. A link that has stopped
   * working can always be replaced while the access is open — that is the
   * guarantee — and replacing one straight away costs nothing, because a second
   * press inside the same window is the same download. It deliberately does not
   * say that replacing one is *always* free: once the window has passed, the
   * next file handed over is one of the five, and a buyer told otherwise would
   * find their allowance shorter than they were promised.
   */
  note: "Le lien de téléchargement est temporaire. Tant que vos accès sont ouverts, vous pouvez en demander un nouveau ; le redemander tout de suite ne décompte rien.",
} as const;

export const ACCESS_UNAVAILABLE_COPY = {
  kicker: "Commande",
  heading: "Accès expiré ou introuvable.",
  lede: "Ce lien n'ouvre aucune commande. Il a peut-être expiré, ou une nouvelle adresse d'accès a été envoyée depuis.",
} as const;

/** What went wrong when a buyer pressed *Télécharger* and got nothing. */
export const DOWNLOAD_REFUSAL_MESSAGES: Record<DownloadRefusal, string> = {
  // Reached only by a browser whose access went away between the page being
  // drawn and the button being pressed. The page beside it already says the
  // access is gone, so this one only has to explain the press.
  unknownAccess:
    "Vos accès ne sont plus ouverts. Écrivez-nous avec la référence de votre commande.",
  unknownProduct: "Ce produit ne fait pas partie de cette commande.",
  exhausted:
    "Vous avez utilisé tous les téléchargements de ce produit. Écrivez-nous avec la référence de votre commande.",
  unavailable:
    "Le fichier n'a pas pu être préparé à l'instant. Réessayez dans quelques minutes : aucun téléchargement n'a été décompté.",
};

/** Whether a value from the address bar is one of ours. */
export function downloadRefusal(value: string | undefined): DownloadRefusal | null {
  return value && value in DOWNLOAD_REFUSAL_MESSAGES
    ? (value as DownloadRefusal)
    : null;
}

/**
 * What a buyer is told when the payment worked and the delivery did not.
 *
 * It leads with the payment being approved wherever it is shown, never offers
 * another one, and gives one thing to do (issue #1). `supportEmail` and the
 * reference are both in it because a buyer writing in without them cannot be
 * helped quickly, and this is the moment they need help.
 */
export function fulfillmentRecovery(
  reference: string,
  supportEmail: string,
): string {
  return `Votre paiement est bien enregistré, et l'envoi de votre email de confirmation n'a pas abouti. Rien d'autre n'est à payer. Écrivez-nous à ${supportEmail} en indiquant la référence ${reference} : nous vous renvoyons vos accès.`;
}
