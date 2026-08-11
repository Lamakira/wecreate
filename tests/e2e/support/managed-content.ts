import type { APIRequestContext, Page } from "@playwright/test";

import { TEST_PREVIEW_SECRET, TEST_REVALIDATE_SECRET } from "../../../playwright.config";
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

  /** Return all content to its shipped baseline. */
  async reset(): Promise<void> {
    await this.post({ action: "reset" });
  }

  /** Edit content without publishing it — typing in the Studio. */
  async editDraft(patch: DeepPartial<SiteContent>): Promise<void> {
    await this.post({ action: "patchDrafts", patch });
  }

  /**
   * Publish the current draft, then tell the site to drop its cached copy —
   * the two halves of what pressing publish in Sanity does, the second half
   * arriving as a webhook.
   */
  async publish(): Promise<void> {
    await this.post({ action: "publishDrafts" });
    await this.triggerRevalidation();
  }

  /** The cache revalidation a publish webhook performs. */
  async triggerRevalidation(): Promise<number> {
    const response = await this.request.post("/api/revalidate", {
      headers: { authorization: `Bearer ${TEST_REVALIDATE_SECRET}` },
    });
    return response.status();
  }

  private async post(body: unknown): Promise<void> {
    const response = await this.request.post("/api/test/managed-content", {
      data: body,
    });
    if (response.status() === 404) {
      throw new Error(
        "The Managed Content test hook is not mounted. Playwright reuses an " +
          "already-running server outside CI, so this usually means a server " +
          "started by hand is holding the port. Stop it and re-run.",
      );
    }
    if (!response.ok()) {
      throw new Error(
        `Managed Content test hook failed: ${response.status()} ${await response.text()}`,
      );
    }
  }
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
