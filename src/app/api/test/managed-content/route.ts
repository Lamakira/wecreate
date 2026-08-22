import { NextResponse, type NextRequest } from "next/server";

import {
  expireAllManagedContent,
  expireManagedContent,
} from "@/managed-content/invalidation";
import type { DeepPartial } from "@/managed-content/merge";
import type { SiteContent } from "@/managed-content/types";
import { areTestHooksEnabled } from "@/site-config";

/**
 * Test-only control over the fixture content provider.
 *
 * The acceptance suite drives editorial behaviour — draft, preview, publish,
 * revalidate — through this endpoint instead of reaching into the application's
 * internals, which is what lets those tests run against the real running app.
 *
 * Publish expires the same slices `/api/revalidate` would for that document
 * type, so scoped invalidation is reachable from the suite. Reset expires
 * everything, because the dataset itself has been replaced.
 *
 * It is inert unless BOTH `WECREATE_TEST_HOOKS=1` and
 * `WECREATE_CONTENT_PROVIDER=fixture` are set, and it responds 404 rather than
 * 403 when they are not, so a deployed application does not advertise that the
 * route exists at all.
 */

type TestContentRequest =
  | { action: "reset" }
  | { action: "patchDrafts"; patch: DeepPartial<SiteContent> }
  | { action: "publishDrafts"; documentType?: string; revalidate?: boolean }
  | { action: "resetReadCount" };

const NOT_FOUND = new NextResponse("Not found", { status: 404 });

export async function GET(): Promise<Response> {
  if (!areTestHooksEnabled()) {
    return NOT_FOUND;
  }

  const { draftReadCount, publishedReadCount } = await import(
    "@/managed-content/fixture/provider"
  );
  return NextResponse.json(
    {
      publishedReads: await publishedReadCount(),
      draftReads: await draftReadCount(),
    },
    { headers: { "cache-control": "no-store, must-revalidate" } },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!areTestHooksEnabled()) {
    return NOT_FOUND;
  }

  const body = (await request.json()) as TestContentRequest;
  const store = await import("@/managed-content/fixture/store");
  const { resetReadCounts } = await import(
    "@/managed-content/fixture/provider"
  );

  switch (body.action) {
    case "reset":
      await store.resetFixtureDataset();
      await resetReadCounts();
      expireAllManagedContent();
      break;
    case "patchDrafts":
      await store.patchFixtureDrafts(body.patch);
      break;
    case "publishDrafts":
      await store.publishFixtureDrafts();
      if (body.revalidate !== false) {
        expireManagedContent(body.documentType);
      }
      break;
    case "resetReadCount":
      await resetReadCounts();
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, action: body.action });
}
