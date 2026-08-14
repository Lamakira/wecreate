import Link from "next/link";

import { abandonOrderAction } from "@/checkout/actions";
import {
  CHECKOUT_CLOSURE_LABELS,
  type CheckoutClosure,
  type CheckoutState,
} from "@/checkout/checkout";
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
        {resuming ? (
          <p
            data-testid="checkout-resuming"
            className="m-0 mb-7 border border-wc-muted-on-light p-5 text-body font-light text-wc-ink"
          >
            <strong className="font-semibold text-wc-pure">
              Votre commande est déjà enregistrée
            </strong>{" "}
            sous la référence {resuming.reference}, et rien n&apos;a été
            débité. Continuer relance son paiement : cela ne crée pas de seconde
            commande.
          </p>
        ) : null}

        <GuestForm
          totalXof={resuming ? resuming.totalXof : cart.totalXof}
          mustAccept={mustAccept}
        />
      </CheckoutStage>
    </CheckoutSplit>
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
 * Leaving is offered beside it, because an order kept for a day must not be a
 * trap for a buyer who has decided to order something else instead. Abandoning
 * ends this browser's claim to the order; the order itself stays recorded.
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
      </CheckoutStage>
    </CheckoutSplit>
  );
}
