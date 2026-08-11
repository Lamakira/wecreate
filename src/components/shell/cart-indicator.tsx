"use client";

import { ShoppingCartIcon } from "@heroicons/react/24/outline";

import { useDigitalCart } from "@/digital-cart/use-digital-cart";

interface CartIndicatorProps {
  onOpen: () => void;
}

/**
 * The Digital Cart button in the header.
 *
 * The count is part of the accessible name rather than a bare number floating
 * next to an icon, so a screen-reader user hears "Panier, 0 article" instead of
 * an unexplained digit.
 */
export function CartIndicator({ onOpen }: CartIndicatorProps) {
  const { itemCount } = useDigitalCart();

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="digital-cart-indicator"
      aria-label={`Panier, ${itemCount} ${itemCount === 1 ? "article" : "articles"}`}
      className="relative grid h-10 w-10 place-items-center border border-wc-border text-wc-white transition-colors duration-300 hover:border-wc-white hover:bg-wc-surface-2"
    >
      <ShoppingCartIcon className="h-5 w-5" aria-hidden="true" />
      <span
        aria-hidden="true"
        className="absolute -top-[7px] -right-[7px] grid h-[18px] min-w-[18px] place-items-center rounded-[9px] bg-wc-white px-1 text-micro font-bold text-wc-pure"
      >
        {itemCount}
      </span>
    </button>
  );
}
