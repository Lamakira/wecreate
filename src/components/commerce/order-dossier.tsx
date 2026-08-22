import { isAccessLive } from "@/commerce/order-access";
import {
  FULFILLMENT_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATE_MARKS,
  paymentProspect,
} from "@/commerce/orders";
import {
  MAX_SUPPORT_NOTE_LENGTH,
  ORDER_ANOMALY_DESCRIPTIONS,
  ORDER_ANOMALY_LABELS,
  PAYMENT_ATTEMPT_LABELS,
  PAYMENT_EVENT_EFFECT_LABELS,
  PAYMENT_PROSPECT_LABELS,
  mayReissueAccess,
  mayRetryDelivery,
  orderStanding,
} from "@/commerce/support";
import type {
  OrderAccessGrant,
  OrderAnomaly,
  OrderDossier,
  PaidDeliverableVersion,
} from "@/commerce/types";
import { formatMoment, formatXof } from "@/lib/format";

import { CommerceButton } from "./commerce-button";
import { CommercePanel } from "./commerce-form";

/**
 * Where every gesture on this page is posted.
 *
 * One route rather than five Server Functions, and the form says which gesture
 * it is in a field of its own. `commerce/commande/operation/route.ts` explains
 * why the back office posts to a route here: the answer to each of these is an
 * address carrying a French sentence, and a browser performing the redirect
 * itself is what keeps that sentence.
 */
const SUPPORT_ENDPOINT = "/commerce/commande/operation";

/**
 * Everything WeCreate knows about one order, and the five things a Commerce
 * Operator may do about it.
 *
 * The shape of this page is the argument it makes. What was recorded is shown
 * as a record — the Order Snapshot, the attempts, the events, what the buyer
 * typed — with no control anywhere near it, because none of those can be
 * changed by anybody (issue #15). What can be done is a form, each one asking
 * for a motive, because every one of them is written into an append-only trail
 * under the name of the individual doing it.
 *
 * **The two states are never merged.** An approved payment whose delivery
 * failed reads as approved *and* to be delivered again, and the only control
 * offered for it takes up the delivery. There is no *retry payment* on this
 * page for any order, and least of all for that one: a payment is the buyer's
 * to make, from their own order page (ADR-0005, issue #13).
 *
 * **Every form here carries `noValidate`**, exactly as the guest form does on
 * the buyer's side: the browser checks nothing, every submission reaches the
 * server, and every refusal an operator reads is `support.ts`'s own — which is
 * also what holds a submission that never rendered this page to the same rules.
 */
