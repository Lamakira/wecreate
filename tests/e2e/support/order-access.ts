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
 *
 * **The sender that fails and then stops failing.** `Outbox.outage()` is the
 * same idea with the fault under the scenario's control rather than the
 * address's: a mail provider that refuses, or one that takes longer to answer
 * than anybody is willing to wait, and then comes back. A permanently
 * unreachable sender can only ever demonstrate a delivery that stayed failed —
 * issue #14 asks for one that is taken up again and finishes.
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

  /**
   * Put the mail provider out of action, or bring it back.
   *
   * `refuse` is a provider answering that it will not take the message.
   * `stall` is the worse one and the one issue #14 names: a provider that takes
   * longer to answer than the request waiting on it, which is how a delivery
   * ends up claimed and unfinished. `off` is the provider working again.
   */
  async outage(
    mode: "off" | "refuse" | "stall",
    seconds = 0,
  ): Promise<void> {
    const response = await this.request.post("/api/test/email", {
      data: { action: "outage", mode, seconds },
    });
    expect(response.ok(), "the email test hook accepts an outage").toBeTruthy();
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

/**
 * The same storage, read as records rather than as text.
 *
 * Issue #14 asks for outcomes that are *durable* and for anomaly data kept for
 * a Commerce Operator view that does not exist yet, and neither can be observed
 * through a page: exactly one grant behind a doubled webhook, every event of a
 * reordered sequence still present, a second approved transaction flagged. Each
 * is a claim about what persistence holds, so persistence is what is read.
 *
 * The shape is spelled out here by hand rather than imported, for the reason
 * `support/digital-cart.ts` spells out the cart cookie: changing how the data
 * plane keeps any of this has to be a deliberate change to this file too.
 */
export interface StoredCommerce {
  orders: {
    reference: string;
    paymentState: string;
    fulfillmentState: string;
    /**
     * What the buyer typed, and what the order recorded.
     *
     * Read here because issue #15 asks for something no page can show: that a
     * Commerce Operator correcting a mistyped address changes where the next
     * message goes and changes *nothing* about the Order Snapshot — the same
     * lines, the same prices, the same Paid Deliverable Versions, the same
     * contact details the buyer wrote. A surface can be made to print the old
     * value; only storage can say it is still the stored one.
     */
    buyer: { fullName: string; email: string; telephone: string };
    lines: {
      sku: string;
      unitPriceXof: number;
      paidDeliverableVersion: number;
    }[];
    /** The separate, later fact recorded beside the snapshot, or nothing. */
    correction: {
      email: string | null;
      telephone: string | null;
      reason: string;
      correctedByEmail: string;
    } | null;
  }[];
  paymentEvents: {
    providerEventId: string;
    providerTransactionId: string;
    outcome: string;
    effect: string;
  }[];
  access: { orderReference: string; tokenDigest: string }[];
  grants: {
    orderReference: string;
    sku: string;
    downloadsAllowed: number;
    downloadsUsed: number;
    /** A later version a Commerce Operator granted, or nothing (issue #15). */
    upgradedVersionId: string | null;
  }[];
  /** What a Commerce Operator is asked to look at (issue #15). */
  anomalies: {
    id: string;
    kind: string;
    orderReference: string;
    provider: string | null;
    providerTransactionId: string | null;
    providerEventId: string | null;
    /** Words this application wrote, where it had any to write. */
    detail: string | null;
    resolvedAt: string | null;
    /** What a person decided about it, once one has. */
    resolution: string | null;
    resolvedByEmail: string | null;
  }[];
  /** The append-only trail, which no support action may rewrite. */
  audit: {
    action: string;
    actorEmail: string;
    sku: string | null;
    orderReference: string | null;
  }[];
}

export async function storedCommerce(): Promise<StoredCommerce> {
  return JSON.parse(await storedCommerceData()) as StoredCommerce;
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

/**
 * The cookie the emailed token is exchanged for, named here by hand.
 *
 * `pressTogether` below sends it as a header, for the reason
 * `support/digital-cart.ts` spells the cart cookie out: a helper that imported
 * the application's own name for it would agree with whatever the application
 * called it.
 */
const ACCESS_COOKIE = "wc_acces";

/**
 * Press *Télécharger* several times at once, and answer with what WeCreate
 * handed each of them.
 *
 * Concurrency is the point, so these do not go through the button:
 * `pressDownload` above submits a form and waits for the page to come back,
 * which serialises the presses and would test nothing about two of them racing.
 *
 * They carry the buyer's own credential the way their browser carries it — as
 * the access cookie, in the header, on a real POST to the real route. Sending
 * it by hand rather than letting the cookie jar do it is not a shortcut: the
 * cookie is `Secure`, a browser will send it to `127.0.0.1` over plain HTTP and
 * an HTTP client outside a browser will not, so a helper that relied on the jar
 * would answer `unknownAccess` to every press and prove nothing.
 *
 * The redirect is read rather than followed, because `stockage.wecreate.test`
 * deliberately does not resolve and what is under test is the answer rather
 * than the file.
 */
export async function pressTogether(
  request: APIRequestContext,
  input: { token: string; sku: string; times: number; origin: string },
): Promise<string[]> {
  const answers = await Promise.all(
    Array.from({ length: input.times }, () =>
      request.post("/commande/acces/telechargement", {
        form: { sku: input.sku },
        headers: {
          cookie: `${ACCESS_COOKIE}=${input.token}`,
          origin: input.origin,
        },
        maxRedirects: 0,
      }),
    ),
  );
  return answers.map((answer) => answer.headers()["location"] ?? "");
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
