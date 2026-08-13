"use client";

import { ACTION_SIZES, type ActionSize } from "@/components/primitives/action";
import { useDigitalCart } from "@/digital-cart/use-digital-cart";

interface AddToCartButtonProps {
  /** The product's stable identity — the one thing the cart ever stores. */
  productId: string;
  /**
   * What distinguishes this *Ajouter au panier* from the five others on the
   * Boutique's grid. Hidden visually, appended to the accessible name.
   */
  title: string;
  /** `block` fills the foot of a product card; the product page stands alone. */
  size?: ActionSize;
}

/**
 * *Ajouter au panier*, on a product WeCreate can actually sell.
 *
 * It is only ever rendered for a product whose availability is `available`, so
 * the button a visitor sees is one that will work. The server checks again when
 * it arrives, because availability is decided in two systems and a browser is
 * neither of them.
 *
 * Pressing it opens the drawer at once. The line, the count and the total
 * arrive from the server a moment later — the shopper watches their cart change
 * rather than pressing a button that appears to do nothing.
 *
 * Inverted rather than `CtaLink`'s white-on-dark `solid`: the Boutique is the
 * site's one light page, and its primary action has to be the dark one.
 */
export function AddToCartButton({
  productId,
  title,
  size = "block",
}: AddToCartButtonProps) {
  const cart = useDigitalCart();
  const isInCart = cart.contains(productId);

  return (
    <button
      type="button"
      data-testid="add-to-cart"
      data-product={productId}
      onClick={() => cart.add(productId)}
      className={`${ACTION_SIZES[size]} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80`}
    >
      {isInCart ? "Voir dans le panier" : "Ajouter au panier"}
      <span className="sr-only"> — {title}</span>
    </button>
  );
}
