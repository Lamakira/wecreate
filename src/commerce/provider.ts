import type { PaymentEvent, PaymentProviderId } from "@/payments/types";

import type {
  AcceptedLegalRevision,
  BuyerContact,
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
} from "./types";

/**
 * The single outbound boundary between WeCreate and its commerce data plane.
 *
 * Everything the application knows about staff identity, Paid Deliverables and
 * the audit trail arrives through this interface (ADR-0008). One provider
 * covers all three because one service does: Supabase is Postgres, private
 * Storage and staff Auth at once, and splitting it into three boundaries would
 * invent seams the vendor does not have — an upload and the row that records it
 * have to succeed or fail together.
 *
 * Acceptance tests run the real application against the `fixture`
 * implementation, which is why no test mocks a page, an action or a query.
 */
export interface CommerceProvider {
  readonly id: CommerceProviderId;

  /**
   * Exchange a staff member's own credentials for a session.
   *
   * A password alone never reaches assurance level 2, so what comes back is a
   * session that still has to be raised by a second factor before it may see
   * anything.
   */
  signIn(email: string, password: string): Promise<SignInOutcome>;

  /** Who this session belongs to, and how far it has authenticated. */
  readOperator(
    credentials: OperatorCredentials,
  ): Promise<CommerceOperator | undefined>;

  /** Raise a session to assurance level 2 with a code from an enrolled factor. */
  verifySecondFactor(
    credentials: OperatorCredentials,
    input: { factorId: string; code: string },
  ): Promise<VerificationOutcome>;

  /**
   * Begin enrolling a factor. The secret it returns is shown once, to the staff
   * member enrolling it, and is never stored by this application.
   */
  enrolSecondFactor(
    credentials: OperatorCredentials,
    input: { label: string },
  ): Promise<EnrolmentTicket>;

  /** Finish enrolment by proving the authenticator produces the right codes. */
  confirmSecondFactor(
    credentials: OperatorCredentials,
    input: { factorId: string; code: string },
  ): Promise<VerificationOutcome>;

  /** End this session. */
  signOut(credentials: OperatorCredentials): Promise<void>;

  /** Every Paid Deliverable WeCreate holds, with its versions and active one. */
  readPaidDeliverables(
    credentials: OperatorCredentials,
  ): Promise<PaidDeliverable[]>;

  /**
   * Store an uploaded file and record the immutable version it becomes.
   *
   * Refuses rather than throws when the bytes are already stored: replacing a
   * Paid Deliverable is a new version, and nothing may be written over a
   * version an Order Snapshot could already reference.
   */
  createPaidDeliverableVersion(
    credentials: OperatorCredentials,
    upload: DeliverableUploadRequest,
  ): Promise<CreateVersionOutcome>;

  /** Make one existing version the one future purchases receive. */
  activatePaidDeliverableVersion(
    credentials: OperatorCredentials,
    input: { sku: string; versionId: string },
  ): Promise<ActivationOutcome>;

  /** The append-only record of what staff did, newest first. */
  readAuditTrail(
    credentials: OperatorCredentials,
    limit: number,
  ): Promise<CommerceAuditEntry[]>;

  /**
   * The SKUs a buyer could be sold today.
   *
   * The one read on the public browsing path, and the only one that carries no
   * session: it answers a question the Boutique already prints on every card.
   * It is read once per cache fill rather than per request, so no visit to
   * `/boutique` reaches this provider at all (ADR-0003).
   */
  readActiveSkus(): Promise<string[]>;

  /**
   * Write the immutable Order Snapshot, and open the first payment attempt
   * against it.
   *
   * One call rather than two, because issue #1 asks for the pending attempt to
   * exist *before* a provider is contacted: an order that reached FedaPay with
   * nothing recorded on this side would be a charge nobody here could explain.
   *
   * The caller supplies what it resolved from Managed Content — the products,
   * their published titles and the prices the buyer accepted. The Paid
   * Deliverable Version of each line and the order's total are supplied by the
   * data plane itself, from what is activated at this moment, so neither is a
   * number that travelled through a browser or an application process.
   */
  createOrder(request: CreateOrderRequest): Promise<CreateOrderOutcome>;

