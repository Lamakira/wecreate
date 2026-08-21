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

/**
 * Whether following this destination starts a Service Enquiry, and which one.
 *
 * Inferred from the address itself so an editor who points the header CTA at
 * WhatsApp does not also have to mark it as an enquiry. A product-support
 * WhatsApp link is a plain `<a>` elsewhere and is not classified here, which
 * is how a question about an ebook stays out of Service Enquiry measurement.
 */
export function enquiryDestination(
  href: string,
): "whatsapp" | "discovery_call" | undefined {
  if (/wa\.me|whatsapp\.com/i.test(href)) {
    return "whatsapp";
  }
  if (/calendly\.com/i.test(href)) {
    return "discovery_call";
  }
  return undefined;
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
  const enquiry = enquiryDestination(cta.href);
  const newTab = opensNewTab(cta.href);

  const content = (
    <>
      {cta.label}
      {context ? <span className="sr-only"> - {context}</span> : null}
      {newTab ? <span className="sr-only"> (nouvel onglet)</span> : null}
    </>
  );

  if (isExternalHref(cta.href)) {
    return (
      <a
        href={cta.href}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : undefined)}
        {...(enquiry ? { "data-enquiry": enquiry } : undefined)}
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
