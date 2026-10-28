import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { siteUrl } from "@/site-config";

/**
 * The personal link that opens a client's brand questionnaire (issue #57).
 *
 * WeCreate's team makes one for a Branding client once a pack is agreed (the
 * tool is issue #63, which builds on `sealInvitation` and `invitationUrl` and
 * on nothing else). It identifies the client, the brand, the pack and
 * WeCreate's reference — and shows none of them: parent decision 3 (#55)
 * rules out the handoff's `?client=…&marque=…` query string, because an
 * address is copied into chats, logged by proxies and kept in browser
 * histories.
 *
 * **The token is the invitation, encrypted.** AES-256-GCM over a small JSON
 * payload, so it is unreadable without the server's secret *and* any byte
 * changed in it fails authentication. Nothing about the client is stored
 * anywhere to look it up by, which is what lets the questionnaire keep
 * parent decision 3's "nothing is stored" literally: the link carries
 * everything, and only this server can read it.
 *
 * Format, byte for byte (the acceptance suite spells it out by hand in
 * `tests/e2e/support/brand-questionnaire.ts`, so a change here must be a
 * deliberate change there too):
 *
 *     base64url( version · iv · ciphertext · tag )
 *
 *     version     1 byte, 0x01
 *     iv          12 random bytes
 *     ciphertext  AES-256-GCM of the UTF-8 JSON payload, the version byte as
 *                 additional authenticated data
 *     tag         16 bytes
 *     key         HKDF-SHA256(WECREATE_QUESTIONNAIRE_SECRET, salt "",
 *                 info "wecreate brand questionnaire invitation v1", 32 bytes)
 *     payload     { "c": client, "b": brand, "p": pack, "r": reference,
 *                   "e": expiry in whole seconds since the epoch }
 *
 * **It expires.** A link sent today should not open a form in a year, after
 * the project is delivered and the pack long forgotten. `e` is inside the
 * authenticated payload, so it cannot be extended by hand.
 */

export interface QuestionnaireInvitation {
  /** The client's name, as WeCreate's team wrote it. Addressed by it. */
  client: string;
  /** The brand, when the team knows it. The client may correct it. */
  brand: string;
  /** The Branding pack agreed, e.g. "Identité Complète". */
  pack: string;
  /** WeCreate's own reference for this client's project. */
  reference: string;
  /** When the link stops opening the questionnaire. */
  expiresAt: Date;
}

export type InvitationOutcome =
  | { status: "valid"; invitation: QuestionnaireInvitation }
  | { status: "expired" }
  | { status: "invalid" };

/** How long a link opens the questionnaire, unless its maker says otherwise. */
export const INVITATION_VALIDITY_DAYS = 30;

const VERSION = 0x01;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_INFO = "wecreate brand questionnaire invitation v1";

/**
 * Long enough for any honest payload, short enough that nothing is decrypted
 * for a string nobody could have been given. Every field is capped by
 * `FIELD_MAX` below, so a real token is a few hundred characters.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{40,1200}$/;

/** Characters kept per field, when sealing. The page prints these. */
const FIELD_MAX = 120;

/**
 * The derived key, or `undefined` on a deployment that has no secret.
 *
 * No secret is a deliberate state rather than a broken one: no link can be
 * made and none opens, so the questionnaire is simply closed.
 */
function key(): Buffer | undefined {
  const secret = process.env.WECREATE_QUESTIONNAIRE_SECRET;
  if (!secret) return undefined;
  return Buffer.from(hkdfSync("sha256", secret, "", KEY_INFO, 32));
}

/** Whether this deployment can make and open personal links at all. */
export function invitationsAreConfigured(): boolean {
  return Boolean(process.env.WECREATE_QUESTIONNAIRE_SECRET);
}

function clip(value: string): string {
  return Array.from(value.trim()).slice(0, FIELD_MAX).join("");
}

/**
 * The token for one invitation.
 *
 * Throws on a deployment with no `WECREATE_QUESTIONNAIRE_SECRET`: a link that
 * could never open must not be handed to a client.
 */
export function sealInvitation(invitation: QuestionnaireInvitation): string {
  const secret = key();
  if (!secret) {
    throw new Error(
      "WECREATE_QUESTIONNAIRE_SECRET is required to make a questionnaire link. See README.md, “The brand questionnaire”.",
    );
  }

  const payload = JSON.stringify({
    c: clip(invitation.client),
    b: clip(invitation.brand),
    p: clip(invitation.pack),
    r: clip(invitation.reference),
    e: Math.floor(invitation.expiresAt.getTime() / 1000),
  });

  const version = Buffer.from([VERSION]);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  cipher.setAAD(version);
  const ciphertext = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([version, iv, ciphertext, cipher.getAuthTag()]).toString(
    "base64url",
  );
}

/** The address a client is sent: the token in a path segment, nothing else. */
export function invitationUrl(token: string): string {
  return `${siteUrl()}/questionnaire/${token}`;
}

/** A default expiry, `INVITATION_VALIDITY_DAYS` from `from`. */
export function defaultInvitationExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * What a token says, if this server made it and it has not expired.
 *
 * An altered token, one made under another secret, a truncated one and a
 * string that was never a token are all `invalid`, indistinguishably: the
 * page says the same calm thing for each. `expired` is told apart because it
 * is the one a client can do something specific about — ask for a new link —
 * and saying so reveals nothing a valid token's holder did not already know.
 */
export function openInvitation(
  token: string,
  now: Date = new Date(),
): InvitationOutcome {
  const secret = key();
  if (!secret || !TOKEN_SHAPE.test(token)) return { status: "invalid" };

  const bytes = Buffer.from(token, "base64url");
  if (bytes.length < 1 + IV_BYTES + TAG_BYTES + 1 || bytes[0] !== VERSION) {
    return { status: "invalid" };
  }

  const iv = bytes.subarray(1, 1 + IV_BYTES);
  const tag = bytes.subarray(bytes.length - TAG_BYTES);
  const ciphertext = bytes.subarray(1 + IV_BYTES, bytes.length - TAG_BYTES);

  let payload: unknown;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secret, iv);
    decipher.setAAD(bytes.subarray(0, 1));
    decipher.setAuthTag(tag);
    payload = JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      ),
    );
  } catch {
    return { status: "invalid" };
  }

  const { c, b, p, r, e } = (payload ?? {}) as Record<string, unknown>;
  if (
    typeof c !== "string" ||
    typeof b !== "string" ||
    typeof p !== "string" ||
    typeof r !== "string" ||
    typeof e !== "number" ||
    !Number.isFinite(e) ||
    !r
  ) {
    return { status: "invalid" };
  }

  if (e * 1000 <= now.getTime()) return { status: "expired" };

  return {
    status: "valid",
    invitation: {
      client: c,
      brand: b,
      pack: p,
      reference: r,
      expiresAt: new Date(e * 1000),
    },
  };
}
