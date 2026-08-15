import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AcceptedLegalRevision,
  AssuranceLevel,
  BuyerContact,
  CommerceAuditEntry,
  FulfillmentState,
  OrderAnomaly,
  OrderSnapshotLine,
  PaidDeliverableVersion,
  PaymentAttempt,
  PaymentEventEffect,
  PaymentState,
} from "../types";
import { FIXTURE_STAFF, type FixtureStaffAccount } from "./staff";

/**
 * The fixture data plane's storage: one JSON file for the records, and a
 * directory of private files beside it for the bytes.
 *
 * File-backed rather than in-memory for the reason the content fixture is: an
 * acceptance test in one process drives an application server in another, and
 * the two have to be looking at the same data. The uploaded bytes live outside
 * `public/` and no route reads them, so a Paid Deliverable is as unreachable
 * here as it is in a private bucket.
 */

export interface StoredFactor {
  id: string;
  label: string;
  secret: string;
  /** An enrolment nobody has proved yet does not raise anyone's assurance. */
  verified: boolean;
}

export interface StoredStaff {
  id: string;
  email: string;
  password: string;
  roles: string[];
  factors: StoredFactor[];
}

export interface StoredSession {
  token: string;
  staffId: string;
  assurance: AssuranceLevel;
}

/**
 * One order as this fixture keeps it: the snapshot, plus the buyer's contact
 * details, which `OrderSnapshot` deliberately does not carry.
 *
 * Postgres separates these into four tables, three of which it refuses to let
 * anything rewrite. A JSON file cannot refuse anything, so what stands in for
 * those triggers here is that nothing in this application ever writes to a
 * stored order except the two functions below that are allowed to.
 */
export interface StoredOrder {
  reference: string;
  createdAt: string;
  lines: OrderSnapshotLine[];
  totalXof: number;
  buyer: BuyerContact;
  acceptedLegal: AcceptedLegalRevision[];
  paymentState: PaymentState;
  fulfillmentState: FulfillmentState;
  /**
   * Who is delivering this order, and since when.
   *
   * A claim is held by a caller rather than by a state: a settlement names the
   * claim it settles, so a request that gave up cannot mark an order failed
   * that has since been delivered, and a claim nobody finished may be taken up
   * once it is old enough to be abandoned (ADR-0010). Postgres keeps the same
   * two columns.
   */
  fulfillmentClaimId: string | null;
  fulfillmentClaimedAt: string | null;
  attempts: StoredPaymentAttempt[];
}

/**
 * One attempt as this fixture keeps it.
 *
 * Everything `PaymentAttempt` carries except what the provider said about it:
 * that is in the events, and the boundary reads it back out of them. A copy
 * here would be a second place for it to be wrong, which is exactly what
 * `commerce.attempt_json` avoids by deriving it too.
 */
export type StoredPaymentAttempt = Omit<PaymentAttempt, "outcome">;

/**
 * One event a payment provider delivered, kept exactly as it was read.
 *
 * Append-only and never edited, which is what `commerce.payment_events` is in
 * Postgres. `effect` records what the event was allowed to do at the moment it
 * arrived, so a late or contradictory delivery leaves a trail that explains
 * itself rather than disappearing.
 */
export interface StoredPaymentEvent {
  id: string;
  orderReference: string;
  provider: PaymentAttempt["provider"];
  providerEventId: string;
  providerEventType: string;
  providerTransactionId: string;
  occurredAt: string;
  receivedAt: string;
  outcome: PaymentState;
  effect: PaymentEventEffect;
}

/**
 * One order's Order Access: the digest of the token it was emailed, and when it
 * stops working.
 *
 * The token itself is nowhere here, which is the whole point — this file is the
 * fixture's database, and a database that held the credential would be a
 * database whose leak is the credential (issue #1).
 */
export interface StoredOrderAccess {
  orderReference: string;
  /** SHA-256 of the emailed token, hexadecimal. */
  tokenDigest: string;
  issuedAt: string;
  /** Thirty days after the payment was approved, not after this was written. */
  expiresAt: string;
}

