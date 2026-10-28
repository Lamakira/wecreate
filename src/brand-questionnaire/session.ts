import "server-only";

import { cookies } from "next/headers";

import { cookiesAreSecure } from "@/site-config";

import { INVITATION_VALIDITY_DAYS } from "./invitation";

/**
 * The Questionnaire Invitation this browser is carrying.
 *
 * One value, and it is the token itself: there is no account and nothing else
 * identifies the client, so the credential is what the browser keeps. It is the
 * same shape as the Order Access cookie (`src/fulfillment/session.ts`) and for
 * the same reasons — the emailed address `/questionnaire/<token>` puts the
 * token here and redirects to `/questionnaire`, so the page the client reads,
 * reloads or shows somebody carries no credential.
 *
 * `httpOnly`, because nothing in the browser reads it. Scoped to
 * `/questionnaire`, so it travels with the page and the Server Function that
 * sends from it, and with nothing else on the site. The Server Function is
 * invoked from that page, so the browser sends the cookie with it.
 */

const INVITATION_COOKIE = "wc_questionnaire";

const COOKIE_PATH = "/questionnaire";

/** Same shape as `TOKEN_SHAPE` in `invitation.ts`: anything else is not ours. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{40,1200}$/;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookiesAreSecure(),
    path: COOKIE_PATH,
    // As long as a link stays valid. A cookie that outlived it would only
    // point at something that no longer opens.
    maxAge: INVITATION_VALIDITY_DAYS * 24 * 60 * 60,
  };
}

/** The token this browser holds, or none. Anything may be typed into a cookie. */
export async function readInvitationToken(): Promise<string | undefined> {
  const token = (await cookies()).get(INVITATION_COOKIE)?.value;
  return token && TOKEN_SHAPE.test(token) ? token : undefined;
}

export async function writeInvitationToken(token: string): Promise<void> {
  (await cookies()).set(INVITATION_COOKIE, token, cookieOptions());
}

/**
 * Forget a token. The path must match the one it was set with, or the browser
 * keeps the cookie it was asked to delete.
 */
export async function forgetInvitationToken(): Promise<void> {
  (await cookies()).set(INVITATION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}
