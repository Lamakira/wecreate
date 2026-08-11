"use client";

import { useEffect, useRef } from "react";

import { formatXof } from "@/lib/format";
import { useDigitalCart } from "@/digital-cart/use-digital-cart";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The Digital Cart drawer.
 *
 * Issue #9 fills this with cart lines, removal and a checkout action. What it
 * owns today is the shell's half of the contract: a real modal dialog with the
 * focus management WCAG 2.2 AA requires — focus moved in on open, kept inside
 * while open, and returned to the button that opened it on close — plus Escape,
 * a click-away backdrop, and the empty state a visitor sees before anything is
 * purchasable.
 */
export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { lines, itemCount, totalXof, isEmpty } = useDigitalCart();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Remember where focus came from, so closing returns the visitor to the
    // control they opened the drawer with rather than the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      // Keep Tab inside the dialog: a modal that lets focus wander onto the
      // page behind it is not modal to a keyboard or screen-reader user.
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-1000 flex justify-end">
      <button
        type="button"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-wc-pure/70 backdrop-blur-[3px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Panier"
        data-testid="digital-cart-drawer"
        className="relative flex h-full w-[min(430px,100%)] animate-wc-fade-fast flex-col border-l border-wc-line-dark bg-wc-black"
      >
        <div className="flex items-center justify-between border-b border-wc-line-dark px-[26px] pt-[26px] pb-5">
          <p className="text-micro tracking-28 uppercase text-wc-muted-2">
            Panier · {itemCount}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer le panier"
            className="text-xl leading-none text-wc-white"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[26px] py-2">
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
        </div>

        <div className="border-t border-wc-line-dark px-[26px] pt-6 pb-[30px]">
          <div className="flex items-baseline justify-between">
            <span className="text-micro tracking-26 uppercase text-wc-muted-2">
              Total
            </span>
            <span className="font-display text-[26px]">{formatXof(totalXof)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
