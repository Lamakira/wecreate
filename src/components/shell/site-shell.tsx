"use client";

import { useState, type ReactNode } from "react";

import { CartDrawer } from "@/components/shell/cart-drawer";
import { NavDrawer } from "@/components/shell/nav-drawer";
import { SiteHeader } from "@/components/shell/site-header";
import { useDigitalCart } from "@/digital-cart/use-digital-cart";
import type { SiteSettings } from "@/managed-content/types";

interface SiteShellProps {
  settings: SiteSettings;
  children: ReactNode;
}

/**
 * The interactive frame shared by every public page.
 *
 * Only the header and its two panels need client state, so this is the one
 * client boundary in the shell; the footer and every page section below it stay
 * server-rendered. The two panels are mutually exclusive — opening one closes
 * the other, so they can never stack.
 *
 * The cart's own open state lives with the cart rather than here, because
 * *Ajouter au panier* opens the drawer from a product page, far outside this
 * component. What stays here is the rule that only one panel is ever open.
 */
export function SiteShell({ settings, children }: SiteShellProps) {
  const cart = useDigitalCart();
  const [isMenuRequested, setIsMenuRequested] = useState(false);

  // The cart wins, wherever it was opened from: *Ajouter au panier* sits on a
  // product page and knows nothing about this menu. Derived rather than pushed
  // into state from an effect, so the two can never both be open for a frame.
  const isMenuOpen = isMenuRequested && !cart.isOpen;

  return (
    <>
      <SiteHeader
        settings={settings}
        isMenuOpen={isMenuOpen}
        onOpenCart={cart.open}
        onOpenMenu={() => {
          cart.close();
          setIsMenuRequested(true);
        }}
      />
      {children}
      <CartDrawer />
      <NavDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuRequested(false)}
        settings={settings}
      />
    </>
  );
}
