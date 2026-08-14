import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { OperatorCredentials } from "../types";

/**
 * Supabase clients, and the only module in the application allowed to import
 * its SDK (ADR-0008).
 *
 * Two things are deliberately absent.
 *
 * **No service role key.** Every statement runs as the staff member who asked
 * for it, under their own session, so Postgres can apply the policies in
 * `supabase/migrations/` against a real identity and a real assurance level. A
 * key that bypasses row-level security would make those policies decorative,
 * and would put a credential in the environment that could read every order
 * WeCreate will ever take.
 *
 * **No `NEXT_PUBLIC_` anything.** Supabase is never contacted from the browser
 * (ADR-0003), so neither the project URL nor the anonymous key is compiled into
 * a bundle. The back office runs entirely on the server.
 */

/** The private bucket Paid Deliverables are stored in. */
export const DELIVERABLES_BUCKET = "paid-deliverables";

/**
 * The secret that lets this deployment record a payment event.
 *
 * Recording one is the only thing in the data plane that can approve an order,
 * and it is addressed by the *provider's* transaction id — a small integer,
 * unlike the fifty-bit reference everything else here is bounded by. So
 * `commerce_record_payment_event` demands this on top of the anonymous key, and
 * a leaked anonymous key on its own approves nothing. See the migration.
 *
 * Empty when unconfigured, and Postgres refuses an empty one: the failure is a
 * payment that stays pending, never one that is approved by accident.
 */
export function paymentEventSecret(): string {
  return process.env.WECREATE_PAYMENT_EVENT_SECRET ?? "";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required to reach the commerce data plane. See README.md, “Setting up Supabase”.`,
    );
  }
  return value;
}

/**
 * A client with no session.
 *
 * Used for signing in, and for the one public read — which SKUs have an active
 * Paid Deliverable Version. That read is anonymous on purpose: it answers a
 * question every product card already answers out loud, it carries no staff
 * identity, and it is the only thing on the public browsing path.
 */
export function anonymousCommerceClient(): SupabaseClient {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
    auth: {
      // The session lives in this application's own http-only cookie, not in
      // the SDK: there is no browser here to persist it to, and each request
      // binds its own.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** A client acting as one staff member, at whatever assurance they have reached. */
export async function operatorCommerceClient(
  credentials: OperatorCredentials,
): Promise<SupabaseClient> {
  const supabase = anonymousCommerceClient();
  await supabase.auth.setSession({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
  });
  return supabase;
}
