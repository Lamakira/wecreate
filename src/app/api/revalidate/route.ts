import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { matchesSecret } from "@/lib/secrets";
import { MANAGED_CONTENT_TAG } from "@/managed-content/tag";
import { revalidateSecret } from "@/site-config";

/**
 * Drops the cached published site so a publish is live on the next request.
 *
 * Two accepted callers, mirroring `/api/draft/enable`:
 *
 * - A Sanity webhook, verified by signature against the raw request body.
 * - A bearer token equal to `WECREATE_REVALIDATE_SECRET`, for operators and for
 *   runs that are not backed by Sanity at all.
 *
 * `{ expire: 0 }` rather than the stale-while-revalidate default: an editor who
 * presses publish expects to reload and see the change, not the previous
 * version once more while a refresh happens behind them.
 */
async function isAuthorised(request: NextRequest): Promise<boolean> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (matchesSecret(bearer, revalidateSecret())) {
    return true;
  }

  const webhookSecret = process.env.SANITY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return false;
  }

  const { isSignedSanityWebhook } = await import("@/sanity/preview");
  return isSignedSanityWebhook(request, webhookSecret);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }

  revalidateTag(MANAGED_CONTENT_TAG, { expire: 0 });

  return NextResponse.json({ revalidated: true, tag: MANAGED_CONTENT_TAG });
}
