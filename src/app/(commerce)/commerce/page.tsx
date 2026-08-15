import Link from "next/link";

import { reachBackOffice } from "@/commerce/back-office";
import { AccessRefused } from "@/components/commerce/access-refused";
import { AuditTrail } from "@/components/commerce/audit-trail";
import { CommerceNotice } from "@/components/commerce/commerce-form";
import {
  DeliverablesPanel,
  type DeliverableView,
} from "@/components/commerce/deliverables-panel";
import { OperatorBar } from "@/components/commerce/operator-bar";
import { readBoutique } from "@/managed-content";

/** Enough history to answer a support question without becoming a page of its own. */
const AUDIT_ENTRIES_SHOWN = 50;

interface CommerceRouteProps {
  searchParams: Promise<{ message?: string }>;
}

/**
 * The Commerce Operator's surface: the file behind every Digital Product, and
 * what WeCreate's staff have done to them.
 *
 * This is one half of a decision the Boutique makes with two. WeCreate's intent
 * to sell a product is editorial and lives in the Studio; the file a buyer
 * receives is private and lives here, and a product is only *disponible* when
 * both agree. Neither surface can make an incomplete product purchasable on its
 * own, which is the whole point of separating them (issue #1).
 *
 * The catalogue comes from Managed Content so an operator sees WeCreate's own
 * product names rather than a list of SKUs — and sees which products still have
 * no file at all, which is the question this page exists to answer.
 */
export default async function CommercePage({ searchParams }: CommerceRouteProps) {
  const { message } = await searchParams;

  const entry = await reachBackOffice();
  if (entry.status === "refused") {
    return <AccessRefused refusal={entry.refusal} />;
  }
  const { operator, provider, credentials } = entry;

  const [deliverables, boutique, audit] = await Promise.all([
    provider.readPaidDeliverables(credentials),
    readBoutique(),
    provider.readAuditTrail(credentials, AUDIT_ENTRIES_SHOWN),
  ]);

  const stored = new Map(deliverables.map((one) => [one.sku, one]));
  const catalogue: DeliverableView[] = boutique.products.map((product) => ({
    sku: product.sku,
    title: product.title,
    versions: stored.get(product.sku)?.versions ?? [],
    activeVersionId: stored.get(product.sku)?.activeVersionId ?? null,
  }));
  // A file whose product has been archived or renamed out of the catalogue is
  // still WeCreate's, and still owed to whoever bought it. It keeps its place
  // here under its SKU rather than disappearing from the one page that knows
  // it exists.
  const unlisted: DeliverableView[] = deliverables
    .filter((one) => !boutique.products.some((product) => product.sku === one.sku))
    .map((one) => ({ ...one, title: one.sku }));

  return (
    <>
      <OperatorBar title="Fichiers livrés" operatorEmail={operator.email} />
      <CommerceNotice message={message} />

      <DeliverablesPanel deliverables={[...catalogue, ...unlisted]} />

      <div className="mt-6">
        <AuditTrail entries={audit} />
      </div>

      <p className="mt-8 mb-0 text-body font-light">
        <Link href="/commerce/securite" className="underline underline-offset-4">
          Vos applications d&apos;authentification
        </Link>
      </p>
    </>
  );
}
