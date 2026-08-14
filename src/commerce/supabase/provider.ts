import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { COMMERCE_OPERATOR_ROLE } from "../operators";
import { deliverableObjectPath } from "../paid-deliverables";
import type {
  ActivationOutcome,
  CommerceProvider,
  CreateOrderOutcome,
  CreateVersionOutcome,
  EnrolmentTicket,
  OpenAttemptOutcome,
  PaymentAttemptOutcome,
  SignInOutcome,
  VerificationOutcome,
} from "../provider";
import type {
  CommerceAuditEntry,
  CommerceOperator,
  OrderSnapshot,
  OrderState,
  PaidDeliverable,
  PaidDeliverableVersion,
  PaymentAttempt,
  PaymentEventRecord,
} from "../types";
import {
  DELIVERABLES_BUCKET,
  anonymousCommerceClient,
  operatorCommerceClient,
  paymentEventSecret,
} from "./client";

/**
 * WeCreate's commerce data plane, on Supabase.
 *
 * Postgres holds the versions, the activation and the audit trail; private
 * Storage holds the bytes; Auth holds the staff. All three are reached as the
 * staff member doing the work, so the policies in `supabase/migrations/` decide
 * what happens — this adapter's authorisation checks are the second line, not
 * the only one.
 *
 * Every table lives in the `commerce` schema, which is not exposed to the data
 * API. Nothing here queries a table directly: the five functions below are the
 * whole surface, each one refusing a caller who has not reached assurance level
 * 2 with the Commerce Operator role, and each one writing its own audit entry
 * in the same transaction as the change it records.
 */

interface VersionRow {
  id: string;
  sku: string;
  version: number;
  file_name: string;
  content_type: string;
  byte_size: number;
  checksum: string;
  created_at: string;
  created_by_email: string;
}

interface DeliverableRow {
  sku: string;
  active_version_id: string | null;
  versions: VersionRow[];
}

interface AuditRow {
  id: string;
  occurred_at: string;
  actor_email: string;
  action: CommerceAuditEntry["action"];
  sku: string;
  before: { version: number; file_name: string; checksum: string } | null;
  after: { version: number; file_name: string; checksum: string } | null;
}

function toVersion(row: VersionRow): PaidDeliverableVersion {
  return {
    id: row.id,
    sku: row.sku,
    version: row.version,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    checksum: row.checksum,
    createdAt: row.created_at,
    createdByEmail: row.created_by_email,
  };
}

function toAuditEntry(row: AuditRow): CommerceAuditEntry {
  const metadata = (value: AuditRow["before"]) =>
    value
      ? {
          version: value.version,
          fileName: value.file_name,
          checksum: value.checksum,
        }
      : null;

  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorEmail: row.actor_email,
    action: row.action,
    sku: row.sku,
    before: metadata(row.before),
    after: metadata(row.after),
  };
}

interface OrderRow {
  reference: string;
  created_at: string;
  total_xof: number;
  buyer_email_hint: string;
  payment_state: OrderSnapshot["paymentState"];
  fulfillment_state: OrderSnapshot["fulfillmentState"];
  lines: Array<{
    product_id: string;
    sku: string;
    title: string;
    unit_price_xof: number;
    paid_deliverable_version_id: string;
    paid_deliverable_version: number;
  }>;
  accepted_legal: Array<{
    kind: OrderSnapshot["acceptedLegal"][number]["kind"];
    revision_id: string;
    effective_from: string;
  }>;
  attempts: AttemptRow[];
}

interface AttemptRow {
  id: string;
  created_at: string;
  state: PaymentAttempt["state"];
  provider: PaymentAttempt["provider"];
  provider_transaction_id: string | null;
  failure_reason: string | null;
}

function toAttempt(row: AttemptRow): PaymentAttempt {
  return {
    id: row.id,
    createdAt: row.created_at,
    state: row.state,
    provider: row.provider,
    providerTransactionId: row.provider_transaction_id,
    failureReason: row.failure_reason,
  };
}

function toOrder(row: OrderRow): OrderSnapshot {
  return {
    reference: row.reference,
    createdAt: row.created_at,
    totalXof: row.total_xof,
    buyerEmailHint: row.buyer_email_hint,
    paymentState: row.payment_state,
    fulfillmentState: row.fulfillment_state,
    lines: (row.lines ?? []).map((line) => ({
      productId: line.product_id,
      sku: line.sku,
      title: line.title,
      unitPriceXof: line.unit_price_xof,
      paidDeliverableVersionId: line.paid_deliverable_version_id,
      paidDeliverableVersion: line.paid_deliverable_version,
    })),
    acceptedLegal: (row.accepted_legal ?? []).map((accepted) => ({
      kind: accepted.kind,
      revisionId: accepted.revision_id,
      effectiveFrom: accepted.effective_from,
    })),
    attempts: (row.attempts ?? []).map(toAttempt),
  };
}

