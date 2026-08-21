"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ACTION_SIZES } from "@/components/primitives/action";
import { SideDrawer } from "@/components/shell/side-drawer";
import {
  CART_BLOCKER_LABELS,
  hasPriceChanged,
  type DigitalCartLine,
} from "@/digital-cart/cart";
import { useDigitalCart, type DigitalCart } from "@/digital-cart/use-digital-cart";
import { formatXof } from "@/lib/format";
import { AVAILABILITY_LABELS } from "@/managed-content/digital-products";
import { track } from "@/measurement";

/** Where a shopper goes once their cart is ready. Issue #10 builds it. */
const CHECKOUT_PATH = "/commande";

/**
 * The Digital Cart drawer: what is in the cart, what it costs, and whether it
 * may go any further.
 *
 * Quick review and removal on a phone, with the checkout action anchored to the
 * bottom of the panel while the products scroll above it — the shape issue #1
 * asks for, and `SideDrawer`'s. Form entry is not here: it belongs to a page of
 * its own, so a small screen is not asked to hold a drawer and a form at once.
 *
 * Two things can hold a cart up, and both are said out loud rather than left
 * for the shopper to discover at payment. A product WeCreate has withdrawn
 * stays listed with the reason, because a line that vanished would look like a
 * bug. And a price published since the shopper last looked is shown at its new
 * amount, taking effect only once they say so.
 */
export function CartDrawer() {
  const cart = useDigitalCart();
  const router = useRouter();
  const { view } = cart;

  // `canCheckOut` is the shop's own answer, decided where the cart was
  // reconciled. Nothing here re-derives it; the sentence beside the control
  // only puts it into words.
  const isBlocked = !view.canCheckOut || cart.isBusy;

  return (
    <SideDrawer
      isOpen={cart.isOpen}
      onClose={cart.close}
      label="Panier"
      closeLabel="Fermer le panier"
      testId="digital-cart-drawer"
      isBusy={cart.isBusy}
      heading={`Panier · ${cart.itemCount}`}
      footer={
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <span className="text-micro tracking-26 uppercase text-wc-muted-2">
              Total
            </span>
            <span data-testid="cart-total" className="font-display text-[26px]">
              {formatXof(view.totalXof)}
            </span>
          </div>

          {/* Always present, and the drawer's one live region. Removing the
              last unavailable product is what makes checkout reachable, and
              removing the last product of all empties the cart — a region that
              came and went with the button would announce neither. */}
          <p
            role="status"
            id="cart-state"
            data-testid="cart-state"
            className="m-0 text-body-sm font-light text-wc-muted-2"
          >
            {cartState(cart)}
          </p>

          {view.isEmpty ? null : (
            <button
              type="button"
              data-testid="cart-checkout"
              aria-disabled={isBlocked ? true : undefined}
              aria-describedby="cart-state"
              onClick={() => {
                if (isBlocked) return;
                track({ name: "checkout_started" });
                cart.close();
                router.push(CHECKOUT_PATH);
              }}
              // `aria-disabled` rather than `disabled`: the control keeps its
              // place in the tab order, so a keyboard or screen-reader user
              // reaches it and is told why it will not move yet.
              className={`${ACTION_SIZES.block} transition-opacity duration-300 ${
                isBlocked
                  ? "cursor-not-allowed bg-wc-surface-2 text-wc-muted-2"
                  : "bg-wc-white text-wc-pure hover:opacity-75"
              }`}
            >
              Passer commande
            </button>
          )}
        </div>
      }
    >
      {cart.hasFailed ? (
        <p
          data-testid="cart-error"
          className="mt-5 border border-wc-line-darker p-4 text-body-sm font-light text-wc-soft"
        >
          L&apos;opération n&apos;a pas abouti. Réessayez.
        </p>
      ) : null}

      {view.unresolvedCount > 0 ? (
        <p
          data-testid="cart-unresolved"
          className="mt-5 border border-wc-line-darker p-4 text-body-sm font-light text-wc-soft"
        >
          {view.unresolvedCount === 1
            ? "Un article de votre panier n'est plus au catalogue : il en a été retiré."
            : `${view.unresolvedCount} articles de votre panier ne sont plus au catalogue : ils en ont été retirés.`}
        </p>
      ) : null}

      {/* Above the products rather than below them: it is the thing standing
          between the shopper and checkout, and on a phone a long list would
          otherwise bury the control that clears it. */}
      {view.hasPriceChanges ? (
        <div
          data-testid="cart-price-change-notice"
          className="mt-5 mb-1 border border-wc-line-darker p-4"
        >
          <p className="m-0 text-body-sm font-light text-wc-soft">
            Le prix de votre panier a changé depuis votre dernière visite.
            Vérifiez les nouveaux montants avant de continuer.
          </p>
          <button
            type="button"
            data-testid="cart-acknowledge-prices"
            onClick={cart.acknowledgePrices}
            className={`mt-4 ${ACTION_SIZES.block} border border-wc-border text-wc-white transition-colors duration-300 hover:border-wc-white hover:bg-wc-surface-2`}
          >
            Accepter les nouveaux prix
          </button>
        </div>
      ) : null}

      {view.isEmpty ? (
        // What to do about it, rather than a second copy of the state sentence
        // in the footer — and nothing at all until the shop has answered, so an
        // unread cart is never described as an empty one.
        cart.isLoaded ? (
          <p className="py-8 text-body font-light text-wc-muted-2">
            Ajoutez un produit depuis la boutique.
          </p>
        ) : null
      ) : (
        <ul className="list-none p-0">
          {view.lines.map((line) => (
            <CartLine
              key={line.id}
              line={line}
              onFollow={cart.close}
              onRemove={() => cart.remove(line.id)}
            />
          ))}
        </ul>
      )}
    </SideDrawer>
  );
}

