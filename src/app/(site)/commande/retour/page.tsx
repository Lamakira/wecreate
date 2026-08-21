import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import { readOrderByReference } from "@/checkout";
import { PAYMENT_RETRY_COPY, paymentReturnCopy } from "@/checkout/messages";
import { readOrderInProgress } from "@/checkout/session";
import {
  FULFILLMENT_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATE_MARKS,
  paymentProspect,
} from "@/commerce/orders";
import { CartCleanup } from "@/components/checkout/cart-cleanup";
import {
  BoutiqueLink,
  CheckoutSplit,
  CheckoutStage,
  CheckoutSurface,
} from "@/components/checkout/checkout-layout";
import { OrderAccessRows } from "@/components/checkout/order-access-rows";
import {
  OrderTicket,
  orderTicketLines,
} from "@/components/checkout/order-ticket";
import { PaymentVerification } from "@/components/checkout/payment-verification";
import { readAccessForOrder } from "@/fulfillment";
import { fulfillmentRecovery } from "@/fulfillment/messages";
import { readSiteSettings } from "@/managed-content";
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
 * So the surfaces below are all the *same* surface: a heading, the two states
 * the server has observed, and whatever the buyer can do about it. What the
 * buyer can do is the thing that differs, and it comes from `paymentProspect()`
 * rather than from the Payment State alone — the checkout answers to the same
 * rule, so what is offered here and what the action accepts cannot disagree.
 *
 * While a payment is outstanding it says *Vérification du paiement*, offers no
 * second payment, and says out loud that the page may be closed — verification
 * and, later, delivery continue without it. A payment FedaPay refused says so
 * and offers the order again for twenty-four hours (issue #13); past that, and
 * for an approved payment, it points at the one thing left to do. Each is told
 * apart by its heading, its structure and what it offers, never by a colour.
 *
 * Payment and delivery are printed as two separate facts on purpose (ADR-0005),
 * and the second is what decides everything under the first. An approved
 * payment whose receipt went out lists what was bought and where the files open
 * from; one whose receipt did not still lists what was bought — the grants are
 * made before the message is attempted, so the buyer owns it either way — and
 * adds one way to be helped. Neither offers a second payment.
 */
export default async function PaymentReturnRoute() {
  const reference = await readOrderInProgress();
  const order = reference ? await readOrderByReference(reference) : undefined;
  // Read whatever the delivery produced, whether it finished or not: the grants
  // are made before the receipt is attempted, so a buyer whose email never
  // arrived still owns what they paid for and this page can say so.
  const access = order?.paymentState === "approved" && reference
    ? await readAccessForOrder(reference)
    : undefined;

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

  // One rule, three surfaces: the checkout, this page and Postgres all act on
  // it, so what is offered here and what the action accepts cannot disagree.
  // Waiting is exactly "an attempt is outstanding" — the same thing
  // `/commande/etat` answers and `PaymentVerification` polls for — and both
  // retries offer the order again rather than a new one.
  const prospect = paymentProspect(order);
  const waiting = prospect === "awaiting";
  const retryable = prospect === "resumable" || prospect === "retryable";
  const copy = paymentReturnCopy(order.paymentState, prospect);
  // WeCreate's own administrative address, written once in Managed Content and
  // read here as the header, the footer and the receipt read it.
  const supportEmail = (await readSiteSettings()).contact.email;

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
      {/*
        The cart's contents are committed to the Order Snapshot once the
        payment is approved, so the cart itself is forgotten — a page render
        cannot write a cookie, which is why this is a client component rather
        than a line here.
      */}
      {order.paymentState === "approved" ? <CartCleanup /> : null}
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

        {waiting ? (
          <>
            {/*
              Issue #11 asks this surface to say that processing continues
              without the page, and it does: verification and, once a payment is
              confirmed, delivery both happen server-side. Closing the page
              costs the buyer nothing, and the message they are promised is one
              a system really sends.
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
              {retryable ? PAYMENT_RETRY_COPY.nextStep : copy.nextStep}
            </p>

            {/*
              A link rather than a control that pays: FedaPay needs a buyer's
              name, email and telephone, and the commerce data plane will not
              hand those back for a reference. So the retry goes through the
              page that collects them, which resolves this same order again and
              opens one more attempt against it.
            */}
            {retryable ? (
              <p className="m-0 mt-6">
                <Link
                  href="/commande"
                  data-testid="payment-retry"
                  className="border-b border-wc-pure pb-1 text-body-lg font-semibold"
                >
                  {PAYMENT_RETRY_COPY.action}
                </Link>
              </p>
            ) : null}

            {/*
              Shown and not opened. The token in the buyer's email is what
              authorises a download, and a page reached with the order cookie
              deliberately cannot stand in for it — so these rows carry no
              control, and what is said under them depends on whether the
              message carrying that token actually went out.
            */}
            {access ? (
              <OrderAccessRows access={access} downloadable={false} />
            ) : null}

            {access && order.fulfillmentState === "delivered" ? (
              <p className="m-0 mt-6 text-body-sm font-light text-wc-muted-on-light">
                Vos fichiers s&apos;ouvrent depuis le lien personnel envoyé à{" "}
                {order.buyerEmailHint}.
              </p>
            ) : null}

            {order.fulfillmentState === "failed" ? (
              <p
                data-testid="fulfillment-recovery"
                role="status"
                className="m-0 mt-8 border border-wc-line-light px-5 py-4 text-body font-light text-wc-ink"
              >
                {fulfillmentRecovery(order.reference, supportEmail)}
              </p>
            ) : null}

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
