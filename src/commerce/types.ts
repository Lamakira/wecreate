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

/**
 * What a Commerce Operator did, recorded so it cannot be denied or rewritten.
 *
 * Two of them are about the file behind a product and five are about one
 * buyer's order, and every one of them is a thing a person chose to do. What is
 * deliberately absent is any action that would rewrite payment truth, an Order
 * Snapshot or a historical Paid Deliverable Version: those are not audited
 * because they cannot be done (issue #15).
 */
export type CommerceAuditAction =
  | "paid-deliverable-version.created"
  | "paid-deliverable-version.activated"
  | "order-contact.corrected"
  | "order-access.reissued"
  | "order-access.upgraded"
  | "order-delivery.retried"
  | "order.annotated";

/**
 * One entry in the append-only audit trail.
 *
 * Staff identity, when, what was targeted, and safe before/after metadata —
 * version numbers, file names, checksums, masked contact details. Never a
 * secret, a token or a storage address (issue #1).
 *
 * An entry names a product, an order, or both: a version is activated for a
 * SKU and nobody's order, a delivery is taken up again for an order and no
 * particular SKU, and a version upgrade granted to one buyer is about both.
 */
export interface CommerceAuditEntry {
  id: string;
  occurredAt: string;
  actorEmail: string;
  action: CommerceAuditAction;
  /** The Digital Product this was about, when it was about one. */
  sku: string | null;
  /** The order this was about, when it was about one. */
  orderReference: string | null;
  before: AuditMetadata | null;
  after: AuditMetadata | null;
}

/**
 * The safe half of what changed.
 *
 * Every field is optional because what is worth recording differs by action: a
 * version has a number and a checksum, a corrected address has a masked
 * address, a settled anomaly has what a person wrote about it. What none of
 * them ever carries is a secret, a token or the address of a stored file — and
 * no contact detail in full, because this trail may never be deleted and a copy
 * of somebody's address that outlives every other copy is the thing issue #1
 * refuses to keep.
 */
export interface AuditMetadata {
  /** A Paid Deliverable Version's number. */
  version?: number;
  fileName?: string;
  checksum?: string;
  /** A delivery address, masked: `a***@exemple.com`. */
  emailHint?: string;
  /** A telephone, masked: `+229•••80`. */
  telephoneHint?: string;
  /** A Fulfillment State, for an entry about a delivery. */
  fulfillment?: FulfillmentState;
  /** When the Order Access being replaced was issued. */
  issuedAt?: string;
  /** Which Order Anomaly this settled, by kind. */
  anomaly?: OrderAnomalyKind;
  /** Why, in the words the operator wrote. */
  note?: string;
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
  id: string;
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
  /**
   * What they decided, in their own words, and who they are.
   *
   * The other half of settling one, and the reason an anomaly carries it rather
   * than leaving it to the trail alone: the next person to open this order is
   * looking at the anomaly, and "somebody has dealt with this" without saying
   * what they did is a row that gets dealt with twice. Written once, with
   * `resolvedAt`, and never rewritten afterwards.
   */
  resolution: string | null;
  resolvedByEmail: string | null;
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
  /**
   * The version this grant actually opens today.
   *
   * The same number as the one above, until a Commerce Operator deliberately
   * grants a later one (issue #15). It is a second field rather than a
   * correction of the first because the two answer different questions and both
   * have to stay answerable: what this buyer bought is what their Order
   * Snapshot recorded and may never change, and what WeCreate has since decided
   * they may open is this.
   */
  deliveredVersion: number;
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

/**
 * A Commerce Operator's record that what the buyer wrote is not where their
 * order should go.
 *
 * A mistyped address, a number nobody answers on. It sits *beside* the Order
 * Snapshot rather than in it: the snapshot keeps what the buyer typed, for ever
 * and whatever anyone discovers about it afterwards, and this is the separate,
 * later, attributable fact that a delivery reads instead (issue #15). Which of
 * the two is used is `deliveryAddress()`'s decision, in `contact.ts`.
 *
 * One correction stands at a time — the most recent — and the audit trail keeps
 * every one of them, so a second correction is a new entry rather than a lost
 * one.
 */
export interface ContactCorrection {
  /** The corrected address, or `null` when only the telephone was wrong. */
  email: string | null;
  telephone: string | null;
  /** Why, in the operator's own words. */
  reason: string;
  correctedAt: string;
  /** The individual who recorded it. There is no shared account to point at. */
  correctedByEmail: string;
}

/**
 * One verified provider event, as the trail kept it.
 *
 * Read by the back office and nowhere else, because it is the only surface that
 * ever needs to explain *why* a Payment State is where it is: a provider's own
 * identifiers, when it says the thing happened, when WeCreate heard about it,
 * what it said, and what that was allowed to do. No payload, and nothing of the
 * buyer — the same rule `OrderAnomaly` keeps.
 */
export interface RecordedPaymentEvent {
  id: string;
  provider: string;
  providerEventId: string;
  providerEventType: string;
  providerTransactionId: string;
  /** When the provider says it happened. */
  occurredAt: string;
  /** When WeCreate recorded it, which is what the thirty days run from. */
  receivedAt: string;
  outcome: PaymentState;
  effect: PaymentEventEffect;
}

/**
 * One order in the Commerce Operator's list.
 *
 * Enough to find the order somebody is telephoning about and to see which
 * orders have something wrong with them, and no more: the contact details, the
 * events and the grants are on the Order Dossier, which is one order at a time
 * and one deliberate navigation away.
 */
export interface OrderSummary {
  reference: string;
  createdAt: string;
  totalXof: number;
  /** `a***@exemple.com`: where the receipt goes, masked. */
  buyerEmailHint: string;
  paymentState: PaymentState;
  fulfillmentState: FulfillmentState;
  /** The kinds of Order Anomaly still outstanding on it, oldest first. */
  outstanding: OrderAnomalyKind[];
}

/**
 * Everything WeCreate knows about one order, assembled for the Commerce
 * Operator resolving a problem with it.
 *
 * The one read in this application that returns a buyer's contact details, and
 * the reason it may: it is bounded by an individual staff member's session at
 * assurance level 2 with the Commerce Operator role, rather than by an order
 * reference (`OrderSnapshot` says why that difference matters). Postgres asks
 * the same question again before it reads a row.
 *
 * It is deliberately whole. An operator with a buyer on the telephone is
 * answering "what did they pay, did it arrive, did we deliver it, and what is
 * open on it" — four questions across four tables — and a surface that made
 * them navigate between four pages to answer one call would be a surface that
 * gets its answers from somewhere else.
 */
export interface OrderDossier {
  order: OrderSnapshot;
  /** As the buyer wrote it at checkout. Never rewritten. */
  buyer: BuyerContact;
  /** What an operator has since corrected, or `null`. */
  correction: ContactCorrection | null;
  /**
   * Where a receipt for this order goes now.
   *
   * The correction if there is one, the buyer's own address otherwise. Read
   * back rather than recomputed by each surface, so what an operator is shown
   * is the address a delivery would actually use.
   */
  deliverTo: string;
  /** Every verified provider event about it, oldest first. */
  events: RecordedPaymentEvent[];
  /** What the buyer may still open, or `null` when nothing was ever granted. */
  access: OrderAccess | null;
  /** Every Order Anomaly on it, outstanding or settled, oldest first. */
  anomalies: OrderAnomaly[];
  /** What staff have done to this order, newest first. */
  audit: CommerceAuditEntry[];
}
