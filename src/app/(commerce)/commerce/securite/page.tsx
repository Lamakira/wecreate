import Link from "next/link";
import { redirect } from "next/navigation";

import { mayEnrolSecondFactor } from "@/commerce/operators";
import { readPendingEnrolment, readSignedInOperator } from "@/commerce/session";
import { CommerceNotice } from "@/components/commerce/commerce-form";
import { FactorsPanel } from "@/components/commerce/factors-panel";

interface SecuriteRouteProps {
  searchParams: Promise<{ message?: string }>;
}

/**
 * Where a staff member sets up the authenticators their account is protected
 * by.
 *
 * Reachable one step earlier than the rest of the back office, and only for
 * this: a new member of staff has a password and nothing else, and needs
 * somewhere to enrol their first factor before they can reach assurance level
 * 2. Everything else stays behind that level, including this page's own
 * "add another" form once a first factor exists.
 */
export default async function CommerceSecurityPage({
  searchParams,
}: SecuriteRouteProps) {
  const { message } = await searchParams;

  const operator = await readSignedInOperator();
  if (!operator) {
    redirect("/commerce/connexion");
  }

  return (
    <>
      <h1 className="mt-0 mb-8 text-section font-light">Authentification</h1>
      <CommerceNotice message={message} />

      <FactorsPanel
        operator={operator}
        pending={await readPendingEnrolment()}
        mayEnrol={mayEnrolSecondFactor(operator)}
      />

      <p className="mt-8 mb-0 text-body font-light">
        <Link
          href={operator.assurance === "aal2" ? "/commerce" : "/commerce/connexion"}
          className="underline underline-offset-4"
        >
          {operator.assurance === "aal2"
            ? "Retour aux fichiers livrés"
            : "Saisir un code de vérification"}
        </Link>
      </p>
    </>
  );
}
