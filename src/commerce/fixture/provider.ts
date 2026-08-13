import { randomBytes, randomUUID } from "node:crypto";

import {
  COMMERCE_OPERATOR_ROLE,
  administersCommerce,
  mayEnrolSecondFactor,
} from "../operators";
import {
  auditMetadata,
  deliverableObjectPath,
  nextVersionNumber,
} from "../paid-deliverables";
import type {
  ActivationOutcome,
  CommerceProvider,
  CreateVersionOutcome,
  DeliverableUploadRequest,
  EnrolmentTicket,
  SignInOutcome,
  VerificationOutcome,
} from "../provider";
import type {
  CommerceAuditEntry,
  CommerceOperator,
  OperatorCredentials,
  PaidDeliverable,
  PaidDeliverableVersion,
} from "../types";
import {
  readCommerceFixture,
  storeDeliverableBytes,
  writeCommerceFixture,
  type CommerceFixtureDataset,
  type StoredSession,
  type StoredStaff,
} from "./store";
import { isValidTotpCode, totpUri } from "./totp";

/**
 * A deterministic commerce data plane, backed by a JSON file and a directory of
 * private files.
 *
 * This is the provider fake the acceptance suite runs the real application
 * against: the same pages, the same actions and the same rules, with Supabase
 * replaced at the boundary rather than anything inside the application mocked.
 *
 * It enforces the authorisation rules itself instead of trusting the pages that
 * call it, because the real thing does — a Postgres policy refuses a request
 * that never rendered a page, and a fixture that answered anyway would let a
 * missing check pass the suite.
 */

class CommerceRefused extends Error {
  constructor() {
    super("commerce: assurance level 2 and the commerce operator role are required");
    this.name = "CommerceRefused";
  }
}

function sessionFor(
  dataset: CommerceFixtureDataset,
  credentials: OperatorCredentials,
): { session: StoredSession; staff: StoredStaff } | undefined {
  const session = dataset.sessions.find(
    (candidate) => candidate.token === credentials.accessToken,
  );
  if (!session) return undefined;

  const staff = dataset.staff.find((one) => one.id === session.staffId);
  return staff ? { session, staff } : undefined;
}

function toOperator(staff: StoredStaff, session: StoredSession): CommerceOperator {
  return {
    id: staff.id,
    email: staff.email,
    assurance: session.assurance,
    factors: staff.factors
      .filter((factor) => factor.verified)
      .map(({ id, label }) => ({ id, label })),
    administersCommerce: staff.roles.includes(COMMERCE_OPERATOR_ROLE),
  };
}

/** The fixture's half of what a Postgres policy does before any row is read. */
function requireOperator(
  dataset: CommerceFixtureDataset,
  credentials: OperatorCredentials,
): StoredStaff {
  const found = sessionFor(dataset, credentials);
  if (!found || !administersCommerce(toOperator(found.staff, found.session))) {
    throw new CommerceRefused();
  }
  return found.staff;
}

/** Replace a session's token when its assurance changes, as a new JWT would. */
function reissue(
  dataset: CommerceFixtureDataset,
  session: StoredSession,
): OperatorCredentials {
  const token = randomUUID();
  dataset.sessions = [
    ...dataset.sessions.filter((one) => one.token !== session.token),
    { ...session, token, assurance: "aal2" },
  ];
  return { accessToken: token, refreshToken: token };
}

function record(
  dataset: CommerceFixtureDataset,
  entry: Omit<CommerceAuditEntry, "id" | "occurredAt">,
): void {
  dataset.audit = [
    ...dataset.audit,
    { ...entry, id: randomUUID(), occurredAt: new Date().toISOString() },
  ];
}

/** A base32 secret, the shape an authenticator app is handed. */
function newSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  // 32 evenly divides 256, so taking each byte modulo the alphabet's length
  // leaves every character equally likely.
  return Array.from(randomBytes(16), (byte) => alphabet[byte % 32]).join("");
}

