import Link from "next/link";

import type { CallToAction } from "@/managed-content/types";

/** A destination outside WeCreate's own origin. */
export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:");
}

const VARIANTS = {
  /** Solid white on dark: the primary action. */
  solid:
    "inline-block whitespace-nowrap bg-wc-white px-7 py-[17px] text-button font-semibold tracking-18 uppercase text-wc-pure transition-opacity duration-300 hover:opacity-75",
  /** Outlined: the secondary action on a dark surface. */
  ghost:
    "inline-block whitespace-nowrap border border-wc-border px-7 py-[17px] text-button font-semibold tracking-18 uppercase text-wc-white transition-colors duration-300 hover:border-wc-white hover:bg-wc-surface-2",
  /** Underlined text: a quiet in-section link. */
  underline:
    "inline-block border-b border-wc-muted pb-[5px] text-micro tracking-24 uppercase transition-colors duration-300 hover:border-wc-white",
} as const;

interface CtaLinkProps {
  cta: CallToAction;
  variant: keyof typeof VARIANTS;
  className?: string;
}

/**
 * Renders a Managed Content call to action, choosing between client-side
 * navigation and a plain external link from the destination itself. Editors
 * type a destination; they never have to know which kind of link it becomes.
 */
export function CtaLink({ cta, variant, className }: CtaLinkProps) {
  const classes = className ? `${VARIANTS[variant]} ${className}` : VARIANTS[variant];

  if (isExternalHref(cta.href)) {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {cta.label}
      </a>
    );
  }

  return (
    <Link href={cta.href} className={classes}>
      {cta.label}
    </Link>
  );
}
