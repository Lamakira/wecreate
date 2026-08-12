import { opensNewTab } from "@/components/primitives/cta-link";

/**
 * One of the three ways to reach WeCreate.
 *
 * Every one of them is a plain `<a>` to somewhere outside this origin. Nothing
 * here is enhanced by script, measured before it fires or routed through a
 * redirect: the `href` is the destination itself, so the link works with
 * JavaScript disabled, survives a blocked analytics script, and shows a visitor
 * where it goes when they hover or long-press it.
 *
 * All three carry the same weight. WhatsApp is first and the email last, but a
 * visitor whose calendar or mail client is the one that works must not find it
 * presented as the lesser option (issue #1: WhatsApp sits *beside* the calendar
 * so a scheduling failure never blocks contact).
 */

interface ContactChannelProps {
  /** The real destination — a `wa.me` address, a calendar page or a `mailto:`. */
  href: string;
  /** Names the destination in the accessible name, e.g. the number or address. */
  label: string;
  /**
   * What the channel is, when the label alone does not say — an email address
   * reads as an address and nothing more. Announced, not shown, because the
   * design gives the address the whole line.
   */
  announcedKind?: string;
  /** What this channel is for. */
  note: string;
}

export function ContactChannel({
  href,
  label,
  announcedKind,
  note,
}: ContactChannelProps) {
  const newTab = opensNewTab(href);

  return (
    <li data-testid="contact-channel">
      <a
        href={href}
        {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : undefined)}
        className="inline-block border-b border-wc-border pb-3 font-display text-[clamp(22px,2.4vw,30px)] transition-colors duration-300 hover:text-wc-soft"
      >
        {announcedKind ? (
          <span className="sr-only">{announcedKind} : </span>
        ) : null}
        {label}
        {/* A link that leaves the tab says so, rather than surprising a
            screen-reader user with a context they did not ask for. */}
        {newTab ? <span className="sr-only"> (nouvel onglet)</span> : null}
      </a>
      <p className="m-0 mt-3 max-w-[46ch] text-body-sm font-light text-wc-muted-2">
        {note}
      </p>
    </li>
  );
}