export const fixtureCommerceProvider: CommerceProvider = {
  id: "fixture",

  async signIn(email, password): Promise<SignInOutcome> {
    const dataset = await readCommerceFixture();
    const staff = dataset.staff.find(
      (one) => one.email === email.trim().toLowerCase() && one.password === password,
    );
    if (!staff) {
      return { status: "refused" };
    }

    // A password alone never reaches assurance level 2, whether or not this
    // staff member has enrolled a factor yet.
    const token = randomUUID();
    dataset.sessions = [
      ...dataset.sessions,
      { token, staffId: staff.id, assurance: "aal1" },
    ];
    await writeCommerceFixture(dataset);

    return { status: "signed-in", credentials: { accessToken: token, refreshToken: token } };
  },

  async readOperator(credentials): Promise<CommerceOperator | undefined> {
    const found = sessionFor(await readCommerceFixture(), credentials);
    return found ? toOperator(found.staff, found.session) : undefined;
  },

  async verifySecondFactor(credentials, { factorId, code }): Promise<VerificationOutcome> {
    const dataset = await readCommerceFixture();
    const found = sessionFor(dataset, credentials);
    if (!found) return { status: "refused" };

    const factor = found.staff.factors.find(
      (one) => one.id === factorId && one.verified,
    );
    if (!factor || !isValidTotpCode(factor.secret, code)) {
      return { status: "refused" };
    }

    const reissued = reissue(dataset, found.session);
    await writeCommerceFixture(dataset);
    return { status: "verified", credentials: reissued };
  },

  async enrolSecondFactor(credentials, { label }): Promise<EnrolmentTicket> {
    const dataset = await readCommerceFixture();
    const found = sessionFor(dataset, credentials);
    // Refused here as well as in the action, because Supabase refuses it too: a
    // staff member who already has a factor proves it before adding another, or
    // a stolen password would be enough to enrol a "backup" nobody asked for.
    if (!found || !mayEnrolSecondFactor(toOperator(found.staff, found.session))) {
      throw new CommerceRefused();
    }

    const factor = {
      id: randomUUID(),
      label: label.trim() || "Facteur de secours",
      secret: newSecret(),
      verified: false,
    };
    found.staff.factors = [...found.staff.factors, factor];
    await writeCommerceFixture(dataset);

    return {
      factorId: factor.id,
      secret: factor.secret,
      uri: totpUri(found.staff.email, factor.secret, factor.label),
    };
  },

  async confirmSecondFactor(credentials, { factorId, code }): Promise<VerificationOutcome> {
    const dataset = await readCommerceFixture();
    const found = sessionFor(dataset, credentials);
    if (!found) return { status: "refused" };

    const factor = found.staff.factors.find((one) => one.id === factorId);
    if (!factor || !isValidTotpCode(factor.secret, code)) {
      return { status: "refused" };
    }

    factor.verified = true;
    const reissued = reissue(dataset, found.session);
    await writeCommerceFixture(dataset);
    return { status: "verified", credentials: reissued };
  },

  async signOut(credentials): Promise<void> {
    const dataset = await readCommerceFixture();
    dataset.sessions = dataset.sessions.filter(
      (one) => one.token !== credentials.accessToken,
    );
    await writeCommerceFixture(dataset);
  },

  async readPaidDeliverables(credentials): Promise<PaidDeliverable[]> {
    const dataset = await readCommerceFixture();
    requireOperator(dataset, credentials);

    const skus = [...new Set(dataset.versions.map((version) => version.sku))];
    return skus.map((sku) => ({
      sku,
      versions: dataset.versions
        .filter((version) => version.sku === sku)
        .sort((a, b) => b.version - a.version),
      activeVersionId: dataset.active[sku] ?? null,
    }));
  },

  async createPaidDeliverableVersion(
    credentials,
    upload: DeliverableUploadRequest,
  ): Promise<CreateVersionOutcome> {
    const dataset = await readCommerceFixture();
    const staff = requireOperator(dataset, credentials);

    // Already a version of this product: a replacement has to be a different
    // file, and this one is not going to be written over.
    const stored = dataset.versions.find(
      (version) =>
        version.sku === upload.sku && version.checksum === upload.checksum,
    );
    if (stored) {
      return { status: "alreadyStored", version: stored };
    }

    // The bytes may already be there without a record, if an earlier attempt
    // stored them and then failed. Writing is still refused — the address is
    // the checksum, so what is there is this same file — and recording the
    // version it should have become is what finishes the job.
    await storeDeliverableBytes(
      deliverableObjectPath(upload.sku, upload.checksum, upload.fileName),
      upload.bytes,
    );

    const version: PaidDeliverableVersion = {
      id: randomUUID(),
      sku: upload.sku,
      version: nextVersionNumber(
        dataset.versions.filter((one) => one.sku === upload.sku),
      ),
      fileName: upload.fileName,
      contentType: upload.contentType,
      byteSize: upload.bytes.byteLength,
      checksum: upload.checksum,
      createdAt: new Date().toISOString(),
      createdByEmail: staff.email,
    };

    dataset.versions = [...dataset.versions, version];
    record(dataset, {
      actorEmail: staff.email,
      action: "paid-deliverable-version.created",
      sku: version.sku,
      before: null,
      after: auditMetadata(version),
    });
    await writeCommerceFixture(dataset);

    return { status: "created", version };
  },

  async activatePaidDeliverableVersion(
    credentials,
    { sku, versionId },
  ): Promise<ActivationOutcome> {
    const dataset = await readCommerceFixture();
    const staff = requireOperator(dataset, credentials);

    const version = dataset.versions.find(
      (one) => one.id === versionId && one.sku === sku,
    );
    if (!version) {
      return { status: "refused" };
    }

    const previous = dataset.versions.find((one) => one.id === dataset.active[sku]);
    // The previous version is left exactly as it was: what changes is which one
    // future purchases receive, never what any of them are.
    dataset.active = { ...dataset.active, [sku]: version.id };
    record(dataset, {
      actorEmail: staff.email,
      action: "paid-deliverable-version.activated",
      sku,
      before: auditMetadata(previous),
      after: auditMetadata(version),
    });
    await writeCommerceFixture(dataset);

    return { status: "activated", version };
  },

  async readAuditTrail(credentials, limit): Promise<CommerceAuditEntry[]> {
    const dataset = await readCommerceFixture();
    requireOperator(dataset, credentials);

    // Reversed rather than sorted by time: the trail is append-only, so the
    // order it was written in *is* the order things happened, including for two
    // entries that share a millisecond.
    return [...dataset.audit].reverse().slice(0, limit);
  },

  async readActiveSkus(): Promise<string[]> {
    const dataset = await readCommerceFixture();
    return Object.entries(dataset.active)
      .filter(([, versionId]) =>
        dataset.versions.some((version) => version.id === versionId),
      )
      .map(([sku]) => sku);
  },
};
