"use client";

import { useState, type ReactNode } from "react";

import { CartDrawer } from "@/components/shell/cart-drawer";
import { NavDrawer } from "@/components/shell/nav-drawer";
import { SiteHeader } from "@/components/shell/site-header";
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
 */
export function SiteShell({ settings, children }: SiteShellProps) {
  const [openPanel, setOpenPanel] = useState<"cart" | "menu" | null>(null);
  const close = () => setOpenPanel(null);

  return (
    <>
      <SiteHeader
        settings={settings}
        isMenuOpen={openPanel === "menu"}
        onOpenCart={() => setOpenPanel("cart")}
        onOpenMenu={() => setOpenPanel("menu")}
      />
      {children}
      <CartDrawer isOpen={openPanel === "cart"} onClose={close} />
      <NavDrawer
        isOpen={openPanel === "menu"}
        onClose={close}
        settings={settings}
      />
    </>
  );
}
