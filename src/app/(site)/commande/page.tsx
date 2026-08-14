import type { Metadata } from "next";

import { readCheckout } from "@/checkout";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { keepOutOfSearchResults } from "@/site-config";

export const metadata: Metadata = {
  title: "Commande",
  ...keepOutOfSearchResults(),
};

/**
 * Nothing here can be prerendered, and saying so is honest rather than a
 * deferral: a checkout cannot render before it knows what is in this browser's
 * cart and whether it is already paying for something, and both are cookies.
 */
export const instant = false;

/**
 * Guest checkout: where a Digital Cart becomes an Order Snapshot.
 *
 * Everything the page shows is resolved again on the server at the moment it is
 * shown — every product, its price, whether WeCreate may still sell it, whether
 * a Paid Deliverable Version stands behind it, and which Legal Revisions are in
 * force. The cart cookie contributes identifiers and nothing else, which is why
 * a shopper who edits it changes what they are shown and never what they are
 * charged (issue #1).
 *
 * Out of search results whatever the deployment, like every transaction surface
 * on this site.
 */
export default async function CheckoutRoute() {
  return <CheckoutView state={await readCheckout()} />;
}
