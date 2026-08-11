"use client";

import { useState, type ReactNode } from "react";

import { CartDrawer } from "@/components/shell/cart-drawer";
import { SiteHeader } from "@/components/shell/site-header";
import type { SiteSettings } from "@/managed-content/types";

interface SiteShellProps {
  settings: SiteSettings;
  children: ReactNode;
}

/**
 * The interactive frame shared by every public page.
 *
 * Only the header and the Digital Cart drawer need client state, so this is the
 * one client boundary in the shell; the footer and every page section below it
 * stay server-rendered.
 */
export function SiteShell({ settings, children }: SiteShellProps) {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <>
      <SiteHeader settings={settings} onOpenCart={() => setIsCartOpen(true)} />
      {children}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
