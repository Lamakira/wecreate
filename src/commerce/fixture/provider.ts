import { randomBytes, randomUUID } from "node:crypto";

import type { PaymentEvent } from "@/payments/types";

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
import {
  accessExpiryFrom,
  isAccessLive,
  liveLinkSeconds,
} from "../order-access";
import {
  isPayable,
  maskEmail,
  paymentEventAnomaly,
  paymentEventEffect,
  paymentProspect,
} from "../orders";
import type {
  ActivationOutcome,
  BeginFulfillmentOutcome,
  CommerceProvider,
  CreateOrderOutcome,
  CreateOrderRequest,
  CreateVersionOutcome,
  DeliverableUploadRequest,
  EnrolmentTicket,
  OpenAttemptOutcome,
  OpenDownloadOutcome,
  PaymentAttemptOutcome,
  SignInOutcome,
  VerificationOutcome,
} from "../provider";
import type {
  CommerceAuditEntry,
  CommerceOperator,
  OperatorCredentials,
  OrderAccess,
  OrderSnapshot,
  OrderState,
  PaidDeliverable,
  PaidDeliverableVersion,
  PaymentAttempt,
  PaymentEventRecord,
} from "../types";
import {
  changeCommerceFixture,
  readCommerceFixture,
  signPrivateAddress,
  storeDeliverableBytes,
  type CommerceFixtureDataset,
  type StoredOrder,
  type StoredOrderAccess,
  type StoredOrderAnomaly,
  type StoredPaymentAttempt,
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

/**
 * Write down one thing a person has to settle, and say nothing if it is already
 * written down.
 *
 * The repeat is the ordinary case rather than the exception, and it arrives two
 * ways. A provider redelivering an approval it was already acknowledged for
 * comes back with the same event identity. A delivery failing again while
 * nobody has dealt with the last failure carries no identity at all — and is
 * still that same one buyer who has not been written to, so what bounds it is
 * that only one may be outstanding for an order at a time.
 *
 * `commerce.note_anomaly` does both with two unique constraints; change one and
 * change the other.
 */
function noteAnomaly(
  dataset: CommerceFixtureDataset,
  anomaly: Omit<
    StoredOrderAnomaly,
    "detectedAt" | "resolvedAt" | "provider" | "providerTransactionId" | "providerEventId"
  > &
    Partial<
      Pick<
        StoredOrderAnomaly,
        "provider" | "providerTransactionId" | "providerEventId"
      >
    >,
): void {
  const {
    provider = null,
    providerTransactionId = null,
    providerEventId = null,
  } = anomaly;

  const seen = dataset.anomalies.some((one) => {
    if (one.kind !== anomaly.kind) return false;
    if (providerEventId !== null) {
      return one.provider === provider && one.providerEventId === providerEventId;
    }
    return one.orderReference === anomaly.orderReference && one.resolvedAt === null;
  });
  if (seen) return;

  dataset.anomalies = [
    ...dataset.anomalies,
    {
      ...anomaly,
      provider,
      providerTransactionId,
      providerEventId,
      detail: anomaly.detail?.slice(0, 200) ?? null,
      detectedAt: new Date().toISOString(),
      // Issue #15 is what closes one. Nothing here ever does.
      resolvedAt: null,
    },
  ];
}

/**
 * Which transaction's verdict is the one currently standing for this order.
 *
 * `null` while nothing has decided anything, which is when neither anomaly is
 * possible. The Postgres function reads the same row back the same way.
 */
function decidingTransaction(
  dataset: CommerceFixtureDataset,
  reference: string,
): string | null {
  return (
    dataset.paymentEvents.findLast(
      (event) => event.orderReference === reference && event.effect === "applied",
    )?.providerTransactionId ?? null
  );
}

/**
 * A stored order as the boundary reports it: the buyer's contact details are
 * dropped and replaced by the masked hint, exactly as the Postgres function
 * does.
 *
 * Each attempt's outcome is read out of the events rather than kept beside
 * them, which is what `commerce.attempt_json` does with the same two tables:
 * what the provider said about a transaction is recorded once, in the trail,
 * and a copy on the attempt could only ever disagree with it.
 */
function toOrderSnapshot(
  dataset: CommerceFixtureDataset,
  order: StoredOrder,
): OrderSnapshot {
  return {
    reference: order.reference,
    createdAt: order.createdAt,
    lines: order.lines,
    totalXof: order.totalXof,
    buyerEmailHint: maskEmail(order.buyer.email),
    acceptedLegal: order.acceptedLegal,
    paymentState: order.paymentState,
    fulfillmentState: order.fulfillmentState,
    attempts: order.attempts.map((attempt) => ({
      ...attempt,
      outcome: attemptOutcome(dataset, attempt),
    })),
  };
}

/**
 * The verdict most recently recorded for one attempt's transaction, or nothing
 * yet.
 *
 * The last event about it that said anything at all: a `transaction.created`
 * announces a transaction and answers nothing, so it is passed over the way
 * `paymentEventEffect()` passes over it. `commerce.attempt_json` reads the same
 * way — change one and change the other.
 */
function attemptOutcome(
  dataset: CommerceFixtureDataset,
  attempt: StoredPaymentAttempt,
): PaymentAttempt["outcome"] {
  if (!attempt.providerTransactionId) return null;
  return (
    dataset.paymentEvents.findLast(
      (event) =>
        event.providerTransactionId === attempt.providerTransactionId &&
        event.outcome !== "pending",
    )?.outcome ?? null
  );
}

/** What one order's buyer may still open, assembled from its stored grants. */
function toOrderAccess(
  dataset: CommerceFixtureDataset,
  held: StoredOrderAccess,
): OrderAccess {
  const order = dataset.orders.find(
    (one) => one.reference === held.orderReference,
  );
  const grants = dataset.grants.filter(
    (grant) => grant.orderReference === held.orderReference,
  );

  return {
    reference: held.orderReference,
    issuedAt: held.issuedAt,
    expiresAt: held.expiresAt,
    // Walked from the Order Snapshot's own lines, which gives two things at
    // once: the title and the version come from the purchase rather than from a
    // copy that could drift, and the rows read in the order the ticket beside
    // them does. `commerce.access_json` joins the same way.
    grants: (order?.lines ?? []).flatMap((line) => {
      const grant = grants.find((one) => one.sku === line.sku);
      return grant
        ? [
            {
              sku: line.sku,
              title: line.title,
              paidDeliverableVersion: line.paidDeliverableVersion,
              downloadsAllowed: grant.downloadsAllowed,
              downloadsRemaining: grant.downloadsAllowed - grant.downloadsUsed,
            },
          ]
        : [];
    }),
  };
}

/**
 * The same, found by the order it belongs to.
 *
 * `undefined` when nothing has been granted — a payment that was never approved
 * and one whose delivery has not been claimed yet both look like this, and the
 * pages treat them the same way: there is nothing to show.
 */
function findOrderAccess(
  dataset: CommerceFixtureDataset,
  reference: string,
): OrderAccess | undefined {
  const held = dataset.access.find((one) => one.orderReference === reference);
  return held ? toOrderAccess(dataset, held) : undefined;
}

function newAttempt(
  provider: PaymentAttempt["provider"],
): StoredPaymentAttempt {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    state: "pending",
    provider,
    providerTransactionId: null,
    failureReason: null,
  };
}