  /**
   * Open another attempt against an order that is still waiting to be paid.
   *
   * Deliberately returns no more than `readOrder` does. Handing back the buyer's
   * contact details would be convenient — a payment provider needs a customer —
   * and it would mean anything able to call this could read a buyer's name,
   * email and telephone out of a reference. The details the next attempt is made
   * with come from the request that asked for it instead.
   */
  openPaymentAttempt(reference: string): Promise<OpenAttemptOutcome>;

  /** Record what the provider answered for one attempt, or that it did not. */
  settlePaymentAttempt(
    attemptId: string,
    outcome: PaymentAttemptOutcome,
  ): Promise<void>;

  /**
   * Record one verified provider event, and let it decide the Payment State if
   * it is allowed to.
   *
   * The only way a Payment State ever moves. Recording the event and applying
   * it are one call because they are one transaction: an event that was acted
   * on but not written down could be acted on again, and one written down but
   * not acted on would leave an order pending with its own approval sitting in
   * the trail.
   *
   * It never throws for an event that is merely unwelcome — a duplicate, a late
   * one, one for a transaction this deployment does not know. Each of those is
   * an answer (see `PaymentEventRecord`), because the caller owes the provider
   * an acknowledgement either way and a provider told "failed" redelivers
   * forever.
   */
  recordPaymentEvent(event: PaymentEvent): Promise<PaymentEventRecord>;

  /**
   * One order by its reference, as the server observes it.
   *
   * No session behind it — a guest has none — so what it returns is only what a
   * page may show somebody holding the reference. See `OrderSnapshot`.
   */
  readOrder(reference: string): Promise<OrderSnapshot | undefined>;

  /**
   * Where one order stands, and nothing else about it.
   *
   * Separate from `readOrder` rather than derived from it, because the
   * difference is the point: this is what a page polls every few seconds while
   * a buyer waits, and a poll that returned an order and printed two fields of
   * it would still have read the order. See `OrderState`.
   */
  readOrderState(reference: string): Promise<OrderState | undefined>;

  /**
   * Claim one approved order for delivery, and make its grants.
   *
   * The whole of what makes fulfillment happen once, and once is not the same
   * as *at most* once. Two rules, and they pull against each other on purpose
   * (ADR-0010):
   *
   * **No two callers hold a claim at the same time.** Claiming and granting are
   * one call because they are one transaction, and the claim is what the second
   * caller loses — so a redelivered webhook, a retried request and two processes
   * racing produce one set of grants and one receipt between them.
   *
   * **A claim nobody finished may be taken up.** A delivery that failed, and one
   * abandoned unfinished for longer than `stalledSeconds`, are both claimable
   * again. What makes that safe rather than a second delivery is that
   * everything durable is idempotent: the grants already made are kept exactly
   * as the buyer left them, and the access row is reissued rather than added to.
   *
   * It creates one grant per Order Snapshot line, against the Paid Deliverable
   * Version that line recorded — never the one activated today. Only the digest
   * of the emailed token is stored; the token itself never reaches this
   * boundary and could not be recovered from what does.
   */
  beginFulfillment(
    request: BeginFulfillmentRequest,
  ): Promise<BeginFulfillmentOutcome>;

  /**
   * Record how the delivery this caller claimed went.
   *
   * It moves a Fulfillment State and touches nothing else — least of all a
   * Payment State. A receipt that could not be sent and a file that could not
   * be prepared must never be able to unsay that a buyer paid (ADR-0005).
   *
   * `claimId` is what makes it *this caller's* delivery rather than whichever
   * one the order is currently running. Once a claim may be taken up by
   * somebody else, an abandoned request waking up to report a failure would
   * otherwise settle the delivery that replaced it — and mark an order failed
   * that had just succeeded.
   *
   * It answers whether it did settle, rather than nothing at all: a caller told
   * nothing would go on believing it had delivered an order that belongs to
   * somebody else now, and that is precisely the thing worth a line in the log.
   */
  settleFulfillment(
    reference: string,
    state: FulfillmentOutcome,
    claimId: string,
  ): Promise<boolean>;

