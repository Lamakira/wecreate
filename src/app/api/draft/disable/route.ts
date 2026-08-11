import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Ends a preview session and returns to the published site.
 *
 * Unauthenticated on purpose: leaving preview is always safe, and requiring a
 * secret would strand an editor inside a draft view.
 *
 * Redirects to a path rather than a reconstructed absolute URL, for the same
 * reason `/api/draft/enable` does — see the comment there.
 */
export async function GET(): Promise<Response> {
  const draft = await draftMode();
  draft.disable();
  return new NextResponse(null, { status: 307, headers: { location: "/" } });
}
