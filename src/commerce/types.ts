import type { LegalDocumentKind } from "@/managed-content/types";
import type { PaymentOutcome, PaymentProviderId } from "@/payments/types";

/**
 * The commerce data plane, in WeCreate's own vocabulary.
 *
 * Everything here describes what the application needs to know, not what a
 * provider happens to return: a Paid Deliverable Version is a version of a file
 * a buyer receives, not a storage object; a Commerce Operator is a member of
 * WeCreate's staff, not an auth row. The Supabase adapter maps its shapes onto
 * these, and the fixture produces the same ones without a vendor (ADR-0008).
 *
 * One thing is deliberately almost absent: where the bytes live. No storage
 * bucket and no object path crosses this boundary, so no page, component or
 * audit entry can print one (issue #1). The single exception is the temporary
 * address `openDownload` hands back, which exists to be followed and is
 * redirected to rather than rendered — it is never stored, never logged and
 * never shown; see `OpenDownloadOutcome` in `provider.ts`.
 */

/** How far a staff member's current session has authenticated. */
export type AssuranceLevel = "aal1" | "aal2";

/**
 * A second factor a staff member has enrolled.
 *
 * More than one is normal and encouraged: the second is the backup that keeps a
 * lost phone from locking WeCreate out of its own commerce data (issue #1).
 */
export interface SecondFactor {
  id: string;
  /** What the staff member called it — "Téléphone", "Tablette de secours". */
  label: string;
}

/**
 * The staff member behind the current session.
 *
 * `administersCommerce` is a separate question from being signed in, and stays
 * separate even when the same person also edits content: Content Editor and
 * Commerce Operator are distinct permissions (issue #1). WeCreate
 * issues one account per person — there is no shared administrator identity for
 * an audit entry to point at.
 */
export interface CommerceOperator {
  id: string;
  email: string;
  /** How far *this session* has got. Commerce data requires `aal2`. */
  assurance: AssuranceLevel;
  /** Verified second factors, in the order they were enrolled. */
  factors: SecondFactor[];
  /** Whether commerce administration is one of this staff member's roles. */
  administersCommerce: boolean;
}

/**
 * What a signed-in session carries between requests. Opaque to the application:
 * only the adapter that issued it knows how to read it.
 */
export interface OperatorCredentials {
  accessToken: string;
  refreshToken: string;
}

/**
 * One immutable revision of the file a buyer receives.
 *
 * Created once and never edited: an Order Snapshot references exactly this
 * identity, so replacing a product's file adds the next version rather than
 * rewriting this one (CONTEXT.md, issue #1).
 */
export interface PaidDeliverableVersion {
  id: string;
  /** The Digital Product this belongs to — the identity the two systems share. */
  sku: string;
  /** 1, 2, 3 … in the order they were uploaded for this SKU. */
  version: number;
  fileName: string;
  contentType: string;
  byteSize: number;
  /** SHA-256 of the stored bytes, hexadecimal. The file's identity. */
  checksum: string;
  createdAt: string;
  /** The individual staff member who uploaded it. */
  createdByEmail: string;
}

/** Every version of one product's Paid Deliverable, and which one is on sale. */
export interface PaidDeliverable {
  sku: string;
  /** Newest first. */
  versions: PaidDeliverableVersion[];
  /** The version future purchases receive, or `null` while none is activated. */
  activeVersionId: string | null;
}

/** What a Commerce Operator did, recorded so it cannot be denied or rewritten. */
export type CommerceAuditAction =
  | "paid-deliverable-version.created"
  | "paid-deliverable-version.activated";

/**
 * One entry in the append-only audit trail.
 *
 * Staff identity, when, what was targeted, and safe before/after metadata —
 * version numbers, file names, checksums. Never a secret, a token or a storage
 * address (issue #1).
 */
export interface CommerceAuditEntry {
  id: string;
  occurredAt: string;
  actorEmail: string;
  action: CommerceAuditAction;
  sku: string;
  before: AuditMetadata | null;
  after: AuditMetadata | null;
}

