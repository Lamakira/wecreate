import { NextResponse } from "next/server";

import {
  forgetInvitationToken,
  writeInvitationToken,
} from "@/brand-questionnaire/session";

/** The shape every real token has; see `invitation.ts`. Nothing else is kept. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{40,1200}$/;

/**
 * The address in the client's email: where the token comes in, and where it
 * stops travelling (issue #57).
 *
 * It does one thing. The token is moved out of the URL and into an http-only
 * cookie, and the browser is sent to `/questionnaire` — so the page the client
 * reads, reloads or shows somebody carries no credential, and no referrer it
 * sends can carry one either.
 *
 * **It decides nothing.** A token not shaped like ours is not kept (and any
 * earlier one is forgotten, so a wrong link cannot leave a right one's form
 * open); every other answer is the same redirect. Whether the token opens the
 * questionnaire is settled by the page, once, in one place.
 *
 * A route handler rather than a page, because setting a cookie is what it is
 * for and a page in Next.js cannot write one.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jeton: string }> },
): Promise<Response> {
  const { jeton } = await params;
  if (TOKEN_SHAPE.test(jeton)) {
    await writeInvitationToken(jeton);
  } else {
    await forgetInvitationToken();
  }

  // Relative, so the browser resolves it against the address it dialled; 303 so
  // a reload repeats the page rather than the address carrying the token.
  return new NextResponse(null, {
    status: 303,
    headers: {
      location: "/questionnaire",
      "cache-control": "no-store, must-revalidate",
    },
  });
}
