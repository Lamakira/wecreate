"use client";

import { SideDrawer } from "@/components/shell/side-drawer";
import { formatXof } from "@/lib/format";
import { useDigitalCart } from "@/digital-cart/use-digital-cart";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The Digital Cart drawer.
 *
 * Issue #9 fills this with cart lines, removal and a checkout action. What it
 * owns today is the empty state a visitor sees before anything is purchasable;
 * the dialog behaviour comes from `SideDrawer`.
 */
export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { lines, itemCount, totalXof, isEmpty } = useDigitalCart();

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      label="Panier"
      closeLabel="Fermer le panier"
      testId="digital-cart-drawer"
      heading={`Panier · ${itemCount}`}
      footer={
        <div className="flex items-baseline justify-between">
          <span className="text-micro tracking-26 uppercase text-wc-muted-2">
            Total
          </span>
          <span className="font-display text-[26px]">{formatXof(totalXof)}</span>
        </div>
      }
    >
      {isEmpty ? (
        <p className="py-8 text-body font-light text-wc-muted-2">
          Votre panier est vide.
        </p>
      ) : (
        <ul className="list-none p-0">
          {lines.map((line) => (
            <li
              key={line.product.id}
              className="flex gap-3.5 border-b border-wc-line-darker py-5"
            >
              <span className="flex-1 text-body font-medium">
                {line.product.title}
              </span>
              <span className="text-body font-semibold">
                {formatXof(line.product.priceXof)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SideDrawer>
  );
}
