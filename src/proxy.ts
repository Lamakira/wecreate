import { NextResponse, type NextRequest } from "next/server";

/**
 * A former legal address answers 308, before anything renders.
 *
 * Publishing a changed slug has to leave a permanent redirect behind it (issue
 * #1), and a permanent redirect is a status code. Under Cache Components a
 * route with a dynamic segment streams its static shell before the slug is
 * resolved, so by the time the page knows the address has moved the response is
 * already committed and `permanentRedirect()` can only insert a client-side
 * meta redirect. That is why this runs here instead.
 *
 * `src/app/(site)/not-found.tsx` explains why the portfolio deliberately does
 * *not* do this: resolving every project slug in a proxy would put a content
 * read in front of every request into a growing collection, to upgrade a 200
 * into a 404. The trade is different here. There are five legal documents, the
 * answer is a tiny map cached under the content tag, the matcher touches no
 * other route, and what it buys is not a nicety — it is the redirect the ticket
 * asks for.
 *
 * The page keeps its own redirect as a fallback. If this lookup fails — the
 * server is still starting, the endpoint errors — the request falls through and
 * the visitor still lands on the right document, just without the status code.
 */
export const config = { matcher: "/legal/:path+" };

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const slug = segments[1];
  if (!slug) {
    return NextResponse.next();
  }

  // A slug is written into the path encoded, and an address nobody has ever had
  // can be encoded wrongly. A malformed one is not one of ours, so it falls
  // through to the page rather than throwing on the way in.
  let address: string;
  try {
    address = decodeURIComponent(slug);
  } catch {
    return NextResponse.next();
  }

  let redirects: Record<string, string>;
  try {
    const response = await fetch(
      new URL("/api/legal/redirects", request.nextUrl.origin),
    );
    if (!response.ok) {
      return NextResponse.next();
    }
    redirects = (await response.json()) as Record<string, string>;
  } catch {
    return NextResponse.next();
  }

  const movedTo = redirects[address];
  if (!movedTo) {
    return NextResponse.next();
  }

  // Everything after the slug comes along: an order's receipt links to one
  // named revision, and that link has to survive the document being renamed
  // just as the document's own address does.
  const destination = new URL(request.nextUrl);
  destination.pathname = ["", "legal", movedTo, ...segments.slice(2)].join("/");

  return NextResponse.redirect(destination, 308);
}
