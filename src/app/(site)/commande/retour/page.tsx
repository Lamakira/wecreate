import type { Metadata } from "next";
import type { ReactNode } from "react";

import { readOrderByReference } from "@/checkout";
import { PAYMENT_RETURN_COPY } from "@/checkout/messages";
import { readOrderInProgress } from "@/checkout/session";
import {
  FULFILLMENT_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATE_MARKS,
} from "@/commerce/orders";
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
import { PaymentVerification } from "@/components/checkout/payment-verification";
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
 * that put it there is a verified webhook (`/api/paiement/fedapay`).
 *
 * So the four surfaces below are all the *same* surface: a heading, the two
 * states the server has observed, and whatever the buyer can do about it. While
 * nothing has confirmed the payment it says *Vérification du paiement*, offers
 * no second payment, and says out loud that the page may be closed —
 * verification and, later, delivery continue without it. When a webhook has
 * decided the matter it says which way, in words and structure rather than in a
 * colour, and points at the one thing left to do.
 *
 * Payment and delivery are printed as two separate facts on purpose (ADR-0005).
 * An approved payment whose delivery has not started is the ordinary state of a
 * fresh order and the only one WeCreate can currently reach — saying so is
 * honest, and promising an email no system yet sends would not be.
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

  const copy = PAYMENT_RETURN_COPY[order.paymentState];
  const awaiting = order.paymentState === "pending";

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
        heading={copy.heading}
        lede={copy.lede}
      >
        <dl className="m-0 grid gap-5 sm:grid-cols-2">
          <Fact label="Paiement">
            {/*
              Decoration for a reader scanning the page, and hidden from
              assistive technology: the label beside it carries the meaning, so
              nothing is lost by not seeing the mark (issue #1).
            */}
            <span
              data-testid="payment-state-mark"
              aria-hidden="true"
              className="mr-2 text-wc-muted-on-light"
            >
              {PAYMENT_STATE_MARKS[order.paymentState]}
            </span>
            <span data-testid="order-payment-state">
              {PAYMENT_STATE_LABELS[order.paymentState]}
            </span>
          </Fact>
          <Fact label="Livraison">
            <span data-testid="order-fulfillment">
              {FULFILLMENT_STATE_LABELS[order.fulfillmentState]}
            </span>
          </Fact>
          <Fact label="Email de livraison">
            <span data-testid="order-delivery">{order.buyerEmailHint}</span>
          </Fact>
        </dl>

        {awaiting ? (
          <>
            {/*
              Issue #11 asks this surface to say that processing continues
              without the page, and it does — without promising the automatic
              delivery that does not exist until issue #12. "Nous vous écrivons"
              is what WeCreate can do today and what the approved surface says
              too, so a buyer reads the same commitment on both.
            */}
            <p className="m-0 mt-8 text-body-lg font-light text-wc-ink">
              <strong className="font-semibold">
                Vous pouvez fermer cette page.
              </strong>{" "}
              La vérification continue sans elle : elle ne dépend ni de cette
              fenêtre ni de votre connexion. Dès que le paiement est confirmé,
              nous vous écrivons à {order.buyerEmailHint}.
            </p>
            <PaymentVerification />
          </>
        ) : (
          <>
            {/*
              The reference is not repeated here: the ticket prints it and the
              kicker above names it, and a third copy on one screen is noise
              rather than emphasis.
            */}
            <p
              data-testid="payment-next-step"
              className="m-0 mt-8 text-body-lg font-light text-wc-ink"
            >
              {copy.nextStep}
            </p>
            <BoutiqueLink />
          </>
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