/**
 * One purchased Digital Product a buyer may still open.
 *
 * Keyed to the order and the SKU rather than to the access token, so reissuing
 * a token leaves the allowance where it was. It carries an allowance and
 * nothing else: the title, the version and the file behind it are read back
 * from the Order Snapshot line, exactly as `commerce.access_json` joins them —
 * a grant that kept its own copy could drift from the purchase it belongs to.
 *
 * `linkExpiresAt` is the address last handed over: while it is still good,
 * asking again is the same download rather than another one, which is what
 * keeps a fifteen-minute address from costing a buyer part of what they paid
 * for.
 *
 * Postgres keeps the same two counters and refuses to let the used one pass the
 * allowed one. A JSON file cannot refuse anything, so what stands in for that
 * here is that only `openDownload` ever writes them.
 */
export interface StoredGrant {
  orderReference: string;
  sku: string;
  downloadsAllowed: number;
  downloadsUsed: number;
  linkExpiresAt: string | null;
}

/**
 * One thing that happened to an order which no rule could settle.
 *
 * Kept for the Commerce Operator view issue #15 builds, and holding what
 * `commerce.order_anomalies` holds: the provider's own identifiers, which are
 * not secrets, and nothing of the buyer, no delivery body and no token.
 */
export type StoredOrderAnomaly = Omit<OrderAnomaly, "reference"> & {
  orderReference: string;
};

export interface CommerceFixtureDataset {
  staff: StoredStaff[];
  sessions: StoredSession[];
  versions: PaidDeliverableVersion[];
  /** SKU to the id of the version future purchases receive. */
  active: Record<string, string>;
  audit: CommerceAuditEntry[];
  orders: StoredOrder[];
  paymentEvents: StoredPaymentEvent[];
  access: StoredOrderAccess[];
  grants: StoredGrant[];
  anomalies: StoredOrderAnomaly[];
}

function datasetPath(): string {
  return (
    process.env.WECREATE_COMMERCE_FIXTURE_FILE ??
    path.join(process.cwd(), ".wecreate", "commerce.json")
  );
}

/** Where the bytes go. Never under `public/`, so nothing can serve them. */
function deliverablesDirectory(): string {
  return path.join(path.dirname(datasetPath()), "paid-deliverables");
}

function seedStaff(account: FixtureStaffAccount): StoredStaff {
  return {
    id: account.id,
    email: account.email,
    password: account.password,
    roles: [...account.roles],
    factors: account.factors.map((factor) => ({ ...factor, verified: true })),
  };
}

function initialDataset(): CommerceFixtureDataset {
  return {
    staff: FIXTURE_STAFF.map(seedStaff),
    sessions: [],
    versions: [],
    active: {},
    audit: [],
    orders: [],
    paymentEvents: [],
    access: [],
    grants: [],
    anomalies: [],
  };
}

/*
 * `turbopackIgnore` for the reason the content fixture uses it: the bundler
 * would otherwise resolve this dynamic path by tracing the whole project into
 * the server bundle. Nothing here is part of a production deployment.
 */

export async function readCommerceFixture(): Promise<CommerceFixtureDataset> {
  try {
    const raw = await readFile(
      /* turbopackIgnore: true */ datasetPath(),
      "utf8",
    );
    const stored = JSON.parse(raw) as Partial<CommerceFixtureDataset>;
    return {
      staff: stored.staff ?? initialDataset().staff,
      sessions: stored.sessions ?? [],
      versions: stored.versions ?? [],
      active: stored.active ?? {},
      audit: stored.audit ?? [],
      orders: stored.orders ?? [],
      paymentEvents: stored.paymentEvents ?? [],
      access: stored.access ?? [],
      grants: stored.grants ?? [],
      anomalies: stored.anomalies ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return initialDataset();
    }
    throw error;
  }
}

