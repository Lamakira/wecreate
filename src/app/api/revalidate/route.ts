import { NextResponse, type NextRequest } from "next/server";

import { matchesSecret } from "@/lib/secrets";
import {
  expireAllManagedContent,
  expireManagedContent,
} from "@/managed-content/invalidation";
import { revalidateSecret } from "@/site-config";

/**
 * Drops cached published Managed Content so a publish is live on the next
 * request.
 *
 * Two accepted callers, mirroring `/api/draft/enable`:
 *
 * - A Sanity webhook, verified by signature against the raw request body. The
 *   document `_type` in that body selects which slices expire. An absent or
 *   unrecognised type expires everything rather than nothing.
 * - A bearer token equal to `WECREATE_REVALIDATE_SECRET`, which always expires
 *   every slice: the operator blunt instrument, and the recovery path when
 *   scoping is wrong.
 *
 * `{ expire: 0 }` rather than the stale-while-revalidate default: an editor who
 * presses publish expects to reload and see the change, not the previous
 * version once more while a refresh happens behind them.
 */
async function authorise(request: NextRequest): Promise<
  | { kind: "bearer" }
  | { kind: "webhook"; documentType: string | undefined }
  | { kind: "none" }
> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (matchesSecret(bearer, revalidateSecret())) {
    return { kind: "bearer" };
  }

  const webhookSecret = process.env.SANITY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return { kind: "none" };
  }

  try {
    const { readSignedSanityWebhook } = await import("@/sanity/preview");
    const parsed = await readSignedSanityWebhook(request, webhookSecret);
    if (!parsed.ok) {
      return { kind: "none" };
    }

    return { kind: "webhook", documentType: parsed.documentType };
  } catch {
    return { kind: "none" };
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authorise(request);
  if (auth.kind === "none") {
    return NextResponse.json({ revalidated: false }, { status: 401 });
  }

  const tags =
    auth.kind === "bearer"
      ? expireAllManagedContent()
      : expireManagedContent(auth.documentType);

  return NextResponse.json({ revalidated: true, tags });
}
