import Link from "next/link";

import { ACTION_SIZES, type ActionSize } from "@/components/primitives/action";
import type { CallToAction } from "@/managed-content/types";

/** A destination outside WeCreate's own origin. */
export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || href.startsWith("mailto:");
}

/**
 * Whether following this destination should leave the current tab.
 *
 * Not the same question as `isExternalHref`, and the difference is the reason
 * both exist: a `mailto:` is external — it must be a plain `<a>` rather than a
 * client-side `<Link>` — but it hands over to the visitor's mail client, so
 * forcing `target="_blank"` on it only leaves an empty tab behind.
 */
export function opensNewTab(href: string): boolean {
  return /^(https?:)?\/\//i.test(href);
}

const VARIANTS = {
  /** Solid white on dark: the primary action. */
  solid:
    "bg-wc-white text-wc-pure transition-opacity duration-300 hover:opacity-75",
  /** Outlined: the secondary action on a dark surface. */
  ghost:
    "border border-wc-border text-wc-white transition-colors duration-300 hover:border-wc-white hover:bg-wc-surface-2",
  /** Underlined text: a quiet in-section link, with metrics of its own. */
  underline:
    "inline-block border-b border-wc-muted pb-[5px] text-micro tracking-24 uppercase transition-colors duration-300 hover:border-wc-white",
} as const;

interface CtaLinkProps {
  cta: CallToAction;
  variant: keyof typeof VARIANTS;
  /** Ignored by `underline`, which carries its own box. */
  size?: ActionSize;
  /**
   * Appended to the accessible name and hidden visually. What distinguishes
   * one "Demander un devis" from the nine others on the same page.
   */
  context?: string;
  className?: string;
}

/**
 * Renders a Managed Content call to action, choosing between client-side
 * navigation and a plain external link from the destination itself. Editors
 * type a destination; they never have to know which kind of link it becomes.
 */
export function CtaLink({
  cta,
  variant,
  size = "default",
  context,
  className,
}: CtaLinkProps) {
  const classes = [
    variant === "underline" ? "" : ACTION_SIZES[size],
    VARIANTS[variant],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {cta.label}
      {context ? <span className="sr-only"> - {context}</span> : null}
    </>
  );

  if (isExternalHref(cta.href)) {
    return (
      <a
        href={cta.href}
        {...(opensNewTab(cta.href)
          ? { target: "_blank", rel: "noopener noreferrer" }
          : undefined)}
        className={classes}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={cta.href} className={classes}>
      {content}
    </Link>
  );
}
