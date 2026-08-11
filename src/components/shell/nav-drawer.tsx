"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CtaLink } from "@/components/primitives/cta-link";
import { SideDrawer } from "@/components/shell/side-drawer";
import { isCurrentPath } from "@/lib/current-path";
import type { SiteSettings } from "@/managed-content/types";

interface NavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SiteSettings;
}

/**
 * Navigation on a narrow screen.
 *
 * The six links do not fit across a phone, and the design's horizontal scroll
 * strip hid two of them behind an invisible swipe. They are stacked here
 * instead, at a comfortable tap size, with the call CTA — dropped from the
 * header below 1120px — restored at the bottom so it stays reachable.
 */
export function NavDrawer({ isOpen, onClose, settings }: NavDrawerProps) {
  const pathname = usePathname();

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      label="Navigation"
      closeLabel="Fermer le menu"
      testId="navigation-drawer"
      heading="Menu"
      footer={
        <CtaLink
          cta={settings.headerCta}
          variant="solid"
          className="block w-full text-center"
        />
      }
    >
      <nav aria-label="Navigation mobile">
        <ul className="list-none p-0">
          {settings.navigation.map((link) => {
            const isCurrent = isCurrentPath(pathname, link.href);
            return (
              <li key={link.href} className="border-b border-wc-line-darker">
                <Link
                  href={link.href}
                  onClick={onClose}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`block py-5 font-display text-[26px] transition-colors duration-300 hover:text-wc-white ${
                    isCurrent ? "text-wc-white" : "text-wc-soft"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </SideDrawer>
  );
}
