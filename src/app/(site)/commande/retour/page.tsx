import type { Metadata } from "next";
import type { ReactNode } from "react";

import { readOrderByReference } from "@/checkout";
import { PAYMENT_RETURN_COPY } from "@/checkout/messages";
import { readOrderInProgress } from "@/checkout/session";
import { PAYMENT_STATE_LABELS } from "@/commerce/orders";
import {
  BoutiqueLink,
  CheckoutSplit,
  CheckoutStage,
  CheckoutSurface,
} from "@/components/checkout/checkout-layout";
import {
  OrderTicket,
  orderTicketLines,
} from "@/components/checkout/order-ticket";
import { keepOutOfSearchResults } from "@/site-config";

export const metadata: Metadata = {
  title: "Retour de paiement",
  ...keepOutOfSearchResults(),
};

export const instant = false;

/**
 * Where FedaPay sends the browser back to.
 *
 * **It reads nothing the browser brought with it.** This route declares no
 * `searchParams` at all, so whatever a provider appends — a transaction id, a
 * status, an approval somebody typed into the address bar — is not merely
 * distrusted, it is never looked at. What it reports is what the commerce data
 * plane has recorded for the order this browser is carrying, and the only thing
 * that can move a Payment State is a verified webhook, which issue #11 builds.
 *
 * So today it says *Vérification du paiement* and keeps saying it. That is the
 * true answer while nothing has confirmed the payment, and issue #1 is explicit
 * that a browser returning from a payment page is not evidence of one: the page
 * leads with reassurance, says the buyer may close it, and offers no premature
 * success language and no second payment.
 */
export default async function PaymentReturnRoute() {
  const reference = await readOrderInProgress();
  const order = reference ? await readOrderByReference(reference) : undefined;

  if (!order) {
    return (
      <CheckoutSurface>
        <CheckoutStage
          kicker="Commande"
          heading="Aucune commande à afficher."
          lede="Cette page suit un paiement en cours. Si vous venez de payer, le reçu et vos accès arrivent par email."
        >
          <BoutiqueLink />
        </CheckoutStage>
      </CheckoutSurface>
    );
  }

  return (
    <CheckoutSplit
      ticket={
        <OrderTicket
          reference={order.reference}
          lines={orderTicketLines(order)}
          totalXof={order.totalXof}
          note="Ce ticket garde les produits et les prix de votre commande."
        />
      }
    >
      <CheckoutStage
        kicker={`Commande ${order.reference} · Retour FedaPay`}
        heading={PAYMENT_RETURN_COPY[order.paymentState].heading}
        lede={PAYMENT_RETURN_COPY[order.paymentState].lede}
      >
        <dl className="m-0 grid gap-5 sm:grid-cols-2">
          <Fact label="Paiement">
            <span data-testid="order-payment-state">
              {PAYMENT_STATE_LABELS[order.paymentState]}
            </span>
          </Fact>
          <Fact label="Livraison">
            <span data-testid="order-delivery">
              Vers {order.buyerEmailHint}
            </span>
          </Fact>
        </dl>

        {order.paymentState === "pending" ? (
          <p className="m-0 mt-8 text-body-lg font-light text-wc-ink">
            <strong className="font-semibold">
              Vous pouvez fermer cette page.
            </strong>{" "}
            La vérification continue sans elle. Dès que le paiement est
            confirmé, le reçu et vos téléchargements partent vers{" "}
            {order.buyerEmailHint}.
          </p>
        ) : (
          <p className="m-0 mt-8 text-body-lg font-light text-wc-ink">
            Votre commande reste enregistrée sous la référence{" "}
            {order.reference}. Écrivez-nous avec cette référence si vous avez
            besoin d&apos;aide.
          </p>
        )}
      </CheckoutStage>
    </CheckoutSplit>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-wc-line-light pt-4">
      <dt className="m-0 text-micro tracking-26 uppercase text-wc-muted-on-light">
        {label}
      </dt>
      <dd className="m-0 mt-2 text-body font-semibold">{children}</dd>
    </div>
  );
}