/** The safe half of what changed: what a version is, never where it is kept. */
export interface AuditMetadata {
  version: number;
  fileName: string;
  checksum: string;
}

/**
 * The independently tracked outcome of collecting money for one order.
 *
 * Separate from fulfillment on purpose (ADR-0005): a receipt that could not be
 * emailed and a file that could not be prepared must never be able to unsay
 * that the buyer paid.
 */
export type PaymentState = "pending" | "approved" | "failed" | "cancelled";

/** The independently tracked progress of delivering what was paid for. */
export type FulfillmentState =
  | "not_started"
  | "processing"
  | "delivered"
  | "failed";

/**
 * Where an order stands, and nothing else about it.
 *
 * The whole of what the public order-state boundary reads. It carries no
 * reference, no total, no product and no address — not even the masked one —
 * because a browser polling for a confirmation needs to know when to stop
 * polling, and a surface that returns more is a way to read an order (issue #1).
 *
 * There is no "unknown" here. An order the data plane cannot answer for is
 * absent rather than uncertain; saying so is the HTTP boundary's job, and its
 * own answer is in `src/app/(site)/commande/etat/route.ts`.
 */
export interface OrderState {
  payment: PaymentState;
  fulfillment: FulfillmentState;
  /**
   * Whether a payment on this order is still waiting on a verified event.
   *
   * The one thing the waiting page actually polls for, and the reason it is
   * here rather than inferred from the Payment State: once a buyer may pay
   * again (issue #13), a second refusal leaves that state exactly as it was.
   * A page watching for the *state* to move would go on saying *Vérification du
   * paiement* over a payment FedaPay had already refused twice.
   *
   * It says nothing about the order beyond what the two states beside it
   * already say — no reference, no total, no product, no address — which is the
   * rule this boundary actually keeps.
   */
  awaiting: boolean;
}

/**
 * What one recorded event was allowed to do when it arrived.
 *
 * Stored on the event itself, so a late or contradictory delivery leaves a
 * trail that explains itself rather than disappearing:
 *
 * - `applied`: it decided the Payment State.
 * - `unchanged`: it said nothing new — a transaction the provider has only just
 *   created, or a second event agreeing with the first.
 * - `superseded`: it arrived after the state was already decided. Payment truth
 *   settles once (ADR-0005), so this is kept for reconciliation rather than
 *   acted on.
 */
export type PaymentEventEffect = "applied" | "unchanged" | "superseded";

/**
 * What recording one verified provider event came to.
 *
 * The three effects above, plus the two answers that are about the *delivery*
 * rather than the event — neither of which is ever written down, because in
 * both cases there is nothing new to write:
 *
 * - `duplicate`: this exact event was already recorded. Nothing happened twice.
 * - `unmatched`: no order here was paid through that transaction — another
 *   environment's webhook, or one pointed at the wrong deployment.
 *
 * Every one of them is a success as far as the provider is concerned: the event
 * was received and will not be redelivered.
 */
export type PaymentEventDisposition =
  | PaymentEventEffect
  | "duplicate"
  | "unmatched";

/**
 * Something that happened to an order which no rule here could settle.
 *
 * Not an error and not a state: a decision WeCreate has to make by hand, kept
 * where the person making it will find it (issue #15's Commerce Operator view).
 * Three of them, and each is a thing the automatic rules deliberately refuse to
 * guess at:
 *
 * - `duplicate_payment`: a *second* transaction was approved for one order. The
 *   Payment State does not move — it was already approved — so nothing is
 *   delivered twice, and somebody owes the buyer a refund that only a person
 *   can decide on.
 * - `contradictory_event`: a provider said one thing about a transaction and
 *   then the opposite. Payment truth is settled by the first answer that was
 *   allowed to decide it (ADR-0009), so the later one is kept and not acted on.
 * - `fulfillment_failed`: a delivery could not be finished. The payment stays
 *   approved and the grants stand (ADR-0005), and a buyer who has not been
 *   written to is somebody WeCreate has to write to.
 *
 * A delivery *taken up again* is deliberately not one (ADR-0010). It is the
 * thing that was supposed to happen, and there is nothing for anybody to decide
 * about it — a queue of work that includes its own successes is a queue nobody
 * reads.
 */
