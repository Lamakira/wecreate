import { expect, test } from "@playwright/test";

/**
 * What WeCreate and Resend have agreed on.
 *
 * It never sends a buyer email. Listing verified domains is enough to prove
 * the key is accepted and that this environment has a sender to talk through.
 *
 *     RESEND_API_KEY=re_… pnpm test:contract
 */

const apiKey = process.env.RESEND_API_KEY ?? "";

test.describe("The sender domain", () => {
  test.skip(
    !apiKey,
    "Set RESEND_API_KEY from a non-production Resend account to run these.",
  );

  test("the API key can list domains and sends nothing", async () => {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    expect(response.ok, await response.text()).toBeTruthy();
    const body = (await response.json()) as { data?: unknown };
    expect(body).toHaveProperty("data");
  });
});