  /**
   * What the holder of this token may still open, or nothing.
   *
   * Addressed by the digest rather than by the token, so nothing that could
   * open an order is ever written to a log, a query or a database. Expired
   * access answers `undefined` exactly as an unknown token does: a caller
   * learns whether it may proceed and never why not, which is what keeps
   * guessing a token from being a way to discover that one existed.
   */
  readOrderAccessByToken(tokenDigest: string): Promise<OrderAccess | undefined>;

  /**
   * The same, for a browser holding the order rather than the token.
   *
   * What the paid checkout view prints: which files, until when, how many
   * downloads are left. It shows and never opens — the token in the buyer's
   * email is what authorises a download, and a page reached with the order
   * cookie deliberately cannot stand in for it.
   *
   * Access that has run out answers `undefined` here too. The two reads apply
   * one rule between them, so a page cannot end up offering rows for something
   * the download boundary would refuse.
   */
  readOrderAccess(reference: string): Promise<OrderAccess | undefined>;

  /**
   * Hand over a temporary private address for one purchased file.
   *
   * The one place a storage address crosses this boundary, and it crosses it to
   * be redirected to. It is not returned to be rendered, stored or logged: it
   * is the file, for the next few minutes, to whoever holds it.
   *
   * Three things happen inside, in this order, and the order is the rule issue
   * #1 asks for. The access, the grant and the allowance are checked; *then* an
   * address is produced; *then* a download is spent. So a store that did not
   * answer costs a buyer nothing, and a buyer asking again while their last
   * address is still good is spending the same download rather than another —
   * which is what makes a fifteen-minute address safe to hand out.
   */
  openDownload(request: OpenDownloadRequest): Promise<OpenDownloadOutcome>;
}

export interface BeginFulfillmentRequest {
  reference: string;
  /** SHA-256 of the token the buyer is about to be emailed, hexadecimal. */
  tokenDigest: string;
  /**
   * How long the buyer may come back for.
   *
   * A duration rather than a moment, because issue #1 measures it from the
   * *approval* and only the data plane knows when that was: the caller here is
   * running some time after it, and however short that gap is, a moment
   * computed on this side would be a deadline decided by how quickly a mail
   * provider answered.
   */
  accessDays: number;
  /** Successful downloads each grant starts with. */
  downloadsAllowed: number;
  /**
   * How long a claim may go unfinished before another caller may take it up.
   *
   * `FULFILLMENT_STALL_SECONDS` in `src/commerce/order-access.ts`, passed in the
   * way the three durations above are: the rule is the application's and the
   * data plane is what applies it inside a transaction.
   */
  stalledSeconds: number;
}

/**
 * Two answers, and no third.
 *
 * `refused` is every reason there is nothing to do: no such order, a payment
 * that was not approved, a delivery already finished, and — the one that
 * matters — one another caller is running right now. They are one answer
 * because the caller does the same thing with all of them, which is nothing.
 */
export type BeginFulfillmentOutcome =
  | {
      status: "claimed";
      order: OrderSnapshot;
      access: OrderAccess;
      /**
       * This claim's own identity, to settle it with.
       *
       * New on every claim, including on one that takes up an abandoned
       * delivery, which is what stops the abandoned caller from settling the
       * delivery that replaced it.
       */
      claimId: string;
      /**
       * Where the receipt goes.
       *
       * The one contact detail this boundary ever hands back, and only here:
       * a delivery has to know its address, and nothing else does. It is
       * bounded by the same credential that can approve a payment rather than
       * by an order reference — see `beginFulfillment`.
       */
      deliverTo: string;
    }
  | { status: "refused" };

/** How a delivery ended. Neither value may touch a Payment State. */
export type FulfillmentOutcome = "delivered" | "failed";

export interface OpenDownloadRequest {
  /** SHA-256 of the token the buyer arrived with, hexadecimal. */
  tokenDigest: string;
  /** Which of the order's Digital Products they asked for. */
  sku: string;
  /** How long the address handed back may be used for. */
  linkSeconds: number;
}

/**
 * Why a buyer was not handed a file.
 *
 * Four reasons, and the surface that reports them says less than this does: an
 * expired token and one that was never issued are the same `unknownAccess`, so
 * a caller working through guesses learns nothing from the answer.
 */
export type DownloadRefusal =
  | "unknownAccess"
  | "unknownProduct"
  | "exhausted"
  | "unavailable";

