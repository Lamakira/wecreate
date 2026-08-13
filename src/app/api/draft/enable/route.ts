import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { matchesSecret } from "@/lib/secrets";
import { isSanityConfigured } from "@/sanity/env";
import { previewSecret } from "@/site-config";

/**
 * Opens a preview session, the only way to see unpublished Managed Content.
 *
 * Two callers, two ways of proving they may:
 *
 * - Sanity's Presentation tool, authenticated with the editor's own Sanity
 *   session — `defineEnableDraftMode` validates it against the project.
 * - A non-Sanity client (a fixture-backed run, or an operator following a
 *   preview link) presenting `WECREATE_PREVIEW_SECRET`.
 *
 * Anything else gets 401. Next.js sets a signed bypass cookie on success, which
 * both selects the draft perspective and keeps the response out of the shared
 * cache.
 */

/**
 * Only same-origin absolute paths, so a preview link cannot become an open
 * redirect.
 *
 * A leading `/` is not enough on its own. `//evil.example` is a
 * protocol-relative URL, and a browser parsing a `Location` treats a backslash
 * exactly as it treats a slash — so `/\evil.example` and `/\/evil.example` are
 * off-origin too, however much they look like paths. The backslash is rejected
 * outright rather than in the one position that is dangerous today: no route
 * this application serves contains one, so there is nothing to lose by it.
 */
function safeRedirectPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }
  return value;
}

/**
 * Redirect to a path, not to a reconstructed absolute URL.
 *
 * The draft-mode cookie has just been set for the host the editor is actually
 * on. Rebuilding an absolute location from the request can substitute a
 * different host for the same server — `localhost` for `127.0.0.1`, or the
 * origin behind a proxy — and the browser would then drop the cookie as
 * cross-origin and show the published page instead of the preview.
 */
function redirectToPath(path: string): Response {
  return new NextResponse(null, { status: 307, headers: { location: path } });
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);

  if (matchesSecret(searchParams.get("secret"), previewSecret())) {
    const draft = await draftMode();
    draft.enable();
    return redirectToPath(safeRedirectPath(searchParams.get("path")));
  }

  if (isSanityConfigured) {
    const { enableDraftModeFromSanity } = await import("@/sanity/preview");
    return enableDraftModeFromSanity(request);
  }

  return new NextResponse("Aperçu non autorisé.", { status: 401 });
}
