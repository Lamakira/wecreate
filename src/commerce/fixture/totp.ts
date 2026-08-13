import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords, RFC 6238.
 *
 * The fixture data plane implements the real algorithm rather than accepting
 * any six digits, so an acceptance test that signs in has to produce a code the
 * way an authenticator app does — and a wrong code is genuinely wrong. Supabase
 * does this itself; this exists so the deterministic provider behaves like it.
 *
 * Not `server-only`: the acceptance suite imports the generator to act as the
 * staff member's phone.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function decodeBase32(secret: string): Buffer {
  const cleaned = secret.replace(/[\s=]/g, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error(`Not a base32 secret: ${secret}`);
    }
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

/** The code an authenticator app shows for this secret at this moment. */
export function totpCode(secret: string, at: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / STEP_SECONDS)));

  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Whether this code came from this secret.
 *
 * One step either side is accepted, which is the tolerance a real authenticator
 * needs for a clock that is a little out and for the seconds between reading a
 * code and submitting it.
 */
export function isValidTotpCode(
  secret: string,
  code: string,
  at: number = Date.now(),
): boolean {
  const supplied = code.replace(/\s/g, "");
  if (!new RegExp(`^\\d{${DIGITS}}$`).test(supplied)) {
    return false;
  }

  const suppliedBytes = Buffer.from(supplied, "utf8");
  return [-1, 0, 1].some((drift) =>
    timingSafeEqual(
      Buffer.from(totpCode(secret, at + drift * STEP_SECONDS * 1000), "utf8"),
      suppliedBytes,
    ),
  );
}

/** The address an authenticator app scans or accepts by hand. */
export function totpUri(email: string, secret: string, label: string): string {
  const account = encodeURIComponent(`WeCreate:${email} (${label})`);
  return `otpauth://totp/${account}?secret=${secret}&issuer=WeCreate&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
