import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { keepOutOfSearchResults } from "@/site-config";

export const metadata: Metadata = {
  title: "Commande",
  ...keepOutOfSearchResults(),
};

/**
 * Where the Digital Cart's *Passer commande* leads.
 *
 * Guest checkout, the Order Snapshot and the FedaPay redirect are issue #10's,
 * and this page is what it replaces — the shared placeholder rather than copy
 * of its own, because the words belong to the ticket that builds the page. It
 * exists now for the reason the six navigation routes existed before their own
 * tickets landed: an action that leads nowhere is not an action, and the cart's
 * checkout control has to be a real one before its availability can mean
 * anything.
 *
 * Out of search results whatever the deployment. Issue #1 asks for every
 * checkout and transaction surface to be non-indexable, and this address is one
 * from the day it exists rather than from the day it does something.
 */
export default function CheckoutRoute() {
  return <PlaceholderPage title="Commande" />;
}
