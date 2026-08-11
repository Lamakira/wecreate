interface SectionEmptyStateProps {
  text: string;
  /** Identifies the section in acceptance tests. */
  testId: string;
}

/**
 * What a section shows when it has nothing to list yet.
 *
 * The section keeps its heading and its link to the fuller page; only the grid
 * is replaced. Saying plainly that nothing is published is the honest answer —
 * WeCreate never fills the gap with sample work.
 */
export function SectionEmptyState({ text, testId }: SectionEmptyStateProps) {
  return (
    <p
      data-testid={testId}
      className="m-0 border-t border-wc-line-dark pt-6 text-body font-light text-wc-muted-2"
    >
      {text}
    </p>
  );
}
