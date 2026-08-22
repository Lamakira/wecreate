import {
  isWellFormedEmail,
  isWellFormedTelephone,
  normaliseTelephone,
} from "./contact";
import type {
  OrderAnomaly,
  OrderAnomalyKind,
  OrderSnapshot,
  PaymentAttemptState,
  PaymentEventEffect,
  PaymentState,
} from "./types";

/**
 * The rules a Commerce Operator's work carries with it.
 *
 * Pure functions over the records in `types.ts`, as `orders.ts` is for an order
 * and `order-access.ts` is for access: what an operator may still do to an
 * order, what they have to have written down before they may do it, and how
 * each of those is said in French. The pages print these rather than composing
 * their own sentence, the actions apply them before touching anything, and the
 * data plane applies them again — a form is not a security boundary and a
 * refusal that only exists in a component is a refusal a `curl` never meets.
 *
 * **What is not here is the point.** There is no rule for editing a payment
 * event, rewriting an Order Snapshot, moving a Payment State or replacing a
 * historical Paid Deliverable Version, because none of those is a thing the
 * back office can do (issue #15). A support surface is where somebody under
 * pressure will reach for whatever is in front of them, so what must not happen
 * is absent rather than guarded.
 */

/**
 * What one payment attempt did, in the back office's words.
 *
 * None of these is a Payment State and each says so: a buyer who reached a
 * hosted page has not paid, and only a verified event may say otherwise (issue
 * #11). The wording is deliberately about what *this application* did, because
 * that is all an attempt records.
 */
export const PAYMENT_ATTEMPT_LABELS: Record<PaymentAttemptState, string> = {
  pending: "Ouverte, sans réponse du fournisseur",
  redirected: "Page de paiement ouverte",
  failed: "Le fournisseur n'a pas pris la tentative",
};

/** What one recorded event was allowed to do when it arrived. */
export const PAYMENT_EVENT_EFFECT_LABELS: Record<PaymentEventEffect, string> = {
  applied: "A décidé l'état du paiement",
  unchanged: "N'a rien changé",
  superseded: "Arrivé après la décision, conservé pour réconciliation",
};

/** What each Order Anomaly is, to the person who has to settle it. */
export const ORDER_ANOMALY_LABELS: Record<OrderAnomalyKind, string> = {
  duplicate_payment: "Second paiement approuvé",
  contradictory_event: "Le fournisseur s'est contredit",
  fulfillment_failed: "Livraison non aboutie",
};

/** What it means, and what only a person can do about it. */
export const ORDER_ANOMALY_DESCRIPTIONS: Record<OrderAnomalyKind, string> = {
  duplicate_payment:
    "Une deuxième transaction a été approuvée pour cette commande. Rien n'a été livré deux fois et l'état du paiement n'a pas bougé. Le remboursement se décide et s'effectue chez le fournisseur de paiement : ce site n'en déclenche aucun.",
  contradictory_event:
    "Le fournisseur a dit une chose puis son contraire à propos d'une transaction. La vérité du paiement reste celle qui a été établie en premier ; l'événement suivant est conservé pour réconciliation.",
  fulfillment_failed:
    "Le paiement est approuvé et la livraison n'a pas abouti. Les accès existent déjà : reprenez la livraison, et écrivez à l'acheteuse ou l'acheteur si elle n'aboutit toujours pas.",
};

/**
 * Whether an operator may take this delivery up again.
 *
 * A payment that was approved and a delivery that failed, and nothing else. The
 * fulfillment boundary refuses the rest on its own — an order nobody paid for,
 * one already delivered, one another caller is delivering right now — so this
 * decides what is *offered* rather than what is permitted (ADR-0010). Offering
 * a control that will be refused is how a support surface teaches somebody to
 * press things twice.
 */
export function mayRetryDelivery(order: OrderSnapshot): boolean {
  return order.paymentState === "approved" && order.fulfillmentState === "failed";
}

/**
 * Whether this order's access may be replaced.
 *
 * There has to be some: an order whose payment was never approved has no Order
 * Access to reissue, and a token for one would be a credential to something
 * nobody has bought. A delivery that is running right now is left alone as
 * well — it is about to email a token of its own, and replacing that token
 * while the message is being written is how a buyer receives an address that
 * opens nothing.
 *
 * Like `mayRetryDelivery`, it decides what is *offered* rather than what is
 * permitted, which is why it has no twin in Postgres. What is permitted is
 * narrower and is decided where the row is: `commerce_reissue_order_access`
 * refuses an order with no access row at all and one whose delivery is running,
 * and the first of those is the only way an unapproved payment can reach it.
 */
