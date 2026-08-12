/** U+00A0. Written as an escape so the character is unmistakable in review. */
const NON_BREAKING_SPACE = "\u00A0";

/**
 * Format a whole XOF amount the way WeCreate writes prices in French:
 * thousands separated by a non-breaking space, suffixed with `F`.
 *
 * Non-breaking so an amount never wraps across two lines, and hand-rolled
 * rather than delegated to `Intl` so the exact separator does not drift with
 * the runtime's ICU version.
 *
 * Prices are always whole units — WeCreate never charges a fraction of a franc.
 */
export function formatXof(amount: number): string {
  const whole = Math.round(amount);
  const grouped = String(Math.abs(whole)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    NON_BREAKING_SPACE,
  );
  return `${whole < 0 ? "-" : ""}${grouped}${NON_BREAKING_SPACE}F`;
}

/**
 * The `01`, `02`, `03` the design prints beside a step, derived from where the
 * step sits rather than stored with it.
 *
 * Numbering a step in Managed Content would let an editor reorder or delete one
 * and leave the page counting `01, 02, 04`. This cannot: the number is the
 * position.
 */
export function formatStepNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}
