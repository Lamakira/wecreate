"use client";

import { Bars3Icon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { CtaLink } from "@/components/primitives/cta-link";
import { CartIndicator } from "@/components/shell/cart-indicator";
import { isCurrentPath } from "@/lib/current-path";
import type { SiteSettings } from "@/managed-content/types";

interface SiteHeaderProps {
  settings: SiteSettings;
  isMenuOpen: boolean;
  onOpenCart: () => void;
  onOpenMenu: () => void;
}

/**
 * The fixed header: logo, six-link navigation, Digital Cart indicator and the
 * call CTA.
 *
 * Two responsive rules, both about keeping navigation usable as space runs out.
 * Below 1120px the call CTA is dropped. Below 900px the word-mark becomes the
 * icon and the six links move into a panel behind a menu button — they do not
 * fit across a phone, and the alternative the design first specified, a
 * horizontally scrollable strip, left two of them behind an invisible swipe.
 * The panel restores the call CTA at its foot, so nothing is lost.
 */
export function SiteHeader({
  settings,
  isMenuOpen,
  onOpenCart,
  onOpenMenu,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [isCondensed, setIsCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsCondensed(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-900 border-b border-wc-line-dark bg-wc-black/[0.82] backdrop-blur-[14px]">
      <div
        className={`wc-container flex flex-nowrap items-center gap-[clamp(10px,2vw,36px)] transition-[padding] duration-[350ms] ease-signature ${
          isCondensed ? "py-3" : "py-5"
        }`}
      >
        <Link
          href="/"
          aria-label={`${settings.brandName} — accueil`}
          className="flex flex-none items-center"
        >
          <Image
            src="/brand/logo-blanc.svg"
            alt={settings.brandName}
            width={166}
            height={22}
            priority
            className="hidden h-[22px] w-auto min-[900px]:block"
          />
          <Image
            src="/brand/icone-blanc.svg"
            alt={settings.brandName}
            width={34}
            height={24}
            priority
            className="h-6 w-auto min-[900px]:hidden"
          />
        </Link>

        <nav
          aria-label="Navigation principale"
          className="ml-auto hidden flex-auto flex-nowrap items-center justify-end gap-[clamp(10px,1.6vw,26px)] min-[900px]:flex"
        >
          {settings.navigation.map((link) => {
            const isCurrent = isCurrentPath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`whitespace-nowrap border-b py-1.5 text-button font-medium tracking-16 uppercase transition-colors duration-300 hover:text-wc-white ${
                  isCurrent
                    ? "border-wc-white text-wc-white"
                    : "border-transparent text-wc-muted-2"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-3 min-[900px]:ml-0">
          <CartIndicator onOpen={onOpenCart} />

          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Ouvrir le menu"
            aria-expanded={isMenuOpen}
            data-testid="navigation-menu-button"
            className="grid h-10 w-10 place-items-center border border-wc-border text-wc-white transition-colors duration-300 hover:border-wc-white hover:bg-wc-surface-2 min-[900px]:hidden"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Wrapped rather than given a `hidden` class of its own: the button
              variant already sets a display utility, and two competing display
              utilities on one element resolve by stylesheet order rather than
              by the order they are written in. */}
          <div className="hidden min-[1120px]:block">
            <CtaLink
              cta={settings.headerCta}
              variant="solid"
              className="px-5 py-[13px] tracking-16"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
