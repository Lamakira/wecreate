import { createHash, randomBytes } from "node:crypto";

/**
 * The credential a buyer is emailed, and the only thing that opens their files.
 *
 * There is no account behind Order Access and there will not be one (issue #1),
 * so this token is the whole of the authorisation. Three properties follow, and
 * each is a decision rather than a default.
 *
 * **It is unguessable.** Two hundred and fifty-six bits from a cryptographic
 * source. An order reference carries fifty, which is enough for something whose
 * worst outcome is reading what an order contains; this opens a paid file, so
 * it is not in the same class and is not generated the same way.
 *
 * **It is never stored.** What the data plane holds is a SHA-256 of it, and
 * access is looked up by that digest. A leak of the database is therefore not a
 * leak of anybody's files, and no log, query plan or backup can contain a
 * working credential. It is a plain digest rather than a password hash on
 * purpose: the input is already 256 random bits, so there is no dictionary to
 * slow down and nothing for a work factor to buy.
 *
 * **It is compared by lookup, not by string.** The digest is the key, so the
 * comparison happens inside an index on a value an attacker cannot influence
 * one byte at a time — which is what makes a constant-time comparison
 * unnecessary here rather than merely omitted.
 */

/** Bytes of randomness in one token. */
const TOKEN_BYTES = 32;

/**
 * A token, written the way it will travel: `base64url`, so it survives being a
 * path segment, a line in an email and a value somebody copies by hand.
 */
export function newAccessToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** SHA-256 of one token, hexadecimal: the only form ever written down. */
export function accessTokenDigest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Whether a value could be one of ours, for a lookup that should not be made.
 *
 * The same guard `isOrderReference` is: anything at all may arrive in a path
 * segment or a cookie, and a round trip to the data plane is not owed to a
 * string that is not shaped like a token.
 */
export function isAccessToken(value: string): boolean {
  // 32 bytes is 43 base64url characters, with no padding.
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