/**
 * The queue every change to this dataset waits in.
 *
 * Postgres does the work this stands in for with a locked row: two callers
 * reach `commerce_begin_fulfillment` for one order and the second waits, then
 * finds the claim gone. A JSON file has no such thing — read, change, write is
 * three awaits, and two requests interleaving in them is one of the two changes
 * silently lost. Which is exactly the failure issue #14 is about: two webhooks
 * arriving together would each read `not_started`, each claim, and each deliver.
 *
 * So changes are serialised here instead, and the whole read-change-write is
 * the critical section rather than the write alone. It is in-process, which is
 * all it has to be: the acceptance suite drives one server, and the only other
 * writers are its own test hooks, which run between scenarios rather than
 * during one.
 */
let changing: Promise<unknown> = Promise.resolve();

/**
 * Read the dataset, change it, and write it back, with nothing else in between.
 *
 * Every write on this provider goes through here. The change may await —
 * signing a private address, storing bytes — and holding the queue while it
 * does is deliberate: checking an allowance, producing an address and spending
 * a download is one decision, and a fixture that let another request in
 * halfway would be a fixture that could hand out two downloads for one.
 *
 * The dataset is written back only when the change returns. A change that threw
 * leaves what was stored exactly as it was, which is what a transaction rolling
 * back does.
 */
export async function changeCommerceFixture<T>(
  change: (dataset: CommerceFixtureDataset) => T | Promise<T>,
): Promise<T> {
  const queued = changing.then(async () => {
    const dataset = await readCommerceFixture();
    const answer = await change(dataset);
    await writeCommerceFixture(dataset);
    return answer;
  });

  // The queue moves on whether this change succeeded or not; the caller still
  // gets the failure.
  changing = queued.catch(() => undefined);
  return queued;
}

export async function writeCommerceFixture(
  dataset: CommerceFixtureDataset,
): Promise<void> {
  const file = datasetPath();
  await mkdir(/* turbopackIgnore: true */ path.dirname(file), {
    recursive: true,
  });

  // Written to a sibling and renamed into place, so a page reading while an
  // upload is being recorded sees one whole dataset or the other.
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(
    /* turbopackIgnore: true */ temporary,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf8",
  );
  await rename(/* turbopackIgnore: true */ temporary, file);
}

/**
 * Where this fixture pretends its private files are served from.
 *
 * Deliberately not a resolvable host, and deliberately not WeCreate's own
 * origin: what a buyer is handed has to be somewhere else, exactly as a real
 * Supabase address is, or a test could pass against an application that quietly
 * served a Paid Deliverable itself. The acceptance suite answers it in the
 * browser and checks the address without a request leaving the machine.
 */
export const PRIVATE_STORE_ORIGIN = "https://stockage.wecreate.test";

/**
 * What this fixture signs a temporary address with.
 *
 * A stand-in for the token Supabase puts on a signed URL, and it does the same
 * job: the expiry is signed along with the object, so an address cannot be
 * extended by editing it. `tests/e2e/support/order-access.ts` spells the scheme
 * out by hand rather than importing this, for the reason the payment fixture's
 * signature is spelled out there — a helper sharing this code would agree with
 * a link that never expired.
 */
const PRIVATE_STORE_SECRET = "fixture-private-storage";

/**
 * A temporary address for one stored object, or `undefined` when there is
 * nothing there.
 *
 * Answering `undefined` for a missing object is what Supabase's own signing
 * does, and it is the difference between "this buyer may not have it" and
 * "WeCreate cannot currently produce it" — the second must not spend one of
 * their downloads.
 */
export async function signPrivateAddress(
  objectPath: string,
  seconds: number,
): Promise<string | undefined> {
  const { access } = await import("node:fs/promises");
  try {
    await access(
      /* turbopackIgnore: true */ path.join(deliverablesDirectory(), objectPath),
    );
  } catch {
    return undefined;
  }

  const { createHmac } = await import("node:crypto");
  const expires = Math.floor(Date.now() / 1000) + seconds;
  const signature = createHmac("sha256", PRIVATE_STORE_SECRET)
    .update(`${objectPath}:${expires}`, "utf8")
    .digest("hex");

  return `${PRIVATE_STORE_ORIGIN}/paid-deliverables/${objectPath}?expire=${expires}&signature=${signature}`;
}

