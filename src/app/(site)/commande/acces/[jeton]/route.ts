import { NextResponse } from "next/server";

import { writeAccessToken } from "@/fulfillment/session";
import { isAccessToken } from "@/fulfillment/token";

/**
 * The address in the buyer's receipt: where the token comes in, and where it
 * stops travelling.
 *
 * It does one thing. The token is moved out of the URL and into an http-only
 * cookie, and the browser is sent to `/commande/acces` — so the page the buyer
 * actually reads, reloads, bookmarks or shows to somebody carries no
 * credential, and no referrer it sends can carry one either. The address in
 * their mail still does, which is unavoidable for a link somebody has to be
 * able to follow twice, and is why the token expires with the access.
 *
 * **It decides nothing.** A token that is not shaped like one of ours is simply
 * not written down — there is no lookup to spend a round trip on — and every
 * other answer, including a token nobody was ever given and one that expired
 * last week, is the same redirect. Whether the access opens anything is settled
 * by the page, once, in one place.
 *
 * A route handler rather than a page, because setting a cookie is what it is
 * for and a page in Next.js cannot write one.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jeton: string }> },
): Promise<Response> {
  const { jeton } = await params;
  if (isAccessToken(jeton)) {
    await writeAccessToken(jeton);
  }

  // A relative `Location`, which the browser resolves against the address it
  // actually dialled: an absolute one built from this request would be built
  // from a `Host` header somebody else chose. 303 so the browser lands on the
  // page with a GET, and so a reload repeats the page rather than the address
  // carrying the token.
  return new NextResponse(null, {
    status: 303,
    headers: {
      location: "/commande/acces",
      // What this answers depends entirely on a cookie it has just set. Nothing
      // between here and the browser may keep it.
      "cache-control": "no-store, must-revalidate",
    },
  });
}