export type OrderAnomalyKind =
  | "duplicate_payment"
  | "contradictory_event"
  | "fulfillment_failed";

/**
 * One of those, as it is kept.
 *
 * What is *not* here is the point, and it is the same rule the audit trail
 * keeps: the provider's own identifiers, which are not secrets and are what an
 * operator has in front of them in a provider dashboard — and nothing of the
 * buyer, no delivery body, no token and no storage address. A raw payload kept
 * "just in case" would be an unbounded copy of somebody's contact details in a
 * table nobody reads until something has gone wrong (issue #1).
 */
export interface OrderAnomaly {
  kind: OrderAnomalyKind;
  /** The order it is about, which is what an operator quotes back to a buyer. */
  reference: string;
  detectedAt: string;
  provider: string | null;
  providerTransactionId: string | null;
  providerEventId: string | null;
  /** Why, in words safe to store and log. Never a payload, an address or a key. */
  detail: string | null;
  /** When a Commerce Operator settled it, or `null` while it is outstanding. */
  resolvedAt: string | null;
}

export interface PaymentEventRecord {
  disposition: PaymentEventDisposition;
  /** Where the Payment State stands afterwards, when an order was found. */
  paymentState: PaymentState | null;
  /**
   * Which order it turned out to be about, when it was about one.
   *
   * Here so that the one caller allowed to move a Payment State can start the
   * delivery of the order it just approved. A webhook carries the provider's
   * transaction id and nothing of WeCreate's, so without this the endpoint
   * would have to find the order a second way — and the only other way is to
   * read one, which is a wider thing to be allowed to do than this.
   */
  orderReference: string | null;
}

/**
 * One Digital Product as an order recorded it, and never again.
 *
 * Every value is the answer WeCreate's own systems gave at the moment the order
 * was created — the published title, the price on sale, and the Paid
 * Deliverable Version activated for that SKU. A later retitle, reprice, archive
 * or replacement changes none of them (CONTEXT.md).
 */
export interface OrderSnapshotLine {
  /** The Digital Product's stable content identity. */
  productId: string;
  /** The identity the two systems share, and what the version was activated against. */
  sku: string;
  title: string;
  /** Whole XOF. Quantity is always one, so this is also the line total. */
  unitPriceXof: number;
  paidDeliverableVersionId: string;
  paidDeliverableVersion: number;
}

/**
 * One purchased Digital Product a buyer may still open.
 *
 * It hangs off the order line rather than off the access token, which is what
 * makes reissuing a token — a lost email, a mistyped address — leave the
 * allowance exactly where it was (issue #1). The version is the one the Order
 * Snapshot recorded and never the one on sale today: replacing a Paid
 * Deliverable is a new version, and a buyer receives what they bought
 * (CONTEXT.md).
 */
export interface OrderAccessGrant {
  sku: string;
  /** The title the order recorded, so an archived or retitled product still reads. */
  title: string;
  paidDeliverableVersion: number;
  /** Successful downloads this grant started with. */
  downloadsAllowed: number;
  downloadsRemaining: number;
}

/**
 * A buyer's time-limited ability to open one paid order, without an account.
 *
 * What is *not* here is the point. There is no token and no digest of one: a
 * caller proves what it holds by asking with it, and nothing that reads access
 * back is handed the credential. There is no storage address either — see the
 * note at the top of this file.
 */
