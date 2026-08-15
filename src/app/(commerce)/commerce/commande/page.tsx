import Link from "next/link";
import { notFound } from "next/navigation";

import { reachBackOffice } from "@/commerce/back-office";
import { AccessRefused } from "@/components/commerce/access-refused";
import { AuditTrail } from "@/components/commerce/audit-trail";
import { CommerceNotice } from "@/components/commerce/commerce-form";
import { OperatorBar } from "@/components/commerce/operator-bar";
import { OrderDossierView } from "@/components/commerce/order-dossier";

/**
 * Never prefetched.
 *
 * A dossier is one buyer's contact details, their events and their grants, read
 * under a staff identity — so prefetching one would be reading a buyer's file
 * because a pointer passed over their reference in a list, fifty times on the
 * way down the page.
 */
export const prefetch = "force-disabled";

interface DossierRouteProps {
  searchParams: Promise<{ reference?: string; message?: string }>;
}

/**
 * One order's dossier: everything WeCreate knows about it, and the five things
 * a Commerce Operator may do about it.
 *
 * The one page in this application that shows a buyer's contact details in
 * full, and it is bounded the way the rest of the back office is — an
 * individual staff account, at assurance level 2, with the Commerce Operator
 * role — rather than by holding the order's reference. Postgres asks the same
 * question again before it returns a row.
 *
 * The order is named in the query rather than in the path, which is what every
 * other page of this back office does with what it is about. It is not a
 * cosmetic choice: a route with a dynamic segment is prerendered as a shell
 * under Cache Components, and a shell is what the redirect after a support
 * action lands in — the operator would be returned to a page that says nothing
 * about what they just did. `src/proxy.ts` describes the same shell from the
 * other side.
 *
 * An order nobody here has is a 404 rather than an empty page, so a mistyped
 * reference reads as a mistyped reference.
 */
export default async function OrderDossierPage({
  searchParams,
}: DossierRouteProps) {
  const { reference, message } = await searchParams;

  const entry = await reachBackOffice();
  if (entry.status === "refused") {
    return <AccessRefused refusal={entry.refusal} />;
  }

  const dossier = reference
    ? await entry.provider.readOrderDossier(entry.credentials, reference)
    : undefined;
  if (!dossier) {
    notFound();
  }

  // Every version of every product this order bought, so an upgrade can be
  // offered from what WeCreate actually holds. Read here rather than inside the
  // dossier, because which files exist is a question about the catalogue and
  // not about this order.
  const deliverables = await entry.provider.readPaidDeliverables(
    entry.credentials,
  );
  const bought = new Set(dossier.order.lines.map((line) => line.sku));
  const versions = deliverables
    .filter((deliverable) => bought.has(deliverable.sku))
    .flatMap((deliverable) => deliverable.versions);

  return (
    <>
      <OperatorBar
        title={dossier.order.reference}
        operatorEmail={entry.operator.email}
        current="/commerce/commandes"
      />
      <CommerceNotice message={message} />

      <OrderDossierView dossier={dossier} versions={versions} />

      <div className="mt-6">
        <AuditTrail
          entries={dossier.audit}
          title="Journal de cette commande"
          description="Chaque geste de support sur cette commande, avec la personne qui l'a fait. Le journal ne peut être ni modifié ni effacé."
          empty="Aucune opération de support sur cette commande."
        />
      </div>

      <p className="mt-8 mb-0 text-body font-light">
        <Link href="/commerce/commandes" className="underline underline-offset-4">
          Retour aux commandes
        </Link>
      </p>
    </>
  );
}