export type OpenDownloadOutcome =
  | { status: "opened"; url: string; downloadsRemaining: number }
  | { status: "refused"; reason: DownloadRefusal };

/** One line of an order, as the application resolved it before writing it. */
export interface OrderLineRequest {
  productId: string;
  sku: string;
  title: string;
  /** The whole-XOF price on sale, which is also the price the buyer accepted. */
  unitPriceXof: number;
}

export interface CreateOrderRequest {
  /** WeCreate's own reference, from `newOrderReference()`. */
  reference: string;
  lines: OrderLineRequest[];
  buyer: BuyerContact;
  acceptedLegal: AcceptedLegalRevision[];
  /** Which payment provider the first attempt will be made with. */
  provider: PaymentProviderId;
}

/**
 * Two answers, and no third.
 *
 * `refused` is the one race the checkout cannot close from outside: a Paid
 * Deliverable Version that was activated when the cart was resolved and is not
 * when the order is written. Nothing is stored in that case, so a buyer sent
 * back to their cart has not left an order behind.
 */
export type CreateOrderOutcome =
  | { status: "created"; order: OrderSnapshot; attempt: PaymentAttempt }
  | { status: "refused"; skusWithoutDeliverable: string[] };

export type OpenAttemptOutcome =
  | { status: "opened"; order: OrderSnapshot; attempt: PaymentAttempt }
  | { status: "refused" };

export type PaymentAttemptOutcome =
  | { status: "redirected"; providerTransactionId: string }
  | { status: "failed"; reason: string };

export interface DeliverableUploadRequest {
  sku: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  /** SHA-256 of `bytes`, computed by the application rather than the browser. */
  checksum: string;
}

export type SignInOutcome =
  | { status: "signed-in"; credentials: OperatorCredentials }
  | { status: "refused" };

export type VerificationOutcome =
  | { status: "verified"; credentials: OperatorCredentials }
  | { status: "refused" };

/** What a staff member needs to add this factor to their authenticator. */
export interface EnrolmentTicket {
  factorId: string;
  /** The shared secret, shown once and never stored here. */
  secret: string;
  /** The same secret as an `otpauth://` address, for an authenticator app. */
  uri: string;
}

/**
 * Two answers, and no third.
 *
 * An upload the rules have already accepted either becomes the next version or
 * is already one of them. Anything else — a store that is unreachable, a
 * database that refuses — is a failure rather than an outcome, and is thrown so
 * it cannot be mistaken for "WeCreate has no file for this".
 */
export type CreateVersionOutcome =
  | { status: "created"; version: PaidDeliverableVersion }
  | { status: "alreadyStored"; version: PaidDeliverableVersion };

export type ActivationOutcome =
  | { status: "activated"; version: PaidDeliverableVersion }
  | { status: "refused" };

/**
 * Which data plane this process talks to.
 *
 * `none` is not an error state: it is a checkout with no Supabase project,
 * where the site still runs, the Boutique still says *bientôt disponible*, and
 * the back office says out loud that it is not configured — exactly as `/studio`
 * does without a Sanity project.
 *
 * The fixture is never reached by accident. It holds published credentials, so
 * an unconfigured deployment must not fall back to it the way the content
 * provider does: it is used only when something explicitly asks for it.
 */
export type CommerceProviderId = "supabase" | "fixture" | "none";

export function resolveCommerceProviderId(): CommerceProviderId {
  const configured = process.env.WECREATE_COMMERCE_PROVIDER;
  if (configured === "fixture" || configured === "supabase") {
    return configured;
  }
  return process.env.SUPABASE_URL ? "supabase" : "none";
}

/** The provider in use, or `undefined` on a deployment with no data plane. */
export async function getCommerceProvider(): Promise<
  CommerceProvider | undefined
> {
  switch (resolveCommerceProviderId()) {
    case "fixture": {
      const { fixtureCommerceProvider } = await import("./fixture/provider");
      return fixtureCommerceProvider;
    }
    case "supabase": {
      // Imported lazily so a run without a data plane never loads the Supabase
      // client or requires its environment variables to be present.
      const { supabaseCommerceProvider } = await import("./supabase/provider");
      return supabaseCommerceProvider;
    }
    default:
      return undefined;
  }
}
