import type { MarqueeContent } from "@/managed-content/types";

interface PositioningMarqueeProps {
  marquee: MarqueeContent;
}

const REPEATS = 3;

/**
 * The scrolling positioning band.
 *
 * Decorative motion around a phrase that is already in the footer, so the strip
 * is hidden from assistive technology rather than read out three times. The
 * animation is suppressed by the global reduced-motion rule.
 */
export function PositioningMarquee({ marquee }: PositioningMarqueeProps) {
  const line = `${Array.from({ length: REPEATS }, () => marquee.text).join(
    "  —  ",
  )}  —  `;

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden border-y border-wc-line-dark bg-wc-pure py-[18px]"
    >
      <div
        data-testid="positioning-marquee-track"
        className="flex w-max animate-wc-marquee"
      >
        <span className="pr-11 text-button tracking-42 uppercase text-wc-muted-2">
          {line}
        </span>
        <span className="pr-11 text-button tracking-42 uppercase text-wc-muted-2">
          {line}
        </span>
      </div>
    </div>
  );
}
