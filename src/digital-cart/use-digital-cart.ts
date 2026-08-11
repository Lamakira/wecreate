"use client";

import type { DigitalProductCard } from "@/managed-content/types";

/** One line of the Digital Cart. Quantity is always one per licensing model. */
export interface DigitalCartLine {
  product: Pick<DigitalProductCard, "id" | "title" | "priceXof">;
}

export interface DigitalCartView {
  lines: DigitalCartLine[];
  itemCount: number;
  totalXof: number;
  isEmpty: boolean;
}

const EMPTY_CART: DigitalCartView = {
  lines: [],
  itemCount: 0,
  totalXof: 0,
  isEmpty: true,
};

/**
 * The Digital Cart as the shell sees it.
 *
 * Issue #9 puts the real, cookie-persisted cart behind this hook. Until then it
 * reports an empty cart: no product is purchase-enabled before the Commerce
 * Launch Gate, so there is nothing that could legitimately be in it. Keeping
 * the seam here means the header indicator and the drawer are already wired to
 * their eventual source.
 */
export function useDigitalCart(): DigitalCartView {
  return EMPTY_CART;
}
