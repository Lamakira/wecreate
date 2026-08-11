import type { SplitHeadline } from "@/managed-content/types";

type HeadingLevel = "h1" | "h2" | "h3";

interface SplitHeadingProps {
  as: HeadingLevel;
  headline: SplitHeadline;
  className?: string;
  /** Set when a section names itself after this heading via `aria-labelledby`. */
  id?: string;
}

/**
 * A heading with one italicised accent word.
 *
 * The accent is a single `<em>` inside one heading element, so the whole
 * phrase is announced as one heading rather than fragmented.
 */
export function SplitHeading({ as: Tag, headline, className, id }: SplitHeadingProps) {
  return (
    <Tag id={id} className={className}>
      {headline.lead}
      <em className="italic">{headline.emphasis}</em>
      {headline.trail}
    </Tag>
  );
}
