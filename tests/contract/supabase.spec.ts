import { expect, test } from "@playwright/test";

/**
 * What WeCreate and Supabase have agreed on.
 *
 * The anonymous key is server-only and the `commerce` schema is deliberately
 * not exposed. This suite checks that the project answers and that walking
 * PostgREST does not list the orders table. It skips itself when the project
 * is unset, and never uses a service role key — this application has none.
 */

const url = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";

test.describe("The anonymous API", () => {
  test.skip(
    !url || !anonKey,
    "Set SUPABASE_URL and SUPABASE_ANON_KEY from a non-production project to run these.",
  );

  test("auth is reachable with the anonymous key", async () => {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}` },
    });
    expect(response.ok, await response.text()).toBeTruthy();
  });

  test("does not expose the commerce tables on PostgREST", async () => {
    const response = await fetch(`${url}/rest/v1/orders`, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        accept: "application/json",
      },
    });

    // PGRST205 is "table not in the schema cache" — the commerce schema is
    // left out of the exposed schemas on purpose. A 200 would mean an order
    // listing had been published to anyone holding the anonymous key.
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
