import { expect, test } from "@playwright/test";

/**
 * What WeCreate and Sanity have agreed on.
 *
 * The acceptance suite never talks to Sanity. This is the check a fake cannot
 * make: that a Viewer token still reads the non-production dataset this
 * deployment is pointed at. It skips itself when the token is absent, and
 * refuses to run against `production`.
 */

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "";
const token = process.env.SANITY_API_READ_TOKEN ?? "";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-08-01";

test.describe("Reading unpublished content", () => {
  test.skip(
    !projectId || !token,
    "Set NEXT_PUBLIC_SANITY_PROJECT_ID and SANITY_API_READ_TOKEN to run these.",
  );

  test.beforeAll(() => {
    expect(
      dataset,
      "the contract suite refuses to run against the production dataset",
    ).not.toBe("production");
  });

  test("the Viewer token can query the dataset", async () => {
    const query = encodeURIComponent("*[_id == \"siteSettings\"][0]._id");
    const response = await fetch(
      `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${query}`,
      { headers: { authorization: `Bearer ${token}` } },
    );

    expect(response.ok, await response.text()).toBeTruthy();
    const body = (await response.json()) as { result?: unknown };
    expect(body).toHaveProperty("result");
  });
});
