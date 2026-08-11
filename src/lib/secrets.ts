import { timingSafeEqual } from "node:crypto";

/**
 * Compare a supplied secret with the expected one without leaking its length
 * or contents through timing. An empty expected value never matches, so an
 * unconfigured secret cannot be bypassed by sending an empty one.
 */
export function matchesSecret(
  supplied: string | null | undefined,
  expected: string,
): boolean {
  if (!expected || !supplied) {
    return false;
  }

  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (suppliedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(suppliedBytes, expectedBytes);
}
