import { createHash, createHmac } from "node:crypto";

import { expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * The buyer's inbox, the emailed link, and the private file behind it.
 *
 * Three things outside the application are stood in for here, and all three sit
 * at WeCreate's own outbound boundaries rather than inside anything.
 *
 * **The inbox.** A receipt is sent to an address this suite has no mailbox for,
 * so the fixture email provider keeps what it was asked to send and
 * `/api/test/email` reads it back. That endpoint is the buyer opening their
 * mail: it is the only way a scenario can learn the Order Access link, which is
 * exactly the position a real buyer is in.
 *
 * **The private store.** The fixture commerce data plane signs a temporary
 * address of its own instead of a Supabase one. Its scheme is spelled out below
 * by hand, for the reason `support/payment-events.ts` spells out the fixture's
 * signature and `support/digital-cart.ts` spells out the cart cookie: a helper
 * that imported the application's own code would agree with whatever the
 * application did, including with a link that never expired.
 *
 * **The failing sender.** `EMAIL_FAILURE_ADDRESS` is the fixture's documented
 * way of being unreachable — the same trick `PROVIDER_FAILURE_EMAIL` plays with
 * the payment provider. Fulfillment failing after an approved payment is a
 * state the buyer's page has to handle, and it cannot be demonstrated by
 * unplugging anything.
 */

/** Where the fixture data plane hosts its private files. Never resolved. */
export const STORAGE_ORIGIN = "https://stockage.wecreate.test";

/** What the fixture signs a temporary address with. */
const STORAGE_SIGNING_SECRET = "fixture-private-storage";

/** How long a generated file address is good for (issue #1: fifteen minutes). */
export const PRIVATE_LINK_SECONDS = 15 * 60;

/** A buyer whose receipt the email provider will not accept. */
export const EMAIL_FAILURE_ADDRESS = "panne-resend@exemple.test";

/** One message the application asked its email provider to send. */
export interface SentEmail {
  to: string;
  subject: string;
  body: string;
  idempotencyKey: string;
}

/** The buyer's mailbox, as far as this suite is concerned. */
export class Outbox {
  constructor(private readonly request: APIRequestContext) {}

  /** Throw away everything sent so far. */
  async reset(): Promise<void> {
    const response = await this.request.post("/api/test/email", {
      data: { action: "reset" },
    });
    if (response.status() === 404) {
      throw new Error(
        "The email test hook is not mounted. Playwright reuses an " +
          "already-running server outside CI, so this usually means a server " +
          "started by hand is holding the port. Stop it and re-run.",
      );
    }
    if (!response.ok()) {
      throw new Error(
        `Email test hook failed: ${response.status()} ${await response.text()}`,
      );
    }
  }

  /** Everything sent since the last reset, oldest first. */
  async messages(): Promise<SentEmail[]> {
    const response = await this.request.get("/api/test/email");
    expect(response.ok(), "the email test hook answers").toBeTruthy();
    return ((await response.json()) as { messages: SentEmail[] }).messages;
  }

  /** The one message sent to this address, insisting there is exactly one. */
  async only(to: string): Promise<SentEmail> {
    const sent = (await this.messages()).filter((message) => message.to === to);
    expect(sent, `exactly one message reached ${to}`).toHaveLength(1);
    return sent[0];
  }
}

/**
 * The Order Access address out of one message.
 *
 * A receipt names one and only one, and it is the whole of what a buyer has to
 * keep: the token is in it, and nothing else in the message stands in for it.
 */
export function accessLink(message: SentEmail): string {
  const found = message.body.match(/https?:\/\/\S*\/commande\/acces\/\S+/);
  expect(found, "the receipt carries an Order Access address").toBeTruthy();
  return (found as RegExpMatchArray)[0].replace(/[.,)]+$/, "");
}

/** The token in an Order Access address: the credential the buyer was sent. */
export function accessToken(link: string): string {
  return new URL(link).pathname.split("/").pop() as string;
}