export function OrderDossierView({
  dossier,
  versions,
}: {
  dossier: OrderDossier;
  /** Every Paid Deliverable Version of the SKUs this order bought. */
  versions: PaidDeliverableVersion[];
}) {
  const { order, buyer, correction, anomalies, events } = dossier;

  return (
    <div className="flex flex-col gap-6">
      <CommercePanel
        title="Paiement et livraison"
        description="Les deux sont suivis séparément. Un paiement approuvé le reste, quoi qu'il arrive à la livraison."
      >
        <p
          data-testid="order-standing"
          className="m-0 text-body font-light text-wc-white"
        >
          {orderStanding(order)}
        </p>
        <p className="m-0 mt-4 text-body-sm font-light text-wc-soft">
          <span aria-hidden="true">
            {PAYMENT_STATE_MARKS[order.paymentState]}{" "}
          </span>
          <span data-testid="dossier-payment" data-state={order.paymentState}>
            {PAYMENT_STATE_LABELS[order.paymentState]}
          </span>
          {" · "}
          <span
            data-testid="dossier-fulfillment"
            data-state={order.fulfillmentState}
          >
            {FULFILLMENT_STATE_LABELS[order.fulfillmentState]}
          </span>
        </p>
        <p
          data-testid="dossier-prospect"
          className="m-0 mt-2 text-body-sm font-light text-wc-muted-2"
        >
          {PAYMENT_PROSPECT_LABELS[paymentProspect(order)]}
        </p>

        {mayRetryDelivery(order) ? (
          <form
            method="POST"
            action={SUPPORT_ENDPOINT}
            data-testid="retry-delivery"
            className="mt-5"
          >
            <input type="hidden" name="operation" value="retry-delivery" />
            <input type="hidden" name="reference" value={order.reference} />
            <CommerceButton pendingLabel="Reprise…">
              Reprendre la livraison
            </CommerceButton>
          </form>
        ) : null}
      </CommercePanel>

      <CommercePanel
        title="Bon de commande"
        description="Ce que l'acheteuse ou l'acheteur a acheté, aux prix et aux versions du jour de la commande. Rien ici ne peut être modifié, ni depuis cet écran ni ailleurs."
      >
        <ul
          data-testid="dossier-lines"
          className="m-0 flex list-none flex-col gap-3 p-0"
        >
          {order.lines.map((line) => (
            <li
              key={line.sku}
              data-testid="dossier-line"
              data-sku={line.sku}
              className="border border-wc-line-dark p-4 text-body-sm font-light text-wc-soft"
            >
              <p className="m-0 text-body text-wc-white">{line.title}</p>
              <p className="m-0 mt-1">
                {line.sku} · {formatXof(line.unitPriceXof)} ·{" "}
                <span data-testid="line-version">
                  version {line.paidDeliverableVersion} achetée
                </span>
              </p>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-4 text-body font-light text-wc-white">
          Total : <span data-testid="dossier-total">{formatXof(order.totalXof)}</span>
        </p>
        <p className="m-0 mt-1 text-body-sm font-light text-wc-muted-2">
          Commande passée le {formatMoment(order.createdAt)}.
        </p>
        {order.acceptedLegal.length > 0 ? (
          <p
            data-testid="dossier-legal"
            className="m-0 mt-2 text-body-sm font-light text-wc-muted-2"
          >
            Conditions acceptées :{" "}
            {order.acceptedLegal
              .map((accepted) => `${accepted.kind} (${accepted.effectiveFrom})`)
              .join(", ")}
            .
          </p>
        ) : null}
      </CommercePanel>

        <BuyerPanel
          reference={order.reference}
          buyer={buyer}
          correction={correction}
          deliverTo={dossier.deliverTo}
          access={dossier.access}
          forgotten={dossier.personalDataForgotten}
        />

      <AccessPanel dossier={dossier} versions={versions} />

      <CommercePanel
        title="Tentatives et événements"
        description="Ce que WeCreate a tenté, et ce que le fournisseur de paiement a répondu. Le journal des événements est conservé tel qu'il est arrivé : il ne peut être ni modifié ni effacé."
      >
        <ul
          data-testid="dossier-attempts"
          className="m-0 flex list-none flex-col gap-3 p-0"
        >
          {order.attempts.map((attempt) => (
            <li
              key={attempt.id}
              data-testid="dossier-attempt"
              data-state={attempt.state}
              className="border border-wc-line-dark p-4 text-body-sm font-light text-wc-soft"
            >
              <p className="m-0 text-body text-wc-white">
                {PAYMENT_ATTEMPT_LABELS[attempt.state]}
              </p>
              <p className="m-0 mt-1">
                {formatMoment(attempt.createdAt)} · {attempt.provider}
                {attempt.providerTransactionId
                  ? ` · transaction ${attempt.providerTransactionId}`
                  : ""}
              </p>
              <p className="m-0 mt-1 text-wc-muted-2">
                {attempt.outcome
                  ? `Verdict : ${PAYMENT_STATE_LABELS[attempt.outcome]}.`
                  : "Aucun verdict enregistré pour cette transaction."}
                {attempt.failureReason ? ` ${attempt.failureReason}.` : ""}
              </p>
            </li>
          ))}
        </ul>

        <ul
          data-testid="dossier-events"
          className="m-0 mt-5 flex list-none flex-col gap-3 p-0"
        >
          {events.map((event) => (
            <li
              key={event.id}
              data-testid="dossier-event"
              data-effect={event.effect}
              data-outcome={event.outcome}
              className="border border-wc-line-dark p-4 text-body-sm font-light text-wc-soft"
            >
              <p className="m-0 text-body text-wc-white">
                {event.providerEventType} · {PAYMENT_STATE_LABELS[event.outcome]}
              </p>
              <p className="m-0 mt-1">
                Reçu le {formatMoment(event.receivedAt)} · {event.provider} ·
                transaction {event.providerTransactionId} · événement{" "}
                {event.providerEventId}
              </p>
              <p className="m-0 mt-1 text-wc-muted-2">
                {PAYMENT_EVENT_EFFECT_LABELS[event.effect]}.
              </p>
            </li>
          ))}
        </ul>
        {events.length === 0 ? (
          <p className="m-0 mt-5 text-body-sm font-light text-wc-muted-2">
            Aucun événement vérifié pour cette commande.
          </p>
        ) : null}
      </CommercePanel>

      <AnomaliesPanel reference={order.reference} anomalies={anomalies} />
    </div>
  );
}

/**
 * Where the order is going, and the one thing about a buyer an operator may
 * change.
 *
 * What they wrote is printed as a record and cannot be edited: the Order
 * Snapshot keeps it, and a correction is the separate fact underneath it. Both
 * are shown at once, because the question somebody has on the telephone is
 * exactly "what did I type, and where is it going now".
 *
 * **What WeCreate has written, and when**, is the third line here, and it is
 * everything this application knows about that: an order with access has had a
 * receipt addressed to it, and the moment that access was issued is the moment
 * the message carrying it went out (`OrderAccess.issuedAt`). Nothing keeps a
 * copy of a message — a table of what was sent to whom would be a second,
 * unbounded copy of buyers' contact details, which is what issue #1 refuses —
 * so what an operator is shown is the intent and its moment rather than a log.
 */
function BuyerPanel({
  reference,
  buyer,
  correction,
  deliverTo,
  access,
  forgotten,
}: {
  reference: string;
  buyer: OrderDossier["buyer"];
  correction: OrderDossier["correction"];
  deliverTo: string;
  access: OrderDossier["access"];
  forgotten: boolean;
}) {
  const sent = access
    ? `Dernier envoi : le reçu et les accès, adressés le ${formatMoment(access.issuedAt)}.`
    : "Aucun message n'est encore parti pour cette commande.";

  return (
    <CommercePanel
      title="Acheteur"
      description="Ce que l'acheteuse ou l'acheteur a écrit reste tel quel sur le bon de commande. Une correction s'ajoute à côté, avec son motif et le nom de qui l'a faite."
    >
      {forgotten ? (
        <p
          data-testid="buyer-forgotten"
          className="m-0 text-body font-light text-wc-white"
        >
          Ces coordonnées ont été oubliées à l'issue de la période de
          conservation.
        </p>
      ) : (
        <>
          <dl
            data-testid="dossier-buyer"
            className="m-0 grid grid-cols-1 gap-2 text-body-sm font-light text-wc-soft sm:grid-cols-[10rem_1fr]"
          >
            <dt className="text-wc-muted-2">Nom</dt>
            <dd className="m-0" data-testid="buyer-name">
              {buyer.fullName}
            </dd>
            <dt className="text-wc-muted-2">E-mail saisi</dt>
            <dd className="m-0" data-testid="buyer-email">
              {buyer.email}
            </dd>
            <dt className="text-wc-muted-2">Téléphone saisi</dt>
            <dd className="m-0" data-testid="buyer-telephone">
              {buyer.telephone}
            </dd>
            {buyer.company ? (
              <>
                <dt className="text-wc-muted-2">Entreprise</dt>
                <dd className="m-0">{buyer.company}</dd>
              </>
            ) : null}
          </dl>

          <p
            data-testid="deliver-to"
            className="m-0 mt-4 text-body font-light text-wc-white"
          >
            Les envois partent vers {deliverTo}.
          </p>
        </>
      )}
      <p
        data-testid="email-intent"
        className="m-0 mt-2 text-body-sm font-light text-wc-soft"
      >
        {sent}
      </p>

      {correction ? (
        <p
          data-testid="contact-correction"
          className="m-0 mt-2 text-body-sm font-light text-wc-soft"
        >
          Corrigé le {formatMoment(correction.correctedAt)} par{" "}
          {correction.correctedByEmail}
          {correction.email ? ` · e-mail ${correction.email}` : ""}
          {correction.telephone ? ` · téléphone ${correction.telephone}` : ""} ·
          motif : « {correction.reason} »
        </p>
      ) : null}

      {forgotten ? null : (
        <form
          method="POST"
          action={SUPPORT_ENDPOINT}
          noValidate
          data-testid="correct-contact"
          className="mt-5 flex flex-col gap-4 sm:max-w-lg"
        >
          <input type="hidden" name="operation" value="correct-contact" />
          <input type="hidden" name="reference" value={reference} />
          <SupportField
            label="E-mail corrigé"
            name="email"
            type="email"
            hint="Laissez vide pour ne pas y toucher."
          />
          <SupportField
            label="Téléphone corrigé"
            name="telephone"
            type="text"
            hint="Format international, par exemple +229 01 97 00 00 00. Laissez vide pour ne pas y toucher."
          />
          <SupportField label="Motif de la correction" name="reason" type="text" />
          <div>
            <CommerceButton pendingLabel="Enregistrement…">
              Enregistrer la correction
            </CommerceButton>
          </div>
        </form>
      )}
    </CommercePanel>
  );
}

/**
 * What the buyer may open, and the two things an operator may do about it.
 *
 * Replacing the address that opens the order, and granting a later version of
 * one product than the order bought. Neither touches the Order Snapshot, and
 * the rows say so out loud: a grant shows the version that was paid for beside
 * the version it opens, so an upgrade is visible as an addition rather than as
 * a rewrite.
 */
function AccessPanel({
  dossier,
  versions,
}: {
  dossier: OrderDossier;
  versions: PaidDeliverableVersion[];
}) {
  const { order, access } = dossier;

  return (
    <CommercePanel
      title="Accès"
      description="Les téléchargements restants appartiennent à l'acheteuse ou l'acheteur : renvoyer les accès remplace l'adresse, jamais ce qu'elle ouvre ni ce qu'il en reste."
    >
      {access ? (
        <>
          <p
            data-testid="access-issued"
            className="m-0 text-body-sm font-light text-wc-soft"
          >
            Accès émis le {formatMoment(access.issuedAt)} · expire le{" "}
            <span data-testid="access-expiry">
              {formatMoment(access.expiresAt)}
            </span>
            {isAccessLive(access) ? "" : " (expirés)"}
          </p>

          <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
            {access.grants.map((grant) => (
              <GrantRow
                key={grant.sku}
                reference={order.reference}
                grant={grant}
                versions={versions.filter((one) => one.sku === grant.sku)}
              />
            ))}
          </ul>

          {mayReissueAccess(order) ? (
            <form
              method="POST"
              action={SUPPORT_ENDPOINT}
              noValidate
              data-testid="reissue-access"
              className="mt-5 flex flex-col gap-4 sm:max-w-lg"
            >
              <input type="hidden" name="operation" value="reissue-access" />
              <input type="hidden" name="reference" value={order.reference} />
              <SupportField
                label="Motif du renvoi"
                name="reason"
                type="text"
                hint="Enregistré au journal avec votre nom et l'heure."
              />
              <div>
                <CommerceButton pendingLabel="Envoi…">
                  Renvoyer les accès
                </CommerceButton>
              </div>
            </form>
          ) : null}
        </>
      ) : (
        <p
          data-testid="access-absent"
          className="m-0 text-body-sm font-light text-wc-muted-2"
        >
          Aucun accès n&apos;a encore été accordé pour cette commande.
        </p>
      )}
    </CommercePanel>
  );
}

/** One purchased product: what was bought, what it opens, and what is left. */
function GrantRow({
  reference,
  grant,
  versions,
}: {
  reference: string;
  grant: OrderAccessGrant;
  versions: PaidDeliverableVersion[];
}) {
  // Only later ones. Taking a version away from somebody is not an upgrade, and
  // offering it here would be offering something the data plane refuses.
  const offerable = versions
    .filter((one) => one.version > grant.deliveredVersion)
    .sort((a, b) => a.version - b.version);

  return (
    <li
      data-testid="dossier-grant"
      data-sku={grant.sku}
      data-delivered-version={String(grant.deliveredVersion)}
      className="border border-wc-line-dark p-4 text-body-sm font-light text-wc-soft"
    >
      <p className="m-0 text-body text-wc-white">{grant.title}</p>
      <p className="m-0 mt-1">
        {grant.sku} ·{" "}
        <span data-testid="grant-versions">
          version {grant.paidDeliverableVersion} achetée
          {grant.deliveredVersion === grant.paidDeliverableVersion
            ? ""
            : `, version ${grant.deliveredVersion} accordée`}
        </span>
      </p>
      <p className="m-0 mt-1 text-wc-muted-2" data-testid="grant-allowance">
        {grant.downloadsRemaining} téléchargement
        {grant.downloadsRemaining > 1 ? "s" : ""} sur {grant.downloadsAllowed}{" "}
        restant{grant.downloadsRemaining > 1 ? "s" : ""}
      </p>

      {offerable.length > 0 ? (
        <form
          method="POST"
          action={SUPPORT_ENDPOINT}
          noValidate
          data-testid="upgrade-grant"
          className="mt-4 flex flex-col gap-4 sm:max-w-md"
        >
          <input type="hidden" name="operation" value="upgrade-grant" />
          <input type="hidden" name="reference" value={reference} />
          <input type="hidden" name="sku" value={grant.sku} />
          <label className="block">
            <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
              Version à accorder
            </span>
            <select
              name="versionId"
              required
              defaultValue=""
              className="mt-2 w-full border border-wc-border bg-wc-surface px-3 py-2 text-body text-wc-white"
            >
              <option value="" disabled>
                Choisir une version
              </option>
              {offerable.map((version) => (
                <option key={version.id} value={version.id}>
                  Version {version.version} - {version.fileName}
                </option>
              ))}
            </select>
          </label>
          <SupportField
            label="Motif de la version accordée"
            name="reason"
            type="text"
          />
          <div>
            <CommerceButton secondary pendingLabel="Enregistrement…">
              Accorder cette version
            </CommerceButton>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/**
 * What no automatic rule could settle, and what a person decided about it.
 *
 * The note is the whole of what this application does about a duplicate or an
 * unusual payment, and the panel says so: no refund is issued from here, and
 * there is no control that could issue one. Money is returned in the payment
 * provider's own dashboard, by somebody who chose to (issue #15).
 */
function AnomaliesPanel({
  reference,
  anomalies,
}: {
  reference: string;
  anomalies: OrderAnomaly[];
}) {
  const outstanding = anomalies.filter((one) => one.resolvedAt === null);

  return (
    <CommercePanel
      title="Anomalies et réconciliation"
      description="Ce qu'aucune règle automatique n'a pu trancher. Aucun remboursement n'est déclenché ici : il se décide et s'effectue chez le fournisseur de paiement."
      testId="dossier-anomalies"
    >
      {anomalies.length === 0 ? (
        <p
          data-testid="anomalies-empty"
          className="m-0 text-body-sm font-light text-wc-muted-2"
        >
          Aucune anomalie sur cette commande.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {anomalies.map((anomaly) => (
            <li
              key={anomaly.id}
              data-testid="dossier-anomaly"
              data-kind={anomaly.kind}
              data-settled={String(anomaly.resolvedAt !== null)}
              className="border border-wc-line-dark p-4 text-body-sm font-light text-wc-soft"
            >
              <p className="m-0 text-body text-wc-white">
                {ORDER_ANOMALY_LABELS[anomaly.kind]}
              </p>
              <p className="m-0 mt-1">
                Détectée le {formatMoment(anomaly.detectedAt)}
                {anomaly.providerTransactionId
                  ? ` · transaction ${anomaly.providerTransactionId}`
                  : ""}
                {anomaly.providerEventId
                  ? ` · événement ${anomaly.providerEventId}`
                  : ""}
              </p>
              <p className="m-0 mt-2 text-wc-muted-2">
                {ORDER_ANOMALY_DESCRIPTIONS[anomaly.kind]}
              </p>
              {anomaly.resolvedAt ? (
                <p
                  data-testid="anomaly-resolution"
                  className="m-0 mt-2 text-wc-white"
                >
                  Traitée le {formatMoment(anomaly.resolvedAt)} par{" "}
                  {anomaly.resolvedByEmail} : « {anomaly.resolution} »
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        method="POST"
        action={SUPPORT_ENDPOINT}
        noValidate
        data-testid="annotate-order"
        className="mt-5 flex flex-col gap-4 sm:max-w-lg"
      >
        <input type="hidden" name="operation" value="annotate-order" />
        <input type="hidden" name="reference" value={reference} />
        {outstanding.length > 0 ? (
          <label className="block">
            <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
              Anomalie traitée
            </span>
            <select
              name="anomalyId"
              defaultValue=""
              className="mt-2 w-full border border-wc-border bg-wc-surface px-3 py-2 text-body text-wc-white"
            >
              <option value="">Aucune : note seule</option>
              {outstanding.map((anomaly) => (
                <option key={anomaly.id} value={anomaly.id}>
                  {ORDER_ANOMALY_LABELS[anomaly.kind]} -{" "}
                  {formatMoment(anomaly.detectedAt)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <SupportField
          label="Note de réconciliation"
          name="note"
          type="text"
          hint={`${MAX_SUPPORT_NOTE_LENGTH} caractères au maximum. Enregistrée au journal avec votre nom.`}
        />
        <div>
          <CommerceButton pendingLabel="Enregistrement…">
            Enregistrer la note
          </CommerceButton>
        </div>
      </form>
    </CommercePanel>
  );
}

/**
 * One field of a support form.
 *
 * The same furniture as `CommerceField`, without its `required` attribute doing
 * the deciding: every rule about what may be written here is applied on the
 * server, in `support.ts`, because a form is not a security boundary and a
 * submission that never rendered a page is held to exactly the same rules.
 */
function SupportField({
  label,
  name,
  type,
  hint,
}: {
  label: string;
  name: string;
  type: "text" | "email";
  hint?: string;
}) {
  const hintId = `${name}-${label}-hint`.replace(/\s+/g, "-").toLowerCase();

  return (
    <div>
      <label className="block">
        <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
          {label}
        </span>
        <input
          type={type}
          name={name}
          aria-describedby={hint ? hintId : undefined}
          className="mt-2 w-full border border-wc-border bg-wc-surface px-3 py-2 text-body text-wc-white"
        />
      </label>
      {hint ? (
        <p
          id={hintId}
          className="mt-2 mb-0 text-body-sm font-light text-wc-muted-2"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
