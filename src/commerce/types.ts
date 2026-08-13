/**
 * The commerce data plane, in WeCreate's own vocabulary.
 *
 * Everything here describes what the application needs to know, not what a
 * provider happens to return: a Paid Deliverable Version is a version of a file
 * a buyer receives, not a storage object; a Commerce Operator is a member of
 * WeCreate's staff, not an auth row. The Supabase adapter maps its shapes onto
 * these, and the fixture produces the same ones without a vendor (ADR-0008).
 *
 * One thing is deliberately absent: where the bytes live. No storage bucket,
 * path or signed URL crosses this boundary, so no page, component or audit
 * entry can print one (issue #1).
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