export interface OrderAccess {
  /** The order this opens, which is what a buyer quotes to support. */
  reference: string;
  /**
   * ISO 8601. When the token now in force was issued.
   *
   * It moves when a delivery is taken up again and a fresh token is emailed
   * (ADR-0010), which is exactly what makes it useful: it is the stable name of
   * *this* issuance, and the receipt carrying that token is idempotent under it.
   * A key that named only the order would let a provider swallow the second
   * message as a repeat of one the buyer never received.
   */
  issuedAt: string;
  /** ISO 8601. Thirty days after the payment was approved. */
  expiresAt: string;
  /** One per Digital Product on the Order Snapshot, in the order it was bought. */
  grants: OrderAccessGrant[];
}

/**
 * Where an order is going, as the buyer wrote it.
 *
 * Recorded with the order and deliberately not part of what this boundary reads
 * back — see `OrderSnapshot`. Issue #1 allows exactly these four and no postal
 * address.
 */
export interface BuyerContact {
  fullName: string;
  email: string;
  /** International form, `+` and digits only. */
  telephone: string;
  company: string | null;
}

/**
 * One Legal Revision a buyer accepted, by the identity that still resolves to
 * exactly those words.
 */
export interface AcceptedLegalRevision {
  kind: LegalDocumentKind;
  revisionId: string;
  effectiveFrom: string;
}

/**
 * One attempt to collect the money for an order.
 *
 * `pending` is an attempt this application has opened and not yet handed to the
 * provider; `redirected` is one the provider accepted and gave a page for;
 * `failed` is one the provider never took. None of them is a Payment State: a
 * buyer who reached the hosted page may still not have paid, and only a
 * verified webhook may say otherwise (issue #11).
 */
export type PaymentAttemptState = "pending" | "redirected" | "failed";

export interface PaymentAttempt {
  id: string;
  createdAt: string;
  /** What *this application* did with the attempt. */
  state: PaymentAttemptState;
  /** Which payment provider this attempt was made with. */
  provider: PaymentProviderId;
  /** The provider's own identity for the transaction, once it has one. */
  providerTransactionId: string | null;
  /** Why the provider could not be reached, in words safe to store and log. */
  failureReason: string | null;
  /**
   * The verdict most recently recorded for this attempt's transaction.
   *
   * The other half of `state`, and the half WeCreate does not get a vote in.
   * Derived from the recorded events rather than stored beside them, so it
   * cannot drift from the trail it is read out of, and `null` until one of them
   * decides something — a `transaction.created` announces a transaction and
   * answers nothing. A provider that contradicts itself about one transaction
   * is kept in the trail either way, and what an order's Payment State makes of
   * those events is `paymentEventEffect()`'s decision rather than this field's.
   *
   * It is what tells an outstanding payment from a settled one once an order
   * has more than one attempt on it (issue #13). Both surfaces need that: an
   * order whose Payment State reads *failed* may have a fresh transaction open
   * with the provider, and offering a second payment page for it is how
   * somebody pays twice.
   */
  outcome: PaymentOutcome | null;
}

/**
 * An order, as the server observes it.
 *
 * The buyer's contact details are recorded with the order and are deliberately
 * absent here. This is read by its reference alone, with no session behind it,
 * so what it returns is what a page may show somebody holding that reference:
 * what was bought, what it costs, and where payment stands. `buyerEmailHint` is
 * enough for a buyer to recognise their own address and not enough for anyone
 * else to read it. The back office reads the rest under a staff identity
 * (issue #15).
 */
export interface OrderSnapshot {
  /** WeCreate's own identity for this order, printed on the ticket. */
  reference: string;
  createdAt: string;
  lines: OrderSnapshotLine[];
  /** Whole XOF, summed by the data plane from the lines it stored. */
  totalXof: number;
  /** `a***@exemple.com`: the delivery address, masked. */
  buyerEmailHint: string;
  acceptedLegal: AcceptedLegalRevision[];
  paymentState: PaymentState;
  fulfillmentState: FulfillmentState;
  /** Every attempt made on this order, oldest first. */
  attempts: PaymentAttempt[];
}
