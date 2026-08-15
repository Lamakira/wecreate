import Link from "next/link";

import { abandonOrderAction } from "@/checkout/actions";
import {
  CHECKOUT_CLOSURE_LABELS,
  type CheckoutClosure,
  type CheckoutState,
} from "@/checkout/checkout";
import { paymentProspect } from "@/commerce/orders";
import type { OrderSnapshot } from "@/commerce/types";
import {
  BoutiqueLink,
  CheckoutSplit,
  CheckoutStage,
  CheckoutSurface,
} from "@/components/checkout/checkout-layout";
import { GuestForm } from "@/components/checkout/guest-form";
import {
  OrderTicket,
  cartTicketLines,
  orderTicketLines,
} from "@/components/checkout/order-ticket";
import {
  CART_BLOCKER_LABELS,
  type DigitalCartBlocker,
  type DigitalCartView,
} from "@/digital-cart/cart";
import type { EffectiveLegalRevision } from "@/managed-content/legal";

/**
 * The checkout, in whichever state a buyer has arrived at it.
 *
 * Five surfaces sharing one composition: the approved Variant C split, with the
 * black Order Snapshot ticket beside a white working surface. Which one is
 * shown was decided in `resolveCheckout()`; nothing here re-derives it, so the
 * heading, the ticket and the control that takes the money cannot disagree
 * about what is happening.
 */
export function CheckoutView({ state }: { state: CheckoutState }) {
  switch (state.status) {
    case "closed":
      return <ClosedCheckout reason={state.reason} />;
    case "empty":
      return <EmptyCheckout />;
    case "awaitingPayment":
      return <AwaitingPayment order={state.order} />;
    case "notPayable":
      return <BlockedCheckout cart={state.cart} blockedBy={state.blockedBy} />;
    case "payable":
      return (
        <PayableCheckout
          cart={state.cart}
          mustAccept={state.mustAccept}
          resuming={state.resuming}
        />
      );
  }
}

function PayableCheckout({
  cart,
  mustAccept,
  resuming,
}: {
  cart: DigitalCartView;
  mustAccept: EffectiveLegalRevision[];
  resuming: OrderSnapshot | null;
}) {
  // Which of the two retries this is. Asked of the rule rather than read off
  // the Payment State here, so this surface and the one that decided to show it
  // cannot end up disagreeing about what a buyer is looking at.
  const retried = resuming ? paymentProspect(resuming) === "retryable" : false;

  return (
    <CheckoutSplit
      ticket={
        // When an order is being paid again, its own ticket: the reference the
        // buyer will quote, and the prices that order recorded rather than the
        // ones the catalogue happens to be publishing now.
        resuming ? (
          <OrderTicket
            reference={resuming.reference}
            lines={orderTicketLines(resuming)}
            totalXof={resuming.totalXof}
            note="Cette commande garde ses produits et ses prix pendant 24 heures."
          />
        ) : (
          <OrderTicket
            lines={cartTicketLines(cart)}
            totalXof={cart.totalXof}
            note="Produits numériques. La livraison part par email dès que le paiement est confirmé."
          />
        )
      }
    >
      <CheckoutStage
        kicker={resuming ? `Commande ${resuming.reference}` : "Paiement · Invité"}
        heading="Où devons-nous livrer vos fichiers ?"
        lede="Votre email reçoit le reçu et l'accès aux téléchargements. Le téléphone au format international sert au paiement Mobile Money. Aucun compte n'est créé."
      >
        {resuming ? <ResumingNotice retried={retried} order={resuming} /> : null}

        <GuestForm
          totalXof={resuming ? resuming.totalXof : cart.totalXof}
          mustAccept={mustAccept}
        />

        {/*
          An order FedaPay refused must not be a trap. This surface offers no
          way past it otherwise: what is being paid is the Order Snapshot, so
          emptying the cart or adding something to it changes nothing here.
          Leaving ends this browser's claim to the order; the order itself stays
          recorded. An attempt that never reached the provider needs no such
          control — that one *is* resolved against the cart, so changing the
          cart is already the way out of it.
        */}
        {retried ? <AbandonOrder /> : null}
      </CheckoutStage>
    </CheckoutSplit>
  );
}

/**
 * What continuing means, when there is already an order behind this form.
 *
 * Two ways a buyer gets here and they are not the same sentence: a payment page
 * that never opened, where nothing has happened yet, and a payment FedaPay
 * refused, where something has. Both end the same way, because it is the thing
 * a buyer most needs to know: pressing the button again does not create a
 * second order.
 */
