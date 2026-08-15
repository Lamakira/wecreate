import { reachBackOffice } from "@/commerce/back-office";
import { AccessRefused } from "@/components/commerce/access-refused";
import { CommerceNotice } from "@/components/commerce/commerce-form";
import { OperatorBar } from "@/components/commerce/operator-bar";
import { OrdersPanel } from "@/components/commerce/orders-panel";

/**
 * Enough orders to work from without becoming a page that has to be paged.
 *
 * The search is what narrows this rather than a page number: an operator is
 * looking for one order somebody has just quoted at them, and a list of every
 * order WeCreate has ever taken is not the answer to that.
 */
const ORDERS_SHOWN = 50;

interface OrdersRouteProps {
  searchParams: Promise<{ message?: string; q?: string }>;
}

/**
 * Where a Commerce Operator finds the order somebody has a problem with.
 *
 * The list says the two states and what is outstanding, and nothing else about
 * a buyer beyond a masked address: the contact details, the events and the
 * grants are one deliberate navigation away, on the order's own dossier. A list
 * that printed everything would put a hundred buyers' details on a screen
 * somebody leaves open (issue #15).
 */
export default async function OrdersPage({ searchParams }: OrdersRouteProps) {
  const { message, q = "" } = await searchParams;

  const entry = await reachBackOffice();
  if (entry.status === "refused") {
    return <AccessRefused refusal={entry.refusal} />;
  }

  const orders = await entry.provider.readOrders(entry.credentials, {
    search: q,
    limit: ORDERS_SHOWN,
  });

  return (
    <>
      <OperatorBar
        title="Commandes"
        operatorEmail={entry.operator.email}
        current="/commerce/commandes"
      />
      <CommerceNotice message={message} />
      <OrdersPanel orders={orders} search={q} />
    </>
  );
}
