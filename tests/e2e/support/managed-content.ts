import { createHmac } from "node:crypto";

import type { APIRequestContext, Page } from "@playwright/test";

import {
  TEST_PREVIEW_SECRET,
  TEST_REVALIDATE_SECRET,
  TEST_SANITY_WEBHOOK_SECRET,
} from "../../../playwright.config";
import type { DeepPartial } from "../../../src/managed-content/merge";
import type { SiteContent } from "../../../src/managed-content/types";

/**
 * Editorial actions, expressed the way a Content Editor would describe them.
 *
 * Every one of these goes over HTTP to the running application. Tests never
 * import the content provider or reach into the server's state, so they keep
 * describing behaviour rather than implementation.
 */
export class ManagedContent {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Return all content to its shipped baseline, drop every cached slice and
   * zero the published-read count.
   */
  async reset(): Promise<void> {
    await this.post({ action: "reset" });
  }

  /** Edit content without publishing it — typing in the Studio. */
  async editDraft(patch: DeepPartial<SiteContent>): Promise<void> {
    await this.post({ action: "patchDrafts", patch });
  }

  /**
   * Publish the current draft, then drop the cached slices that document type
   * affects — the two halves of what pressing publish in Sanity does.
   *
   * With no type, everything expires: the same fallback a webhook with an
   * unrecognised `_type` takes, and what every scenario that is not proving
   * scoping wants.
   */
  async publish(documentType?: string): Promise<void> {
    await this.post({
      action: "publishDrafts",
      ...(documentType ? { documentType } : {}),
    });
  }

  /**
   * Promote the draft to published without touching the cache.
   *
   * What pressing publish in the Studio does to the dataset, before the
   * webhook arrives. Used to drive `/api/revalidate` itself.
   */
  async persistPublished(): Promise<void> {
    await this.post({ action: "publishDrafts", revalidate: false });
  }

  /**
   * Forget how many times the fixture has been read, without touching the
   * cache or the content. A scenario that has had to seed content first uses
   * this so the next count is only the reads the render under test caused.
   */
  async resetReadCount(): Promise<void> {
    await this.post({ action: "resetReadCount" });
  }

  /** Published reads the fixture has served since the last reset. */
  async publishedReads(): Promise<number> {
    const response = await this.request.get("/api/test/managed-content");
    const text = await response.text();
    this.assertHook(response.status(), text);
    return (JSON.parse(text) as { publishedReads: number }).publishedReads;
  }

  /** The cache revalidation a bearer-token operator call performs. */
  async triggerRevalidation(): Promise<number> {
    const response = await this.request.post("/api/revalidate", {
      headers: { authorization: `Bearer ${TEST_REVALIDATE_SECRET}` },
    });
    return response.status();
  }

  /**
   * The cache revalidation a Sanity publish webhook performs, signed the way
   * Sanity signs it, over the raw body.
   */
  async triggerWebhook(documentType?: string): Promise<number> {
    const body =
      documentType === undefined
        ? "{}"
        : JSON.stringify({ _type: documentType });
    const timestamp = Date.now();
    const signature = signSanityWebhook(body, timestamp);
    const response = await this.request.post("/api/revalidate", {
      headers: {
        "content-type": "application/json",
        "sanity-webhook-signature": signature,
      },
      data: Buffer.from(body, "utf8"),
    });
    return response.status();
  }

  private async post(body: unknown): Promise<void> {
    const response = await this.request.post("/api/test/managed-content", {
      data: body,
    });
    this.assertHook(response.status(), await response.text());
  }

  private assertHook(status: number, text: string): void {
    if (status === 404) {
      throw new Error(
        "The Managed Content test hook is not mounted. Playwright reuses an " +
          "already-running server outside CI, so this usually means a server " +
          "started by hand is holding the port. Stop it and re-run.",
      );
    }
    if (status < 200 || status >= 300) {
      throw new Error(`Managed Content test hook failed: ${status} ${text}`);
    }
  }
}

/**
 * Sanity's webhook signature: HMAC-SHA256 of `timestamp.payload`, written as
 * `t=<ms>,v1=<base64url>`. Spelled here rather than imported so a change to
 * how the application verifies has to be a deliberate change to this file too.
 */
function signSanityWebhook(body: string, timestamp: number): string {
  const digest = createHmac("sha256", TEST_SANITY_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("base64url");
  return `t=${timestamp},v1=${digest}`;
}

/** Open a preview session in this browser context. */
export async function enterPreview(page: Page, path = "/"): Promise<void> {
  await page.goto(
    `/api/draft/enable?secret=${TEST_PREVIEW_SECRET}&path=${encodeURIComponent(path)}`,
  );
}

export async function leavePreview(page: Page): Promise<void> {
  await page.goto("/api/draft/disable");
}