/**
 * Everything the commerce data plane has written down, as text.
 *
 * The one place this suite reads the data plane's own storage instead of asking
 * the application. It is not a way around the seam — it asserts a *durable
 * outcome* issue #1 names explicitly, and one no page could ever show: that
 * persistence holds the digest of an Order Access token and never the token.
 * A scenario that could only ask the application would be asking the very code
 * whose storage is in question.
 *
 * The path is the one `playwright.config.ts` gives the server, and the digest
 * is computed here by hand rather than imported, for the reason the fixture's
 * webhook signature is spelled out in `support/payment-events.ts`.
 */
export async function storedCommerceData(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(
    process.env.WECREATE_COMMERCE_FIXTURE_FILE ??
      `${process.cwd()}/.wecreate/acceptance/commerce.json`,
    "utf8",
  );
}

/** SHA-256 of one token, hexadecimal: the only form that may be stored. */
export function tokenDigest(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** One product's row on an Order Access surface. */
export function accessRow(page: Page, sku: string) {
  return page.locator(`[data-testid="access-row"][data-sku="${sku}"]`);
}

/** Where the buyer presses to be handed a file. */
const DOWNLOAD_PATH = "/commande/acces/telechargement";

/**
 * Press *Télécharger* for one product, and answer with the address WeCreate
 * handed the browser.
 *
 * The press is real: a real form submission, to the real route, carrying this
 * browser's own access cookie, and its answer is read rather than invented.
 * What is stood in for is the last step only — a browser following an address
 * to `stockage.wecreate.test`, a host that deliberately does not exist. That is
 * the outbound boundary this suite fakes everywhere else, and it has to be
 * faked *here* rather than by answering the store: Chromium resolves the host
 * of a redirected form submission before Playwright is given the chance to
 * answer for it, so a route on the store would never fire.
 *
 * A refusal comes back to WeCreate instead, and the browser follows it exactly
 * as a buyer's does — banner and all.
 */
export async function pressDownload(page: Page, sku: string): Promise<string> {
  let handed = "";

  await page.route(`**${DOWNLOAD_PATH}`, async (route) => {
    const answer = await route.fetch({ maxRedirects: 0 });
    handed = answer.headers()["location"] ?? "";
    await route.fulfill({
      status: 303,
      headers: { location: handed.startsWith("http") ? "/commande/acces" : handed },
    });
  });

  // Armed before the press, and it cannot resolve against the page already
  // loaded: only a response that arrives from here on counts.
  const returned = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/commande/acces",
  );
  await accessRow(page, sku).getByTestId("access-download").click();
  await returned;
  await page.unroute(`**${DOWNLOAD_PATH}`);

  return handed;
}

/** Where the bytes of one Paid Deliverable Version are addressed. */
export function objectPathFor(sku: string, contents: string, extension: string): string {
  const checksum = createHash("sha256").update(contents, "utf8").digest("hex");
  return `${sku}/${checksum}${extension}`;
}

/**
 * Assert that an address is a genuine, temporary, private one for this file.
 *
 * Three separate claims, and each is one issue #12 makes: the address is not on
 * WeCreate's own origin, it names the immutable version the order recorded, and
 * it stops working — the expiry is signed with it, so a buyer cannot extend one
 * by editing the address.
 */
export function expectPrivateLink(
  url: string,
  expected: { objectPath: string },
): void {
  const address = new URL(url);
  expect(address.origin).toBe(STORAGE_ORIGIN);
  expect(address.pathname).toBe(`/paid-deliverables/${expected.objectPath}`);

  const expires = Number(address.searchParams.get("expire"));
  const seconds = expires - Math.floor(Date.now() / 1000);
  // Fifteen minutes, give or take the time this scenario has taken.
  expect(seconds).toBeGreaterThan(PRIVATE_LINK_SECONDS - 120);
  expect(seconds).toBeLessThanOrEqual(PRIVATE_LINK_SECONDS);

  expect(address.searchParams.get("signature")).toBe(
    createHmac("sha256", STORAGE_SIGNING_SECRET)
      .update(`${expected.objectPath}:${expires}`, "utf8")
      .digest("hex"),
  );
}
