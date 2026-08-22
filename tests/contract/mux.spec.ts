import { expect, test } from "@playwright/test";

/**
 * What WeCreate and Mux have agreed on.
 *
 * Mux credentials live in the Sanity dataset, not in the environment, so this
 * suite cannot create an asset. What it can check, when a public playback id
 * is supplied, is that a stream URL Mux would hand a player still answers.
 *
 *     MUX_PLAYBACK_ID=… pnpm test:contract
 */

const playbackId = process.env.MUX_PLAYBACK_ID ?? "";

test.describe("Public playback", () => {
  test.skip(
    !playbackId,
    "Set MUX_PLAYBACK_ID from a non-production Mux asset to run these.",
  );

  test("the playback URL still answers", async () => {
    const response = await fetch(
      `https://stream.mux.com/${playbackId}.m3u8`,
      { redirect: "follow", signal: AbortSignal.timeout(15_000) },
    );

    expect(response.ok, `Mux answered ${response.status}`).toBeTruthy();
    expect(response.headers.get("content-type") ?? "").toMatch(/mpegurl|application\/vnd\.apple\.mpegurl|octet-stream/);
  });
});
