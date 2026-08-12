import type { ReactNode } from "react";

interface SectionKickerProps {
  /**
   * The heading level this kicker occupies in the page's outline. It is a
   * heading rather than a styled paragraph wherever a section is named by it.
   */
  as: "h2" | "h3";
  /** Set when a section names itself after this kicker via `aria-labelledby`. */
  id?: string;
  children: ReactNode;
}

/**
 * The design's micro-label, used as a section's own heading.
 *
 * Ten pixels, wide tracking, upper case, tertiary grey — the handoff's
 * micro-label, at the one grey that clears 4.5:1 on this palette's dark
 * surfaces. Written once because a column heading that drifts by a hundredth of
 * an em from its neighbour is the kind of difference nobody sees until the
 * whole page looks slightly wrong.
 */
export function SectionKicker({ as: Tag, id, children }: SectionKickerProps) {
  return (
    <Tag
      id={id}
      className="m-0 mb-5 text-micro tracking-30 font-normal uppercase text-wc-muted-2"
    >
      {children}
    </Tag>
  );
}
