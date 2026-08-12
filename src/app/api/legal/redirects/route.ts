import { NextResponse } from "next/server";

import { readLegalSlugRedirects } from "@/managed-content";

/**
 * Which legal addresses have moved, and where to.
 *
 * `src/proxy.ts` reads this on the way into `/legal/…` so a former address
 * answers with a real 308 rather than with a page that redirects itself once it
 * has already started rendering. It exists as a route rather than as an import
 * because the proxy runs before rendering and cannot open the content cache the
 * rest of the application reads through.
 *
 * The body is the published slug map and nothing else: five documents' former
 * addresses, all of them public URLs already. It is cached under the Managed
 * Content tag by the read behind it, so a publish that changes a slug is
 * reflected on the next request rather than at the next revalidation.
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(await readLegalSlugRedirects());
}