/**
 * Move every recorded moment this many seconds into the past.
 *
 * The acceptance suite's only clock, and it exists because three of the rules
 * issue #1 asks for are measured in time nobody can wait out: a twenty-four
 * hour Order Snapshot window, thirty days of Order Access, and a
 * fifteen-minute file address. Ageing what is stored rather than the server's
 * clock keeps every assertion about what the *application* concludes from a
 * moment, which is the thing under test.
 *
 * Only the fixture has it. Nothing in `src/` outside this file calls it, and
 * the hook that does is inert unless the data plane is this one.
 */
export async function ageCommerceFixture(seconds: number): Promise<void> {
  const shift = (moment: string): string =>
    new Date(Date.parse(moment) - seconds * 1000).toISOString();

  await changeCommerceFixture((dataset) => {
    dataset.orders = dataset.orders.map((order) => ({
      ...order,
      createdAt: shift(order.createdAt),
      // Ageing this is what lets a scenario reach the moment a claim nobody
      // finished may be taken up, which is otherwise a quarter of an hour away.
      fulfillmentClaimedAt: order.fulfillmentClaimedAt
        ? shift(order.fulfillmentClaimedAt)
        : null,
      attempts: order.attempts.map((attempt) => ({
        ...attempt,
        createdAt: shift(attempt.createdAt),
      })),
    }));
    dataset.access = dataset.access.map((one) => ({
      ...one,
      issuedAt: shift(one.issuedAt),
      expiresAt: shift(one.expiresAt),
    }));
    dataset.grants = dataset.grants.map((grant) => ({
      ...grant,
      linkExpiresAt: grant.linkExpiresAt ? shift(grant.linkExpiresAt) : null,
    }));
  });
}

/**
 * Take away the bytes behind every stored version, and leave the records.
 *
 * A private store that cannot answer for an object it should have. Nothing an
 * operator can do — deleting a version is a thing the data plane refuses — and
 * the only way to show that a store which did not answer costs a buyer no part
 * of their allowance (issue #14).
 *
 * Only the fixture has it, and the hook that reaches it is inert unless the
 * data plane is this one.
 */
export async function emptyPrivateStore(): Promise<void> {
  const { rm } = await import("node:fs/promises");
  await rm(/* turbopackIgnore: true */ deliverablesDirectory(), {
    recursive: true,
    force: true,
  });
}

/**
 * Return the data plane to its seeded state. Sessions and files both go.
 *
 * Queued like every other change rather than written straight over: a scenario
 * that left a request in flight — one holding a claim while a mail provider
 * refuses to answer — would otherwise have its reset undone by that request
 * finishing afterwards.
 */
export async function resetCommerceFixture(): Promise<CommerceFixtureDataset> {
  const dataset = await changeCommerceFixture((current) =>
    Object.assign(current, initialDataset()),
  );
  await emptyPrivateStore();
  return dataset;
}

/**
 * Write the bytes of a Paid Deliverable Version, refusing to write over any
 * that are already there.
 *
 * `wx` is the whole point: the object's address is derived from its own
 * checksum, so a file that already exists at it is the same file, and the
 * filesystem refuses rather than this code remembering to check. It is what
 * `upsert: false` gives us against a real private bucket.
 *
 * Whether the bytes were new is not reported, because nothing may act on it:
 * that a version already exists is decided by the record, not by the store.
 */
export async function storeDeliverableBytes(
  objectPath: string,
  bytes: Uint8Array,
): Promise<void> {
  const file = path.join(deliverablesDirectory(), objectPath);
  await mkdir(/* turbopackIgnore: true */ path.dirname(file), {
    recursive: true,
  });

  try {
    await writeFile(/* turbopackIgnore: true */ file, bytes, { flag: "wx" });
  } catch (error) {
    // Already there means these exact bytes are already there — the address is
    // their checksum — so the write being refused is the correct outcome and
    // not a failure. Anything else is.
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}
