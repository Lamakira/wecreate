import { expect, test } from "@playwright/test";

/**
 * What WeCreate and Calendly have agreed on.
 *
 * There is no SDK and no credential: a Discovery Call is a URL. The href is
 * already asserted in the acceptance suite. This pings the page itself, so a
 * 404 on Calendly's side does not wait for a buyer to find it.
 *
 *     CALENDLY_CONTRACT=1 pnpm test:contract
 *
 * Opt-in because Calendly answers 404 to non-browser clients from some
 * networks, and a contract suite that failed CI for that would be a suite
 * nobody ran.
 */

const DISCOVERY_CALL = "https://calendly.com/wecreate-bj/30min";
const run = process.env.CALENDLY_CONTRACT === "1";

test.describe("The Discovery Call", () => {
  test.skip(
    !run,
    "Set CALENDLY_CONTRACT=1 to ping the booking page. Calendly 404s some non-browser clients; the href is asserted in e2e.",
  );

  test("the booking page still answers", async () => {
    const response = await fetch(DISCOVERY_CALL, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: {
        accept: "text/html",
        "user-agent":
          "Mozilla/5.0 (compatible; WeCreateContract/1.0; +https://wecreate.bj)",
      },
    });

    expect(response.status, `Calendly answered ${response.status}`).toBeLessThan(
      400,
    );
  });
});
