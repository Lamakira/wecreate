import "server-only";

/**
 * The Sanity-specific halves of preview and cache revalidation.
 *
 * Both live here rather than in the route handlers so that `/api/draft/enable`
 * and `/api/revalidate` stay vendor-neutral: they decide *who is allowed*, and
 * call in here only when the caller is Sanity (ADR-0008).
 *
 * Everything is imported lazily, so a fixture-backed run never loads the Sanity
 * client or needs its environment variables.
 */

/**
 * Open a preview session for an editor arriving from Sanity's Presentation
 * tool, authenticated by their own Sanity session rather than a shared secret.
 */
export async function enableDraftModeFromSanity(
  request: Request,
): Promise<Response> {
  const { defineEnableDraftMode } = await import("next-sanity/draft-mode");
  const { getSanityClient } = await import("./client");

  const { GET } = defineEnableDraftMode({ client: getSanityClient("drafts") });
  return GET(request);
}

/**
 * Whether a revalidation request is a genuine Sanity webhook, verified by
 * signature against the raw request body.
 */
export async function isSignedSanityWebhook(
  request: Request,
  secret: string,
): Promise<boolean> {
  const { parseBody } = await import("next-sanity/webhook");
  const { NextRequest } = await import("next/server");

  const nextRequest =
    request instanceof NextRequest ? request : new NextRequest(request);
  const { isValidSignature } = await parseBody(nextRequest, secret);
  return isValidSignature === true;
}
