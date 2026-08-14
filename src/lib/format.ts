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
  const local = wecreateTime(isoTimestamp);
  if (!local) return isoTimestamp;

  const time = `${String(local.getUTCHours()).padStart(2, "0")}:${String(
    local.getUTCMinutes(),
  ).padStart(2, "0")}`;

  return `${writtenDay(local)} à ${time}`;
}

/**
 * The same moment without the clock: `13 août 2026`.
 *
 * For a deadline a buyer plans around rather than a record of when something
 * happened — Order Access runs out at a moment, and printing `à 09:41` beside
 * it would invite somebody to work to the minute on a date thirty days away.
 * WeCreate's own time again, for the reason `formatMoment` uses it.
 *
 * Built from the same parts rather than by trimming the other one's output: a
 * date that silently became a timestamp because a separator moved would be a
 * deadline nobody notices is wrong.
 */
export function formatDay(isoTimestamp: string): string {
  const local = wecreateTime(isoTimestamp);
  return local ? writtenDay(local) : isoTimestamp;
}

/**
 * One moment shifted into WeCreate's own time, so every field below can be read
 * off it in UTC. `undefined` for a value that is not a moment at all, which the
 * two callers return untouched rather than guessing at.
 */
function wecreateTime(isoTimestamp: string): Date | undefined {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return new Date(parsed.getTime() + WECREATE_UTC_OFFSET_MINUTES * 60 * 1000);
}

function writtenDay(local: Date): string {
  const day = local.getUTCDate();
  return `${day === 1 ? "1er" : day} ${MONTHS_FR[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
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
