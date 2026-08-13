import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { PAID_DELIVERABLES_TAG } from "@/commerce/tag";
import { areCommerceTestHooksEnabled } from "@/site-config";

/**
 * Test-only control over the fixture commerce data plane.
 *
 * The acceptance suite does everything else through the back office itself —
 * signing in, uploading, activating — because those are the behaviours under
 * test. What it cannot do through the back office is return the data plane to
 * its seeded state between scenarios, which is all this endpoint offers.
 *
 * It is inert unless BOTH `WECREATE_TEST_HOOKS=1` and
 * `WECREATE_COMMERCE_PROVIDER=fixture` are set, and answers 404 rather than 403
 * when they are not, so a deployment backed by a real Supabase project does not
 * advertise that the route exists at all.
 */

type TestCommerceRequest = { action: "reset" };

export async function POST(request: NextRequest): Promise<Response> {
  if (!areCommerceTestHooksEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = (await request.json()) as TestCommerceRequest;
  if (body.action !== "reset") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { resetCommerceFixture } = await import("@/commerce/fixture/store");
  await resetCommerceFixture();

  // A reset changes which products may be sold, so the Boutique's cached answer
  // has to go with it — the same thing activating a version does.
  revalidateTag(PAID_DELIVERABLES_TAG, { expire: 0 });

  return NextResponse.json({ ok: true, action: body.action });
}