interface CartLineProps {
  line: DigitalCartLine;
  onFollow: () => void;
  onRemove: () => void;
}

/**
 * One product in the cart.
 *
 * The price shown is always today's published one, and it is the only amount
 * printed: what the shopper accepted before lives in the cookie, and nothing
 * out of the cookie is put on screen or charged. That a price has moved is
 * stated in words, never signalled by a colour.
 *
 * Nothing here is disabled while the shop is answering. Disabling the control a
 * visitor has just pressed takes focus away from them, and the actions queue
 * anyway: pressing *Retirer* twice removes the product once.
 */
function CartLine({ line, onFollow, onRemove }: CartLineProps) {
  return (
    <li
      data-testid="cart-line"
      data-product={line.id}
      data-availability={line.availability}
      className="flex gap-3.5 border-b border-wc-line-darker py-5"
    >
      <div className="flex flex-1 flex-col items-start">
        <Link
          href={line.path}
          onClick={onFollow}
          className="text-body font-medium transition-opacity duration-300 hover:opacity-70"
        >
          {line.title}
        </Link>

        {line.availability === "available" ? null : (
          <p
            data-testid="cart-line-unavailable"
            className="m-0 mt-1.5 text-body-sm font-light text-wc-muted-2"
          >
            {AVAILABILITY_LABELS[line.availability]} - retirez ce produit pour
            continuer.
          </p>
        )}

        {hasPriceChanged(line) ? (
          <p
            data-testid="cart-line-price-change"
            className="m-0 mt-1.5 text-body-sm font-light text-wc-muted-2"
          >
            Nouveau prix depuis votre dernière visite.
          </p>
        ) : null}

        <button
          type="button"
          data-testid="cart-line-remove"
          onClick={onRemove}
          className="mt-2.5 border-b border-wc-line-darker pb-1 text-micro tracking-20 uppercase text-wc-muted-2 transition-colors duration-300 hover:border-wc-white hover:text-wc-white"
        >
          Retirer
          <span className="sr-only"> {line.title} du panier</span>
        </button>
      </div>

      <span
        data-testid="cart-line-price"
        className="text-body font-semibold whitespace-nowrap"
      >
        {formatXof(line.priceXof)}
      </span>
    </li>
  );
}

/**
 * Where this cart stands, in one sentence.
 *
 * The words for a blocking condition come from `CART_BLOCKER_LABELS`, beside
 * the rule that decides it, so a new way to be held up arrives with its own
 * sentence rather than leaving this saying everything is fine.
 */
function cartState(cart: DigitalCart): string {
  if (cart.isBusy) {
    return "Mise à jour du panier…";
  }
  if (!cart.isLoaded) {
    return cart.hasFailed
      ? "Panier indisponible pour le moment."
      : "Chargement du panier…";
  }
  if (cart.view.isEmpty) {
    return "Votre panier est vide.";
  }
  return cart.view.blockedBy
    ? CART_BLOCKER_LABELS[cart.view.blockedBy]
    : "Votre panier est prêt.";
}