export function mayReissueAccess(order: OrderSnapshot): boolean {
  return (
    order.paymentState === "approved" &&
    (order.fulfillmentState === "delivered" || order.fulfillmentState === "failed")
  );
}

/** The kinds still waiting for somebody, oldest first. */
export function outstandingKinds(
  anomalies: readonly OrderAnomaly[],
): OrderAnomalyKind[] {
  return anomalies
    .filter((anomaly) => anomaly.resolvedAt === null)
    .map((anomaly) => anomaly.kind);
}

/**
 * Whether this order is one somebody typing `query` meant.
 *
 * A reference or an address, matched anywhere in either, because the two things
 * an operator has in front of them are a reference read out over the telephone
 * and the address a message came from. A corrected address matches too: the
 * buyer writing in is writing from the address WeCreate now delivers to, and
 * one that only matched what they mistyped months ago would find nothing.
 *
 * `commerce_orders`' `where` is this function's twin — change one and change
 * the other. An empty query is not a filter: it is the whole list.
 */
export function matchesOrderSearch(
  order: {
    reference: string;
    buyerEmail: string;
    correctedEmail: string | null;
    /** A forgotten order is found by its reference, never by an address. */
    personalDataForgotten?: boolean;
  },
  query: string,
): boolean {
  const wanted = query.trim().toLowerCase();
  if (wanted.length === 0) return true;
  if (order.reference.toLowerCase().includes(wanted)) return true;
  if (order.personalDataForgotten) return false;

  return [order.buyerEmail, order.correctedEmail].some(
    (value) => (value ?? "").toLowerCase().includes(wanted),
  );
}

/**
 * The longest thing an operator may write down.
 *
 * The same bound Postgres puts on an anomaly's `detail`, and for the same
 * reason: a note is a sentence somebody will read in a hurry, and an audit
 * trail is not a place to paste a conversation into.
 */
export const MAX_SUPPORT_NOTE_LENGTH = 200;

/** Why a support action was refused before anything was touched. */
export type SupportRefusal =
  | "unknownOrder"
  | "reasonMissing"
  | "reasonTooLong"
  | "contactUnchanged"
  | "emailMalformed"
  | "telephoneMalformed"
  | "nothingToDeliver"
  | "deliveryInProgress"
  | "noAccessToReissue"
  | "unknownGrant"
  | "notAnUpgrade"
  | "unknownAnomaly"
  | "anomalyAlreadySettled";

/** French wording for each. Every one of them names what to do next. */
export const SUPPORT_REFUSAL_LABELS: Record<SupportRefusal, string> = {
  unknownOrder: "Aucune commande ne porte cette référence.",
  reasonMissing: "Indiquez le motif : il est enregistré au journal avec votre nom.",
  reasonTooLong: `Ce motif est trop long : ${MAX_SUPPORT_NOTE_LENGTH} caractères au maximum.`,
  contactUnchanged:
    "Rien n'a changé. Corrigez l'e-mail, le téléphone, ou les deux.",
  emailMalformed: "Indiquez une adresse e-mail valide.",
  telephoneMalformed:
    "Indiquez un téléphone au format international, par exemple +229 01 97 00 00 00.",
  nothingToDeliver:
    "Cette commande n'a pas de livraison à reprendre : elle n'est pas approuvée, ou sa livraison est déjà partie.",
  deliveryInProgress:
    "Une livraison est en cours pour cette commande. Attendez qu'elle aboutisse avant de renvoyer les accès.",
  noAccessToReissue:
    "Cette commande n'a pas encore d'accès à renvoyer. Reprenez d'abord la livraison.",
  unknownGrant: "Cette commande ne donne pas accès à ce produit.",
  notAnUpgrade:
    "Choisissez une version postérieure à celle du bon de commande. Une version antérieure ne s'accorde pas.",
  unknownAnomaly: "Cette anomalie n'existe pas pour cette commande.",
  anomalyAlreadySettled: "Cette anomalie a déjà été traitée.",
};

