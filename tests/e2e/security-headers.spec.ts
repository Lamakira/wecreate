import { expect, test } from "@playwright/test";

import { TEST_PREVIEW_SECRET } from "../../playwright.config";
import { ManagedContent } from "./support/managed-content";

/**
 * What the application says about itself before it says anything else.
 *
 * These are response headers, so they are checked the only way they are ever
 * observable: by asking for a page and reading what came back with it. There is
 * nothing here about how the policy is assembled — `next.config.ts` could set
 * these five headers by any means it liked and this file would not notice.
 *
 * The pairing that matters is the last two tests. The public site and the
 * Studio are served *different* policies on purpose, and a change that
 * accidentally gave the marketing pages the Studio's relaxations — which admit
 * runtime code evaluation — would still pass a test that only asked whether a
 * Content-Security-Policy was present.
 */

/** The header value, split into the directives it actually asserts. */
function directives(header: string | null): Map<string, string> {
  return new Map(
    (header ?? "")
      .split(";")
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...values] = directive.split(/\s+/);
        return [name, values.join(" ")] as const;
      }),
  );
}

test.beforeEach(async ({ request }) => {
  await new ManagedContent(request).reset();
});

test.describe("Security headers", () => {
  test("serves the baseline headers with a public page", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);

    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    // The video player's fullscreen control keeps working; nothing else is
    // asked for, so nothing else is granted.
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["permissions-policy"]).toContain("fullscreen=(self)");
  });

  test("serves the baseline headers with an API response too", async ({
    request,
  }) => {
    // A route handler is a response like any other, and `nosniff` is the header
    // that matters most on one: it is what stops a JSON body being interpreted
    // as something executable.
    const response = await request.get("/api/legal/redirects");
    expect(response.status()).toBe(200);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("constrains what a public page may load and who may frame it", async ({
    request,
  }) => {
    const response = await request.get("/");
    const policy = directives(response.headers()["content-security-policy"]);

    expect(policy.get("default-src")).toBe("'self'");
    expect(policy.get("base-uri")).toBe("'self'");
    expect(policy.get("object-src")).toBe("'none'");
    // This origin, and the two places a submission on it redirects out to: the
    // payment provider's hosted page, and the private store an Order Access
    // download is handed over from. Nothing else — a form may not post to
    // another site. The store named here is the fixture's, because that is the
    // data plane this run is configured with; a real deployment names its
    // Supabase host, derived from `SUPABASE_URL`.
    expect(policy.get("form-action")).toBe(
      "'self' https://*.fedapay.com https://stockage.wecreate.test",
    );
    // Sanity's Presentation tool frames the site from this same origin. Nobody
    // else may, which is the whole of the clickjacking control.
    expect(policy.get("frame-ancestors")).toBe("'self'");

    // Script may come from this origin and nowhere else. The inline allowance
    // is deliberate and reasoned in `next.config.ts`; an injected `<script src>`
    // pointing anywhere is still refused.
    const scriptSrc = policy.get("script-src") ?? "";
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain("http");
  });

  test("does not lend the public site the Studio's relaxations", async ({
    request,
  }) => {
    const site = directives(
      (await request.get("/")).headers()["content-security-policy"],
    );

    // The Studio evaluates code at runtime and the marketing pages never do.
    // This is the assertion that keeps the two policies from converging.
    expect(site.get("script-src")).not.toContain("'unsafe-eval'");
    expect(site.get("connect-src")).not.toContain("wss:");
  });

  test("serves the Studio its own, wider policy", async ({ request }) => {
    const response = await request.get("/studio");
    const policy = directives(response.headers()["content-security-policy"]);

    // Sanity's Studio is a vendor single-page application: it evaluates code at
    // runtime and holds a websocket open to the content API.
    expect(policy.get("script-src")).toContain("'unsafe-eval'");
    expect(policy.get("connect-src")).toContain("wss://*.sanity.io");

    // Wider is not unbounded. The Studio is still the document doing the
    // framing rather than one to be framed, and the baseline still applies.
    expect(policy.get("frame-ancestors")).toBe("'self'");
    expect(policy.get("object-src")).toBe("'none'");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("Preview redirect target", () => {
  /**
   * Every spelling of "leave this origin" that still looks like a path. A
   * browser parsing a `Location` treats `\` as `/`, so the backslash forms are
   * off-origin however much they read as relative.
   */
  const offOrigin = [
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example",
  ];

  for (const path of offOrigin) {
    test(`sends an editor home rather than to ${path}`, async ({ request }) => {
      const response = await request.get(
        `/api/draft/enable?secret=${TEST_PREVIEW_SECRET}&path=${encodeURIComponent(path)}`,
        { maxRedirects: 0 },
      );

      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toBe("/");
    });
  }

  test("still honours a genuine path", async ({ request }) => {
    const response = await request.get(
      `/api/draft/enable?secret=${TEST_PREVIEW_SECRET}&path=${encodeURIComponent("/portfolio")}`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/portfolio");
  });
});
