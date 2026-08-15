import Link from "next/link";

import {
  FULFILLMENT_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATE_MARKS,
} from "@/commerce/orders";
import { ORDER_ANOMALY_LABELS } from "@/commerce/support";
import type { OrderSummary } from "@/commerce/types";
import { formatMoment, formatXof } from "@/lib/format";

import { CommercePanel } from "./commerce-form";

/**
 * Every order, newest first, and what an operator types to find one.
 *
 * A reference or an address, because those are the two things somebody has in
 * front of them when a buyer writes in or telephones. The search is a plain
 * `GET` form: the query is in the address, so a narrowed list can be kept open
 * in a tab, reloaded, and read with scripting disabled like the rest of this
 * back office.
 *
 * That does put whatever was typed — a buyer's address, when that is what was
 * typed — into one staff member's own history and into this deployment's
 * request log, which is the trade a `GET` search makes. It is taken knowingly:
 * the operator already has the address in front of them, `/commerce` is
 * `noindex` and disallowed to crawlers on every deployment, and the alternative
 * is a search that cannot be reloaded or linked. What the *rows* say is bounded
 * separately and tightly — a masked address and two states, with the contact
 * details a deliberate navigation away.
 *
 * Each row says both states rather than one combined word, and that is the rule
 * rather than the layout (ADR-0005): an approved payment whose delivery failed
 * is a row that has to read as *paid* and *not delivered* at once, because
 * treating it as one failure is how somebody asks a buyer to pay again.
 */
export function OrdersPanel({
  orders,
  search,
}: {
  orders: OrderSummary[];
  search: string;
}) {
  return (
    <CommercePanel
      title="Commandes"
      description="Cherchez par référence ou par adresse e-mail. Les états du paiement et de la livraison sont suivis séparément : une commande peut être payée et rester à livrer."
    >
      <form
        method="GET"
        action="/commerce/commandes"
        data-testid="order-search"
        className="flex flex-wrap items-end gap-4"
      >
        <label className="block grow sm:max-w-md">
          <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
            Référence ou e-mail
          </span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            className="mt-2 w-full border border-wc-border bg-wc-surface px-3 py-2 text-body text-wc-white"
          />
        </label>
        <button
          type="submit"
          className="cursor-pointer border border-wc-border px-5 py-2 text-micro uppercase tracking-24 text-wc-white"
        >
          Chercher
        </button>
      </form>

      {orders.length === 0 ? (
        <p
          data-testid="orders-empty"
          className="mt-6 mb-0 text-body-sm font-light text-wc-muted-2"
        >
          {search.trim().length > 0
            ? "Aucune commande ne correspond à cette recherche."
            : "Aucune commande enregistrée."}
        </p>
      ) : (
        <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
          {orders.map((order) => (
            <li
              key={order.reference}
              data-testid="order-row"
              data-reference={order.reference}
              data-payment={order.paymentState}
              data-fulfillment={order.fulfillmentState}
              data-outstanding={String(order.outstanding.length)}
              className="border border-wc-line-dark p-4"
            >
              <p className="m-0 text-body text-wc-white">
                <Link
                  href={`/commerce/commande?reference=${encodeURIComponent(order.reference)}`}
                  className="underline underline-offset-4"
                >
                  {order.reference}
                </Link>
              </p>
              <p className="m-0 mt-1 text-body-sm font-light text-wc-soft">
                {formatMoment(order.createdAt)} · {formatXof(order.totalXof)} ·{" "}
                {order.buyerEmailHint}
              </p>
              <p className="m-0 mt-2 text-body-sm font-light text-wc-soft">
                {/* The mark is decoration: it is hidden from assistive
                    technology and the word is beside it, because issue #1 rules
                    out telling two transaction states apart by an accent. */}
                <span aria-hidden="true">
                  {PAYMENT_STATE_MARKS[order.paymentState]}{" "}
                </span>
                <span data-testid="order-payment">
                  {PAYMENT_STATE_LABELS[order.paymentState]}
                </span>
                {" · "}
                <span data-testid="order-fulfillment">
                  {FULFILLMENT_STATE_LABELS[order.fulfillmentState]}
                </span>
              </p>
              {order.outstanding.length > 0 ? (
                <p
                  data-testid="order-outstanding"
                  className="m-0 mt-2 text-body-sm font-light text-wc-white"
                >
                  À traiter :{" "}
                  {order.outstanding
                    .map((kind) => ORDER_ANOMALY_LABELS[kind])
                    .join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </CommercePanel>
  );
}
