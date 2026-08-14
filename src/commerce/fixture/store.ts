import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AcceptedLegalRevision,
  AssuranceLevel,
  BuyerContact,
  CommerceAuditEntry,
  FulfillmentState,
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
  attempts: PaymentAttempt[];
}

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

export interface CommerceFixtureDataset {
  staff: StoredStaff[];
  sessions: StoredSession[];
  versions: PaidDeliverableVersion[];
  /** SKU to the id of the version future purchases receive. */
  active: Record<string, string>;
  audit: CommerceAuditEntry[];
  orders: StoredOrder[];
  paymentEvents: StoredPaymentEvent[];
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
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return initialDataset();
    }
    throw error;
  }
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

/** Return the data plane to its seeded state. Sessions and files both go. */
export async function resetCommerceFixture(): Promise<CommerceFixtureDataset> {
  const dataset = initialDataset();
  await writeCommerceFixture(dataset);
  const { rm } = await import("node:fs/promises");
  await rm(/* turbopackIgnore: true */ deliverablesDirectory(), {
    recursive: true,
    force: true,
  });
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
