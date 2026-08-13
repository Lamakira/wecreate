import type {
  CommerceAuditEntry,
  CommerceOperator,
  OperatorCredentials,
  PaidDeliverable,
  PaidDeliverableVersion,
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
}

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
