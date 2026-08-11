import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { MANAGED_CONTENT_TAG } from "@/managed-content/tag";
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
 * It is inert unless BOTH `WECREATE_TEST_HOOKS=1` and
 * `WECREATE_CONTENT_PROVIDER=fixture` are set, and it responds 404 rather than
 * 403 when they are not, so a deployed application does not advertise that the
 * route exists at all.
 */

type TestContentRequest =
  | { action: "reset" }
  | { action: "patchDrafts"; patch: DeepPartial<SiteContent> }
  | { action: "publishDrafts" };

const NOT_FOUND = new NextResponse("Not found", { status: 404 });

export async function POST(request: NextRequest): Promise<Response> {
  if (!areTestHooksEnabled()) {
    return NOT_FOUND;
  }

  const body = (await request.json()) as TestContentRequest;
  const store = await import("@/managed-content/fixture/store");

  switch (body.action) {
    case "reset":
      await store.resetFixtureDataset();
      break;
    case "patchDrafts":
      await store.patchFixtureDrafts(body.patch);
      break;
    case "publishDrafts":
      await store.publishFixtureDrafts();
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Reset and publish both change what the public site should serve. Patching a
  // draft does not, but revalidating anyway keeps the hook simple and cannot
  // produce a wrong result — only an unnecessary cache miss.
  revalidateTag(MANAGED_CONTENT_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, action: body.action });
}
