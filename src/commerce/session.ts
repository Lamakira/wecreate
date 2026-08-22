import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { cookiesAreSecure } from "@/site-config";

import { getCommerceProvider } from "./provider";
import type { CommerceOperator, OperatorCredentials } from "./types";

/**
 * A Commerce Operator's session, as this application holds it.
 *
 * The credentials never reach the browser as anything a script can read: they
 * live in an http-only cookie scoped to `/commerce`, so no public page carries
 * them and no client component can be handed one by accident.
 *
 * The session is not the authorisation. `operators.ts` decides what a session
 * may do, the pages and actions apply it, and Postgres applies it again against
 * the request that arrives with these credentials — a session that has not
 * reached assurance level 2 is refused by the database whatever this
 * application believes.
 */

const SESSION_COOKIE = "wc_commerce_session";
const PENDING_FACTOR_COOKIE = "wc_commerce_enrolment";

/** Everything the back office is served from, and nothing else. */
const COOKIE_PATH = "/commerce";

/**
 * As long as the credentials themselves last, and no longer.
 *
 * Supabase issues an access token good for an hour and a refresh token that
 * rotates every time it is used. This application holds one set of credentials
 * in one cookie and never rewrites them mid-request — a page cannot set a
 * cookie in Next.js — so a rotated refresh token would be lost and the old one
 * replayed until Supabase refused it. Rather than a session that appears to
 * last a working day and quietly stops working after an hour, it ends when the
 * access token does and the operator signs in again.
 *
 * Lengthening this means persisting rotated credentials on every action, which
 * is worth doing when the back office grows the daily work of issue #15. It is
 * not worth doing for a surface someone opens to upload a file.
 */
const SESSION_SECONDS = 60 * 60;

/** An enrolment a staff member is in the middle of. Minutes, not hours. */
const ENROLMENT_SECONDS = 10 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookiesAreSecure(),
    path: COOKIE_PATH,
    maxAge,
  };
}

export async function readOperatorCredentials(): Promise<
  OperatorCredentials | undefined
> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<OperatorCredentials>;
    return parsed.accessToken && parsed.refreshToken
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
      : undefined;
  } catch {
    return undefined;
  }
}

export async function writeOperatorCredentials(
  credentials: OperatorCredentials,
): Promise<void> {
  (await cookies()).set(
    SESSION_COOKIE,
    JSON.stringify(credentials),
    cookieOptions(SESSION_SECONDS),
  );
}

export async function clearOperatorSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE, path: COOKIE_PATH });
  store.delete({ name: PENDING_FACTOR_COOKIE, path: COOKIE_PATH });
}

/**
 * Who is signed in, resolved once per request.
 *
 * `cache` rather than a value threaded through props: a page, its layout and
 * the action it submits to all ask the same question, and none of them should
 * be handed an operator by a component that might pass it on to the browser.
 */
export const readSignedInOperator = cache(
  async (): Promise<CommerceOperator | undefined> => {
    const credentials = await readOperatorCredentials();
    const provider = await getCommerceProvider();
    if (!credentials || !provider) return undefined;

    try {
      return await provider.readOperator(credentials);
    } catch {
      return undefined;
    }
  },
);

/**
 * An enrolment in progress: the factor's identity and the secret shown to the
 * staff member adding it.
 *
 * Held in a short-lived cookie rather than in the URL or in the page, so the
 * secret survives the round trip to the confirmation form without JavaScript
 * and without being written anywhere it would outlive the enrolment. This
 * application never stores it: once the factor is confirmed, only the staff
 * member's authenticator and the data plane know it.
 */
export interface PendingEnrolment {
  factorId: string;
  label: string;
  secret: string;
  uri: string;
}

export async function readPendingEnrolment(): Promise<
  PendingEnrolment | undefined
> {
  const raw = (await cookies()).get(PENDING_FACTOR_COOKIE)?.value;
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as PendingEnrolment;
  } catch {
    return undefined;
  }
}

export async function writePendingEnrolment(
  enrolment: PendingEnrolment,
): Promise<void> {
  (await cookies()).set(
    PENDING_FACTOR_COOKIE,
    JSON.stringify(enrolment),
    cookieOptions(ENROLMENT_SECONDS),
  );
}

export async function clearPendingEnrolment(): Promise<void> {
  (await cookies()).delete({ name: PENDING_FACTOR_COOKIE, path: COOKIE_PATH });
}
