import { NextResponse } from "next/server";

import { performSupportOperation } from "@/commerce/support-operations";
import { siteUrl } from "@/site-config";

/**
 * Where every support gesture on one order is posted.
 *
 * **A route handler rather than a Server Function**, and the reason is the
 * answer rather than the work. Each of these ends by sending the operator back
 * to the dossier with a French sentence in the address — the posture
 * `messages.ts` describes for the whole back office — and a redirect returned
 * from a Server Function is applied by the client router, which on this route
 * keeps the address it is already on and drops the sentence with it. A `303`
 * from here is a navigation the browser performs itself: the address is the
 * one WeCreate named, with or without JavaScript.
 *
 * It is a `POST` for the reason `/commande/acces/telechargement` is one: each
 * of these changes something, and a `GET` could be prefetched, followed by a
 * scanner or replayed out of history.
 *
 * **What authorises it is the session cookie, not the form.** That cookie is
 * `httpOnly`, `SameSite=Lax` and scoped to `/commerce`, so a form on somebody
 * else's site cannot make this request carry it at all — a cross-site `POST`
 * arrives with no session and is answered as an expired one. The `Origin` check
 * below is the second line rather than the first, and is skipped when the header
 * is absent because clients that are not browsers do not send one.
 *
 * Nothing about the operation is decided here. Which gestures exist, what each
 * requires and what it may touch are in `support-operations.ts`, beside the
 * rules they apply.
 */

/** Send the browser where the operation said, and let nothing keep the answer. */
function see(destination: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      // Relative, so the browser resolves it against the address it dialled
      // rather than against a `Host` header somebody else chose.
      location: destination,
      "cache-control": "no-store, must-revalidate",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && origin !== siteUrl()) {
    return see("/commerce/commandes");
  }

  return see(await performSupportOperation(await request.formData()));
}