/** A motive an operator typed, tidied. */
export function normaliseReason(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Why this motive may not be recorded, or `undefined` if it may. */
export function reasonRefusal(reason: string): SupportRefusal | undefined {
  const written = normaliseReason(reason);
  if (written.length === 0) return "reasonMissing";
  if (written.length > MAX_SUPPORT_NOTE_LENGTH) return "reasonTooLong";
  return undefined;
}

/** What a Contact Correction form sent, before any of it is believed. */
export interface ContactCorrectionInput {
  email: string;
  telephone: string;
  reason: string;
}

/** What of it may be recorded, and why it may not. */
export interface ContactCorrectionSubmission {
  /** The corrected address, or `null` where this correction changes nothing. */
  email: string | null;
  telephone: string | null;
  reason: string;
  /** Why it may not be recorded, or `undefined` if it may. */
  refusal: SupportRefusal | undefined;
}

/**
 * Read a correction an operator typed, and say what is wrong with it.
 *
 * `readGuestDetails()`'s counterpart on the other side of the sale, and held to
 * exactly the same shapes (`contact.ts`): a correction that put an address in
 * the delivery path the checkout would have refused would be a value nothing
 * else in this application believes in.
 *
 * Either field may be left alone — a mistyped address and a number nobody
 * answers on are two different telephone calls — and a field that repeats what
 * is already being delivered to is not a correction at all. A form that changed
 * neither is refused rather than written down, because an audit entry recording
 * that somebody changed nothing is noise in the one trail that has to stay
 * readable.
 */
export function readContactCorrection(
  input: ContactCorrectionInput,
  current: { email: string; telephone: string },
): ContactCorrectionSubmission {
  const email = input.email.trim();
  const telephone = normaliseTelephone(input.telephone);
  const reason = normaliseReason(input.reason);
  const submission = (refusal: SupportRefusal | undefined) => ({
    email: email.length > 0 && email !== current.email ? email : null,
    telephone:
      telephone.length > 0 && telephone !== current.telephone ? telephone : null,
    reason,
    refusal,
  });

  if (email.length > 0 && !isWellFormedEmail(email)) {
    return submission("emailMalformed");
  }
  if (telephone.length > 0 && !isWellFormedTelephone(telephone)) {
    return submission("telephoneMalformed");
  }

  const changed = submission(undefined);
  if (!changed.email && !changed.telephone) {
    return submission("contactUnchanged");
  }
  return submission(reasonRefusal(input.reason));
}

/**
 * What the back office says about what can still happen to a payment.
 *
 * It never offers to retry one, on any order, and there is no wording here for
 * doing so: a payment is the buyer's to make, on their own Order Snapshot, from
 * their own order page (issue #13). What an operator needs is the sentence they
 * can read down the telephone — and for an approved order, that nothing more
 * will be collected.
 */
export const PAYMENT_PROSPECT_LABELS = {
  awaiting:
    "Un paiement est en cours. Il n'y a rien à faire tant que le fournisseur n'a pas répondu.",
  resumable:
    "Aucune page de paiement n'a été ouverte. L'acheteuse ou l'acheteur peut reprendre depuis son panier.",
  retryable:
    "L'acheteuse ou l'acheteur peut payer de nouveau ce même bon de commande, depuis sa page de commande, pendant 24 h après sa création.",
  closed: "Rien de plus ne sera encaissé pour cette commande.",
} as const;

/**
 * What the back office leads with, in one sentence.
 *
 * The two states are tracked separately and are shown separately (ADR-0005),
 * and this is the sentence that keeps an operator from reading one as the
 * other: an approved payment whose delivery failed is WeCreate's problem and
 * not the buyer's, and the surface says so in words before it offers a control.
 */
export function orderStanding(order: OrderSnapshot): string {
  if (order.paymentState === "approved" && order.fulfillmentState === "failed") {
    return "Paiement approuvé, livraison à reprendre. L'argent est encaissé : ne demandez pas un second paiement.";
  }
  if (order.paymentState === "approved") {
    return "Paiement approuvé.";
  }
  return NOT_APPROVED_STANDING[order.paymentState];
}

const NOT_APPROVED_STANDING: Record<Exclude<PaymentState, "approved">, string> = {
  pending: "Paiement en attente d'un événement vérifié du fournisseur.",
  failed: "Paiement non abouti : rien n'a été encaissé.",
  cancelled: "Paiement annulé : rien n'a été encaissé.",
};