/**
 * Whether this order's delivery is one this caller may claim.
 *
 * Three are, and no others: one nobody has delivered, one whose delivery
 * failed, and one claimed longer ago than `stalledSeconds` and never settled —
 * the application that stopped between claiming and finishing (ADR-0010). A
 * delivered order is terminal, and a claim somebody is still holding is theirs.
 * `commerce_begin_fulfillment` asks the same three questions in its `where`.
 */
function claimable(
  order: StoredOrder,
  request: { stalledSeconds: number },
): boolean {
  if (order.fulfillmentState === "not_started") return true;
  if (order.fulfillmentState === "failed") return true;
  if (order.fulfillmentState !== "processing") return false;

  const claimed = Date.parse(order.fulfillmentClaimedAt ?? "");
  // A claim with no moment on it is one from before there were any, and there
  // is nothing to wait out.
  if (!Number.isFinite(claimed)) return true;
  return Date.now() - claimed >= request.stalledSeconds * 1000;
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
    return changeCommerceFixture((dataset) => {
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

      return {
        status: "signed-in",
        credentials: { accessToken: token, refreshToken: token },
      };
    });
  },

  async readOperator(credentials): Promise<CommerceOperator | undefined> {
    const found = sessionFor(await readCommerceFixture(), credentials);
    return found ? toOperator(found.staff, found.session) : undefined;
  },

  async verifySecondFactor(credentials, { factorId, code }): Promise<VerificationOutcome> {
    return changeCommerceFixture((dataset) => {
      const found = sessionFor(dataset, credentials);
      if (!found) return { status: "refused" };

      const factor = found.staff.factors.find(
        (one) => one.id === factorId && one.verified,
      );
      if (!factor || !isValidTotpCode(factor.secret, code)) {
        return { status: "refused" };
      }

      return { status: "verified", credentials: reissue(dataset, found.session) };
    });
  },

  async enrolSecondFactor(credentials, { label }): Promise<EnrolmentTicket> {
    return changeCommerceFixture((dataset) => {
      const found = sessionFor(dataset, credentials);
      // Refused here as well as in the action, because Supabase refuses it too:
      // a staff member who already has a factor proves it before adding
      // another, or a stolen password would be enough to enrol a "backup"
      // nobody asked for.
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

      return {
        factorId: factor.id,
        secret: factor.secret,
        uri: totpUri(found.staff.email, factor.secret, factor.label),
      };
    });
  },

  async confirmSecondFactor(credentials, { factorId, code }): Promise<VerificationOutcome> {
    return changeCommerceFixture((dataset) => {
      const found = sessionFor(dataset, credentials);
      if (!found) return { status: "refused" };

      const factor = found.staff.factors.find((one) => one.id === factorId);
      if (!factor || !isValidTotpCode(factor.secret, code)) {
        return { status: "refused" };
      }

      factor.verified = true;
      return { status: "verified", credentials: reissue(dataset, found.session) };
    });
  },

  async signOut(credentials): Promise<void> {
    await changeCommerceFixture((dataset) => {
      dataset.sessions = dataset.sessions.filter(
        (one) => one.token !== credentials.accessToken,
      );
    });
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
    return changeCommerceFixture(async (dataset) => {
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

      return { status: "created", version };
    });
  },

  async activatePaidDeliverableVersion(
    credentials,
    { sku, versionId },
  ): Promise<ActivationOutcome> {
    return changeCommerceFixture((dataset) => {
      const staff = requireOperator(dataset, credentials);

      const version = dataset.versions.find(
        (one) => one.id === versionId && one.sku === sku,
      );
      if (!version) {
        return { status: "refused" };
      }

      const previous = dataset.versions.find(
        (one) => one.id === dataset.active[sku],
      );
      // The previous version is left exactly as it was: what changes is which
      // one future purchases receive, never what any of them are.
      dataset.active = { ...dataset.active, [sku]: version.id };
      record(dataset, {
        actorEmail: staff.email,
        action: "paid-deliverable-version.activated",
        sku,
        before: auditMetadata(previous),
        after: auditMetadata(version),
      });

      return { status: "activated", version };
    });
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

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderOutcome> {
    return changeCommerceFixture((dataset) => {
      // The version each line receives is read here rather than taken from the
      // caller, so an Order Snapshot records what was actually activated at the
      // moment it was written.
      const resolved = request.lines.map((line) => ({
        line,
        version: dataset.versions.find(
          (candidate) => candidate.id === dataset.active[line.sku],
        ),
      }));
      const withoutDeliverable = resolved
        .filter((one) => !one.version)
        .map((one) => one.line.sku);
      if (withoutDeliverable.length > 0) {
        return { status: "refused", skusWithoutDeliverable: withoutDeliverable };
      }

      const attempt = newAttempt(request.provider);
      const order: StoredOrder = {
        reference: request.reference,
        createdAt: new Date().toISOString(),
        lines: resolved.map(({ line, version }) => ({
          productId: line.productId,
          sku: line.sku,
          title: line.title,
          unitPriceXof: line.unitPriceXof,
          paidDeliverableVersionId: version!.id,
          paidDeliverableVersion: version!.version,
        })),
        // Summed here rather than accepted from the caller: an order's total is
        // the sum of what it stored, and nothing else may decide it.
        totalXof: request.lines.reduce(
          (total, line) => total + line.unitPriceXof,
          0,
        ),
        buyer: request.buyer,
        acceptedLegal: request.acceptedLegal,
        paymentState: "pending",
        fulfillmentState: "not_started",
        fulfillmentClaimId: null,
        fulfillmentClaimedAt: null,
        attempts: [attempt],
      };

      dataset.orders = [...dataset.orders, order];

      // Nothing has been said about an attempt that has only just been opened.
      return {
        status: "created",
        order: toOrderSnapshot(dataset, order),
        attempt: { ...attempt, outcome: null },
      };
    });
  },

  async openPaymentAttempt(reference: string): Promise<OpenAttemptOutcome> {
    return changeCommerceFixture((dataset) => {
      const order = dataset.orders.find((one) => one.reference === reference);
      if (!order || !isPayable(toOrderSnapshot(dataset, order))) {
        return { status: "refused" };
      }

      const attempt = newAttempt(order.attempts.at(-1)?.provider ?? "none");
      order.attempts = [...order.attempts, attempt];

      return {
        status: "opened",
        order: toOrderSnapshot(dataset, order),
        attempt: { ...attempt, outcome: null },
      };
    });
  },

  async settlePaymentAttempt(
    attemptId: string,
    outcome: PaymentAttemptOutcome,
  ): Promise<void> {
    await changeCommerceFixture((dataset) => {
      const order = dataset.orders.find((one) =>
        one.attempts.some((attempt) => attempt.id === attemptId),
      );
      const attempt = order?.attempts.find((one) => one.id === attemptId);
      // An attempt is settled once. A second answer for the same one is refused
      // here as the trigger refuses it in Postgres, so a retried request cannot
      // rewrite what a provider already said.
      if (!attempt || attempt.state !== "pending") {
        return;
      }

      attempt.state = outcome.status === "redirected" ? "redirected" : "failed";
      attempt.providerTransactionId =
        outcome.status === "redirected" ? outcome.providerTransactionId : null;
      attempt.failureReason = outcome.status === "failed" ? outcome.reason : null;
    });
  },

  async recordPaymentEvent(event: PaymentEvent): Promise<PaymentEventRecord> {
    return changeCommerceFixture((dataset) => {
      // Which order was paid through that transaction. The provider's identity
      // was recorded on the attempt when the payment page was opened, and it is
      // the only thing tying a delivery to an order — a reference never travels
      // to the provider, so nothing a webhook carries could name one.
      const order = dataset.orders.find((one) =>
        one.attempts.some(
          (attempt) =>
            attempt.providerTransactionId === event.providerTransactionId,
        ),
      );
      if (!order) {
        return {
          disposition: "unmatched",
          paymentState: null,
          orderReference: null,
        };
      }

      // Already recorded. Acknowledged, and nothing happens a second time —
      // which is the whole of what makes a provider's retries safe.
      const seen = dataset.paymentEvents.some(
        (one) =>
          one.provider === event.provider &&
          one.providerEventId === event.providerEventId,
      );
      if (seen) {
        return {
          disposition: "duplicate",
          paymentState: order.paymentState,
          orderReference: order.reference,
        };
      }

      const effect = paymentEventEffect(order.paymentState, event.outcome);
      // Read before the event is appended, so "the verdict currently standing"
      // is the one this event arrived after rather than this event itself.
      const deciding = decidingTransaction(dataset, order.reference);

      dataset.paymentEvents = [
        ...dataset.paymentEvents,
        {
          id: randomUUID(),
          orderReference: order.reference,
          provider: event.provider,
          providerEventId: event.providerEventId,
          providerEventType: event.providerEventType,
          providerTransactionId: event.providerTransactionId,
          occurredAt: event.occurredAt,
          receivedAt: new Date().toISOString(),
          outcome: event.outcome,
          effect,
        },
      ];

      const anomaly = paymentEventAnomaly({
        current: order.paymentState,
        outcome: event.outcome,
        effect,
        decidedByThisTransaction: deciding === event.providerTransactionId,
      });
      if (anomaly) {
        noteAnomaly(dataset, {
          kind: anomaly,
          orderReference: order.reference,
          provider: event.provider,
          providerTransactionId: event.providerTransactionId,
          providerEventId: event.providerEventId,
          detail: null,
        });
      }

      if (effect === "applied") {
        order.paymentState = event.outcome;
      }

      return {
        disposition: effect,
        paymentState: order.paymentState,
        orderReference: order.reference,
      };
    });
  },

  async readOrder(reference: string): Promise<OrderSnapshot | undefined> {
    const dataset = await readCommerceFixture();
    const order = dataset.orders.find((one) => one.reference === reference);
    return order ? toOrderSnapshot(dataset, order) : undefined;
  },

  async readOrderState(reference: string): Promise<OrderState | undefined> {
    const dataset = await readCommerceFixture();
    const order = dataset.orders.find((one) => one.reference === reference);
    if (!order) return undefined;

    // Three answers and no fourth: two states, and whether anything is still
    // coming. Nothing of the order itself is projected into it, which is the
    // rule rather than the count. Postgres answers the same way, in
    // `commerce_order_state`.
    return {
      payment: order.paymentState,
      fulfillment: order.fulfillmentState,
      awaiting: paymentProspect(toOrderSnapshot(dataset, order)) === "awaiting",
    };
  },

  async beginFulfillment(request): Promise<BeginFulfillmentOutcome> {
    return changeCommerceFixture((dataset) => {
      const order = dataset.orders.find(
        (one) => one.reference === request.reference,
      );
      // The claim, and everything it refuses: an order nobody paid for, one
      // already delivered, and one another caller is delivering right now.
      // Postgres refuses the same, in a transaction with the row locked, which
      // is what makes the second caller lose.
      if (
        !order ||
        order.paymentState !== "approved" ||
        !claimable(order, request)
      ) {
        return { status: "refused" };
      }

      const claimId = randomUUID();
      order.fulfillmentState = "processing";
      order.fulfillmentClaimId = claimId;
      order.fulfillmentClaimedAt = new Date().toISOString();

      // One per line, and never a second time: a grant belongs to an order line
      // and the allowance on it is the buyer's rather than this delivery's, so
      // a delivery taken up again finds it exactly as they left it.
      dataset.grants = [
        ...dataset.grants,
        ...order.lines
          .filter(
            (line) =>
              !dataset.grants.some(
                (grant) =>
                  grant.orderReference === order.reference &&
                  grant.sku === line.sku,
              ),
          )
          .map((line) => ({
            orderReference: order.reference,
            sku: line.sku,
            downloadsAllowed: request.downloadsAllowed,
            downloadsUsed: 0,
            linkExpiresAt: null,
          })),
      ];

      // Measured from the approval rather than from now: however long this
      // delivery took to start, a buyer's thirty days are thirty days from the
      // moment their money arrived (issue #1). The first event that decided the
      // Payment State is where that moment is recorded.
      const approved = dataset.paymentEvents.find(
        (event) =>
          event.orderReference === order.reference &&
          event.effect === "applied" &&
          event.outcome === "approved",
      );
      const existing = dataset.access.find(
        (one) => one.orderReference === order.reference,
      );
      const held: StoredOrderAccess = {
        orderReference: order.reference,
        tokenDigest: request.tokenDigest,
        issuedAt: new Date().toISOString(),
        // Reissued rather than added to: one order has one live token, and the
        // deadline stays where it was, because it belongs to the approval and
        // not to the delivery that finally carried it.
        expiresAt:
          existing?.expiresAt ??
          accessExpiryFrom(
            new Date(approved?.receivedAt ?? Date.now()),
            request.accessDays,
          ),
      };
      dataset.access = [
        ...dataset.access.filter(
          (one) => one.orderReference !== order.reference,
        ),
        held,
      ];

      return {
        status: "claimed",
        order: toOrderSnapshot(dataset, order),
        access: toOrderAccess(dataset, held),
        claimId,
        deliverTo: order.buyer.email,
      };
    });
  },

  async settleFulfillment(reference, state, claimId): Promise<boolean> {
    return changeCommerceFixture((dataset) => {
      const order = dataset.orders.find((one) => one.reference === reference);
      // Only what *this caller* claimed. A settlement for a delivery somebody
      // else is running, one already settled, and one this caller was relieved
      // of while it was away are all somebody else's to write.
      if (
        !order ||
        order.fulfillmentState !== "processing" ||
        order.fulfillmentClaimId !== claimId
      ) {
        return false;
      }

      order.fulfillmentState = state;
      if (state === "failed") {
        // A buyer who paid and did not receive their receipt is a person
        // WeCreate has to write to, and this is where they become visible as
        // one — once, however many times the provider redelivers into the same
        // outage.
        noteAnomaly(dataset, {
          kind: "fulfillment_failed",
          orderReference: order.reference,
          detail: "a delivery could not be finished",
        });
      }
      return true;
    });
  },

  async readOrderAccessByToken(tokenDigest): Promise<OrderAccess | undefined> {
    const dataset = await readCommerceFixture();
    const held = dataset.access.find((one) => one.tokenDigest === tokenDigest);
    if (!held) return undefined;

    const access = toOrderAccess(dataset, held);
    // Expired reads as unknown, exactly as a token nobody was ever given does.
    return isAccessLive(access) ? access : undefined;
  },

  async readOrderAccess(reference): Promise<OrderAccess | undefined> {
    const access = findOrderAccess(await readCommerceFixture(), reference);
    // The same rule the token read applies, so a page cannot offer rows for
    // something the download boundary would refuse.
    return access && isAccessLive(access) ? access : undefined;
  },

  async openDownload({ tokenDigest, sku, linkSeconds }): Promise<OpenDownloadOutcome> {
    // Checking the allowance, producing an address and spending a download are
    // one decision, so they are one change: two presses arriving together are
    // answered one after the other rather than both finding a download left.
    // Postgres holds the grant row for update across the same three steps.
    return changeCommerceFixture(async (dataset) => {
      const held = dataset.access.find((one) => one.tokenDigest === tokenDigest);
      if (!held || !isAccessLive(toOrderAccess(dataset, held))) {
        return { status: "refused", reason: "unknownAccess" };
      }

      const grant = dataset.grants.find(
        (one) => one.orderReference === held.orderReference && one.sku === sku,
      );
      // Which version this order bought, which is what its own line records —
      // never the one activated today, which may be a file nobody here paid for.
      const line = dataset.orders
        .find((one) => one.reference === held.orderReference)
        ?.lines.find((one) => one.sku === sku);
      if (!grant || !line) {
        return { status: "refused", reason: "unknownProduct" };
      }

      const liveSeconds = liveLinkSeconds(grant.linkExpiresAt);
      const reusing = liveSeconds > 0;
      if (!reusing && grant.downloadsUsed >= grant.downloadsAllowed) {
        return { status: "refused", reason: "exhausted" };
      }

      const version = dataset.versions.find(
        (one) => one.id === line.paidDeliverableVersionId,
      );
      const url =
        version &&
        (await signPrivateAddress(
          deliverableObjectPath(version.sku, version.checksum, version.fileName),
          reusing ? liveSeconds : linkSeconds,
        ));
      // Nothing has been spent at this point, which is the whole reason the
      // address is produced before the download is counted.
      if (!url) {
        return { status: "refused", reason: "unavailable" };
      }

      if (!reusing) {
        grant.downloadsUsed += 1;
        grant.linkExpiresAt = new Date(
          Date.now() + linkSeconds * 1000,
        ).toISOString();
      }

      return {
        status: "opened",
        url,
        downloadsRemaining: grant.downloadsAllowed - grant.downloadsUsed,
      };
    });
  },
};