async function call<T>(
  supabase: SupabaseClient,
  name: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    // Every refusal Postgres raises arrives here, including the assurance and
    // role checks. They are not recoverable and must not be swallowed into an
    // empty list that would read as "WeCreate has no files".
    throw new Error(`commerce: ${name} refused — ${error.message}`);
  }
  return data as T;
}

export const supabaseCommerceProvider: CommerceProvider = {
  id: "supabase",

  async signIn(email, password): Promise<SignInOutcome> {
    const { data, error } = await anonymousCommerceClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.session) {
      return { status: "refused" };
    }

    return {
      status: "signed-in",
      credentials: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    };
  },

  async readOperator(credentials): Promise<CommerceOperator | undefined> {
    const supabase = await operatorCommerceClient(credentials);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return undefined;

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const roles = user.user.app_metadata?.roles;

    return {
      id: user.user.id,
      email: user.user.email ?? "",
      assurance: assurance?.currentLevel === "aal2" ? "aal2" : "aal1",
      // Verified only. An abandoned enrolment leaves an unverified factor
      // behind, and offering one at sign-in would ask for a code from an
      // authenticator nobody finished setting up.
      factors: (factors?.totp ?? [])
        .filter((factor) => factor.status === "verified")
        .map((factor) => ({
          id: factor.id,
          label: factor.friendly_name ?? "Application d'authentification",
        })),
      administersCommerce:
        Array.isArray(roles) && roles.includes(COMMERCE_OPERATOR_ROLE),
    };
  },

  async verifySecondFactor(credentials, { factorId, code }): Promise<VerificationOutcome> {
    const supabase = await operatorCommerceClient(credentials);
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.replace(/\s/g, ""),
    });
    if (error || !data) {
      return { status: "refused" };
    }

    // Verification issues a new session at assurance level 2. The old one stays
    // at level 1, so replacing what this application holds is what raises it.
    return {
      status: "verified",
      credentials: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      },
    };
  },

  async enrolSecondFactor(credentials, { label }): Promise<EnrolmentTicket> {
    // No assurance check here, and deliberately: Supabase refuses to enrol a
    // second factor below assurance level 2 itself. Repeating the rule in this
    // adapter would put a copy of it where it could drift from the one that
    // decides. `mayEnrolSecondFactor()` is what the action and the fixture use.
    const supabase = await operatorCommerceClient(credentials);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: label.trim() || "Facteur de secours",
    });
    if (error || !data) {
      throw new Error(`commerce: enrolment refused — ${error?.message}`);
    }

    return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
  },

  async confirmSecondFactor(credentials, input): Promise<VerificationOutcome> {
    // Confirming an enrolment is the same exchange as using the factor: the
    // staff member proves their authenticator produces the codes this factor
    // expects, and the session that comes back is at assurance level 2.
    return supabaseCommerceProvider.verifySecondFactor(credentials, input);
  },

  async signOut(credentials): Promise<void> {
    const supabase = await operatorCommerceClient(credentials);
    await supabase.auth.signOut();
  },

  async readPaidDeliverables(credentials): Promise<PaidDeliverable[]> {
    const supabase = await operatorCommerceClient(credentials);
    const rows = await call<DeliverableRow[]>(supabase, "commerce_paid_deliverables");

    return (rows ?? []).map((row) => ({
      sku: row.sku,
      activeVersionId: row.active_version_id,
      versions: (row.versions ?? []).map(toVersion),
    }));
  },

  async createPaidDeliverableVersion(credentials, upload): Promise<CreateVersionOutcome> {
    const supabase = await operatorCommerceClient(credentials);

    const existing = (await supabaseCommerceProvider.readPaidDeliverables(credentials))
      .find((deliverable) => deliverable.sku === upload.sku)
      ?.versions.find((version) => version.checksum === upload.checksum);
    if (existing) {
      return { status: "alreadyStored", version: existing };
    }

    const objectPath = deliverableObjectPath(
      upload.sku,
      upload.checksum,
      upload.fileName,
    );
    const { error } = await supabase.storage
      .from(DELIVERABLES_BUCKET)
      .upload(objectPath, upload.bytes, {
        contentType: upload.contentType,
        // Never write over what is stored. The address is the file's own
        // checksum, so anything already there is this same file — left from an
        // attempt that stored the bytes and then failed to record them, which
        // the row below finishes.
        upsert: false,
      });
    const duplicate = (error as { statusCode?: string } | null)?.statusCode === "409";
    if (error && !duplicate) {
      throw new Error(`commerce: storing the file failed — ${error.message}`);
    }

    const row = await call<VersionRow>(
      supabase,
      "commerce_create_paid_deliverable_version",
      {
        p_sku: upload.sku,
        p_object_path: objectPath,
        p_file_name: upload.fileName,
        p_content_type: upload.contentType,
        p_byte_size: upload.bytes.byteLength,
        p_checksum: upload.checksum,
      },
    );

    return { status: "created", version: toVersion(row) };
  },

  async activatePaidDeliverableVersion(credentials, { sku, versionId }): Promise<ActivationOutcome> {
    const supabase = await operatorCommerceClient(credentials);
    const row = await call<VersionRow | null>(
      supabase,
      "commerce_activate_paid_deliverable_version",
      { p_sku: sku, p_version_id: versionId },
    );

    return row ? { status: "activated", version: toVersion(row) } : { status: "refused" };
  },

  async readAuditTrail(credentials, limit): Promise<CommerceAuditEntry[]> {
    const supabase = await operatorCommerceClient(credentials);
    const rows = await call<AuditRow[]>(supabase, "commerce_audit_entries", {
      p_limit: limit,
    });

    return (rows ?? []).map(toAuditEntry);
  },

  async readActiveSkus(): Promise<string[]> {
    const skus = await call<string[]>(
      anonymousCommerceClient(),
      "commerce_active_paid_deliverable_skus",
    );
    return skus ?? [];
  },

  /*
   * The order functions carry no session, because a guest has none — and
   * neither has a payment provider posting a webhook. They are reached with the
   * anonymous key, which in this application is server-only: nothing Supabase is
   * compiled into a browser bundle. What each of them may do is bounded in
   * Postgres rather than here — see the migrations.
   */

  async createOrder(request): Promise<CreateOrderOutcome> {
    const answer = await call<
      | { status: "created"; order: OrderRow; attempt: AttemptRow }
      | { status: "refused"; skus_without_deliverable: string[] }
    >(anonymousCommerceClient(), "commerce_create_order", {
      p_reference: request.reference,
      p_lines: request.lines.map((line) => ({
        product_id: line.productId,
        sku: line.sku,
        title: line.title,
        unit_price_xof: line.unitPriceXof,
      })),
      p_buyer: {
        full_name: request.buyer.fullName,
        email: request.buyer.email,
        telephone: request.buyer.telephone,
        company: request.buyer.company ?? "",
      },
      p_legal: request.acceptedLegal.map((accepted) => ({
        kind: accepted.kind,
        revision_id: accepted.revisionId,
        effective_from: accepted.effectiveFrom,
      })),
      p_provider: request.provider,
    });

    return answer.status === "created"
      ? {
          status: "created",
          order: toOrder(answer.order),
          attempt: toAttempt(answer.attempt),
        }
      : {
          status: "refused",
          skusWithoutDeliverable: answer.skus_without_deliverable ?? [],
        };
  },

  async openPaymentAttempt(reference): Promise<OpenAttemptOutcome> {
    const answer = await call<{
      order: OrderRow;
      attempt: AttemptRow;
    } | null>(anonymousCommerceClient(), "commerce_open_payment_attempt", {
      p_reference: reference,
    });

    return answer
      ? {
          status: "opened",
          order: toOrder(answer.order),
          attempt: toAttempt(answer.attempt),
        }
      : { status: "refused" };
  },

  async settlePaymentAttempt(
    attemptId: string,
    outcome: PaymentAttemptOutcome,
  ): Promise<void> {
    await call<boolean>(
      anonymousCommerceClient(),
      "commerce_settle_payment_attempt",
      {
        p_attempt_id: attemptId,
        p_state: outcome.status,
        p_provider_transaction_id:
          outcome.status === "redirected" ? outcome.providerTransactionId : null,
        p_failure_reason: outcome.status === "failed" ? outcome.reason : null,
      },
    );
  },

  async recordPaymentEvent(event): Promise<PaymentEventRecord> {
    const answer = await call<{
      disposition: PaymentEventRecord["disposition"];
      payment_state: OrderSnapshot["paymentState"] | null;
    }>(anonymousCommerceClient(), "commerce_record_payment_event", {
      // Proved before Postgres reads a row. The anonymous key alone approves
      // nothing here — see `paymentEventSecret()`.
      p_secret: paymentEventSecret(),
      p_provider: event.provider,
      p_event_id: event.providerEventId,
      p_event_type: event.providerEventType,
      p_transaction_id: event.providerTransactionId,
      p_occurred_at: event.occurredAt,
      p_outcome: event.outcome,
    });

    return {
      disposition: answer.disposition,
      paymentState: answer.payment_state,
    };
  },

  async readOrder(reference: string): Promise<OrderSnapshot | undefined> {
    const row = await call<OrderRow | null>(
      anonymousCommerceClient(),
      "commerce_order",
      { p_reference: reference },
    );
    return row ? toOrder(row) : undefined;
  },

  async readOrderState(reference: string): Promise<OrderState | undefined> {
    const row = await call<{
      payment_state: OrderSnapshot["paymentState"];
      fulfillment_state: OrderSnapshot["fulfillmentState"];
    } | null>(anonymousCommerceClient(), "commerce_order_state", {
      p_reference: reference,
    });

    return row
      ? { payment: row.payment_state, fulfillment: row.fulfillment_state }
      : undefined;
  },
};
