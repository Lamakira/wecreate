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

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/**
 * A legal effective date, written the way French writes one: `2026-09-01` as
 * `1er septembre 2026`.
 *
 * Hand-rolled for the same reason `formatXof` is — a date a visitor is told
 * their terms took effect on must read identically on every runtime, and month
 * names and the ordinal `1er` are exactly the kind of thing an ICU update
 * moves. An unparseable value is returned untouched rather than guessed at.
 */
export function formatEffectiveDate(isoDate: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!parts) {
    return isoDate;
  }

  const [, year, month, day] = parts;
  const monthName = MONTHS_FR[Number(month) - 1];
  if (!monthName) {
    return isoDate;
  }

  const dayNumber = Number(day);
  return `${dayNumber === 1 ? "1er" : dayNumber} ${monthName} ${year}`;
}

/**
 * A file size, written the way French writes one: `12 o`, `340 ko`, `2,4 Mo`.
 *
 * Hand-rolled like the two above, and binary rather than decimal because that
 * is what an operating system tells the Commerce Operator the same file is.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Benin is UTC+1 all year: no daylight saving to move a recorded moment. */
const WECREATE_UTC_OFFSET_MINUTES = 60;

/**
 * A recorded moment, written the way WeCreate reads one: `13 août 2026 à 09:41`.
 *
 * Always in WeCreate's own time, whichever region the server runs in, because
 * an audit entry saying *who did what, when* is read by the person who did it.
 * Hand-rolled for the reason the two formatters above are: `Intl` output moves
 * with the runtime's ICU version, and a timestamp in an audit trail is evidence.
 */
export function formatMoment(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }

  const local = new Date(
    parsed.getTime() + WECREATE_UTC_OFFSET_MINUTES * 60 * 1000,
  );
  const day = local.getUTCDate();
  const monthName = MONTHS_FR[local.getUTCMonth()];
  const time = `${String(local.getUTCHours()).padStart(2, "0")}:${String(
    local.getUTCMinutes(),
  ).padStart(2, "0")}`;

  return `${day === 1 ? "1er" : day} ${monthName} ${local.getUTCFullYear()} à ${time}`;
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