function ResumingNotice({
  retried,
  order,
}: {
  retried: boolean;
  order: OrderSnapshot;
}) {
  return (
    <p
      data-testid="checkout-resuming"
      className="m-0 mb-7 border border-wc-muted-on-light p-5 text-body font-light text-wc-ink"
    >
      {retried ? (
        <>
          <strong className="font-semibold text-wc-pure">
            Le paiement de cette commande n&apos;a pas abouti
          </strong>{" "}
          et rien n&apos;a été débité. Reprendre le paiement utilise la commande{" "}
          {order.reference} telle qu&apos;elle a été enregistrée — ses produits,
          ses prix et les conditions que vous avez acceptées : cela ne crée pas
          de seconde commande.
        </>
      ) : (
        <>
          <strong className="font-semibold text-wc-pure">
            Votre commande est déjà enregistrée
          </strong>{" "}
          sous la référence {order.reference}, et rien n&apos;a été débité.
          Continuer relance son paiement : cela ne crée pas de seconde commande.
        </>
      )}
    </p>
  );
}

/**
 * Stop carrying this order, and get the checkout back.
 *
 * On both surfaces that hold a buyer to one order — a payment already with the
 * provider, and one being paid again — for the same reason: an order kept for
 * twenty-four hours must not stand between somebody and buying something else.
 * The order itself is untouched, and stays diagnosable under its reference.
 */
function AbandonOrder() {
  return (
    <form action={abandonOrderAction} className="mt-8">
      <button
        type="submit"
        data-testid="order-abandon"
        className="border-b border-wc-muted-on-light pb-1 text-micro tracking-20 uppercase text-wc-muted-on-light transition-colors duration-300 hover:border-wc-pure hover:text-wc-pure"
      >
        Commander autre chose
      </button>
      <p className="m-0 mt-3 text-body-sm font-light text-wc-muted-on-light">
        Cette commande reste enregistrée sous sa référence. Nous
        n&apos;encaisserons rien pour elle sans confirmation de FedaPay.
      </p>
    </form>
  );
}

function BlockedCheckout({
  cart,
  blockedBy,
}: {
  cart: DigitalCartView;
  blockedBy: DigitalCartBlocker;
}) {
  return (
    <CheckoutSplit
      ticket={
        <OrderTicket
          lines={cartTicketLines(cart)}
          totalXof={cart.totalXof}
          note="Ces montants sont les prix publiés aujourd'hui."
        />
      }
    >
      <CheckoutStage
        kicker="Panier · Vérification"
        heading="Votre panier demande une vérification."
        lede="Un point reste à régler avant de payer. Ouvrez votre panier pour le corriger, puis revenez ici."
      >
        <p
          data-testid="checkout-blocker"
          className="m-0 text-body-lg font-semibold"
        >
          {CART_BLOCKER_LABELS[blockedBy]}
        </p>
        <BoutiqueLink />
      </CheckoutStage>
    </CheckoutSplit>
  );
}

function EmptyCheckout() {
  return (
    <CheckoutSurface>
      <CheckoutStage
        kicker="Panier numérique"
        heading="Votre panier est vide."
        lede="Ajoutez un produit depuis la boutique pour passer commande."
      >
        <BoutiqueLink />
      </CheckoutStage>
    </CheckoutSurface>
  );
}

function ClosedCheckout({ reason }: { reason: CheckoutClosure }) {
  return (
    <CheckoutSurface>
      <CheckoutStage
        kicker="Boutique"
        heading="La commande n'est pas encore ouverte."
        lede={CHECKOUT_CLOSURE_LABELS[reason]}
      >
        <p className="m-0 text-body font-light text-wc-ink">
          Vous pouvez continuer à parcourir les produits : rien n&apos;est
          débité et aucune commande n&apos;est enregistrée.
        </p>
        <BoutiqueLink />
      </CheckoutStage>
    </CheckoutSurface>
  );
}

/**
 * An order that has already reached the payment provider.
 *
 * The one surface of the checkout that offers no way to pay, and deliberately.
 * WeCreate cannot yet know whether that payment went through — only a verified
 * webhook may say so (issue #11) — and a second payment page for the same order
 * is how somebody pays twice. So this points at the verification page and stops.
 *
 * It is where an order sits while a payment is outstanding, whether that is its
 * first or the one a buyer relaunched (issue #13): what makes a second payment
 * dangerous is that nothing has answered the last one, and that is the same
 * either way.
 */
function AwaitingPayment({ order }: { order: OrderSnapshot }) {
  return (
    <CheckoutSplit
      ticket={
        <OrderTicket
          reference={order.reference}
          lines={orderTicketLines(order)}
          totalXof={order.totalXof}
          note="Cette commande garde ses produits et ses prix pendant 24 heures."
        />
      }
    >
      <CheckoutStage
        kicker={`Commande ${order.reference}`}
        heading="Un paiement est déjà en cours."
        lede="Cette commande a été transmise à FedaPay et nous attendons sa confirmation. Ne relancez pas le paiement : vous risqueriez de payer deux fois."
      >
        <p className="m-0">
          <Link
            href="/commande/retour"
            data-testid="follow-payment"
            className="border-b border-wc-pure pb-1 text-body-lg font-semibold"
          >
            Suivre mon paiement
          </Link>
        </p>

        <AbandonOrder />
      </CheckoutStage>
    </CheckoutSplit>
  );
}
