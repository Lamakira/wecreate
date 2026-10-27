import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The Sanity-specific halves of preview and cache revalidation.
 *
 * Both live here rather than in the route handlers so that `/api/draft/enable`
 * and `/api/revalidate` stay vendor-neutral: they decide *who is allowed*, and
 * call in here only when the caller is Sanity (ADR-0008).
 *
 * Everything talking to Sanity's client is imported lazily, so a fixture-backed
 * run never loads it or needs its environment variables. Webhook signatures
 * are verified with `node:crypto` rather than `next-sanity/webhook`, which
 * would otherwise pull the Studio toolkit into a request that is only checking
 * a header.
 */

const SIGNATURE_HEADER = "sanity-webhook-signature";
const SIGNATURE_HEADER_REGEX = /^t=(\d+)[, ]+v1=([^, ]+)$/;

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
 * A genuine Sanity publish webhook, verified by signature against the raw
 * request body, and the document type it named.
 *
 * `_type` is what the route maps onto cache tags. Missing or unrecognised
 * types are still a successful verification: the caller decides to expire
 * everything rather than to expire nothing.
 */
export async function readSignedSanityWebhook(
  request: Request,
  secret: string,
): Promise<{ ok: true; documentType: string | undefined } | { ok: false }> {
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!signature || !secret) {
    return { ok: false };
  }

  const raw = await request.text();
  if (!verifySanitySignature(raw, signature, secret)) {
    return { ok: false };
  }

  // Sanity's Content Lake can lag the webhook by a beat. The wait is the
  // same one `next-sanity/webhook`'s parseBody takes, so a refetch after
  // we expire the cache sees the document that was just published. Fixture
  // runs have no Content Lake and skip it.
  if (process.env.WECREATE_TEST_HOOKS !== "1") {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  return { ok: true, documentType: documentTypeFromBody(raw) };
}

function verifySanitySignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const match = signature.trim().match(SIGNATURE_HEADER_REGEX);
  if (!match || !body) {
    return false;
  }

  const [, timestamp, actual] = match;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("base64url");

  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(actualBytes, expectedBytes);
}

function documentTypeFromBody(raw: string): string | undefined {
  if (!raw.trim()) {
    return undefined;
  }

  try {
    const body: unknown = JSON.parse(raw);
    if (
      body &&
      typeof body === "object" &&
      "_type" in body &&
      typeof body._type === "string"
    ) {
      return body._type;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
