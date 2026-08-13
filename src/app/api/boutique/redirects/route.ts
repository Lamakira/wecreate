import { NextResponse } from "next/server";

import { readDigitalProductSlugRedirects } from "@/managed-content";

/**
 * Which Digital Product addresses have moved, and where to.
 *
 * The Boutique's half of what `/api/legal/redirects` does, and it exists for the
 * same reason: `src/proxy.ts` runs before rendering and cannot open the content
 * cache the rest of the application reads through, so the map it needs is served
 * as a route.
 *
 * The body is the published slug map and nothing else — former addresses, all of
 * them public URLs already. It is cached under the Managed Content tag by the
 * read behind it, so a publish that changes a slug is reflected on the next
 * request rather than at the next revalidation.
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(await readDigitalProductSlugRedirects());
}
