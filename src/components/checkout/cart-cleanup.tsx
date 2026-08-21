"use client";

import { useEffect, useRef } from "react";

import { useDigitalCart } from "@/digital-cart/use-digital-cart";

/**
 * Empties the Digital Cart once what it held has been paid for.
 *
 * Rendered by the payment return page when — and only when — the order's
 * Payment State is approved: the cart's contents are committed to the Order
 * Snapshot by then, and leaving them in place would offer the same products
 * for a second purchase. Not done any earlier, because an attempt that never
 * reached the provider is resumed by comparing the order against the cart.
 *
 * Renders nothing; the effect is the whole component.
 */
export function CartCleanup() {
  const cart = useDigitalCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    cart.clear();
  }, [cart]);

  return null;
}
