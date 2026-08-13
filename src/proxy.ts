import { NextResponse, type NextRequest } from "next/server";

import { siteUrl } from "@/site-config";

/**
 * A former address answers 308, before anything renders.
 *
 * Publishing a changed slug has to leave a permanent redirect behind it (issue
 * #1), and a permanent redirect is a status code. Under Cache Components a route
 * with a dynamic segment streams its static shell before the slug is resolved,
 * so by the time the page knows the address has moved the response is already
 * committed and `permanentRedirect()` can only insert a client-side meta
 * redirect. That is why this runs here instead.
 *
 * `src/app/(site)/not-found.tsx` explains why the portfolio deliberately does
 * *not* do this: resolving every project slug in a proxy would put a content
 * read in front of every request into a growing collection, to upgrade a 200
 * into a 404. The trade is different for the two sections below. Their answer is
 * a small map cached under the content tag, the matcher touches no other route,
 * and what it buys is not a nicety — it is the redirect the ticket asks for.
 *
 * Each page keeps its own redirect as a fallback. If this lookup fails — the
 * server is still starting, the endpoint errors — the request falls through and
 * the visitor still lands on the right document, just without the status code.
 */

/**
 * The sections whose slugs an editor may change, and where each one's map of
 * abandoned addresses is served.
 *
 * Legal documents and Digital Products, and nothing else. Both are collections
 * something durable points at — an Order Snapshot references a legal revision,
 * a receipt links to the product it sold — so an address they leave behind has
 * to keep arriving.
 */
const REDIRECT_MAPS: Record<string, string> = {
  legal: "/api/legal/redirects",
  boutique: "/api/boutique/redirects",
};

export const config = { matcher: ["/legal/:path+", "/boutique/:path+"] };

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const [section, slug] = segments;
  const endpoint = REDIRECT_MAPS[section ?? ""];
  if (!endpoint || !slug) {
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

  // Resolved against this deployment's own configured origin rather than the
  // request's. The endpoint being read belongs to this application, so the
  // application is what should name it — and then where a blind server-side
  // fetch is aimed stops depending on how the runtime happens to build
  // `request.nextUrl`. Under `next start` that origin is the address the server
  // bound to and a forged `Host` does not reach it; on a platform that resolves
  // it from a forwarded host instead, this is the difference. Neither case has
  // to be reasoned about now that the value comes from configuration.
  let redirects: Record<string, string>;
  try {
    const response = await fetch(new URL(endpoint, siteUrl()));
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

  // Everything after the slug comes along: an order's receipt links to one named
  // legal revision, and that link has to survive the document being renamed just
  // as the document's own address does.
  const destination = new URL(request.nextUrl);
  destination.pathname = ["", section, movedTo, ...segments.slice(2)].join("/");

  // The address comes from the request; the origin it is resolved against comes
  // from configuration, for the same reason as the fetch above. What a
  // permanent redirect points at is the last thing that should vary with a
  // request header — a shared cache may go on serving it to somebody who asked
  // for the old address honestly. A relative `Location` would settle it more
  // simply still, but the proxy runtime rejects one outright, so the origin is
  // named rather than omitted.
  return NextResponse.redirect(
    new URL(`${destination.pathname}${destination.search}`, siteUrl()),
    308,
  );
}
