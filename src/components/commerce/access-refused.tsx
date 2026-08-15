import { signOutAction } from "@/commerce/actions";
import { ACCESS_REFUSAL_LABELS, type AccessRefusal } from "@/commerce/operators";

import { CommerceButton } from "./commerce-button";
import { CommercePanel } from "./commerce-form";

/**
 * A staff member who is fully authenticated and still may not be here.
 *
 * Content Editor and Commerce Operator are separate permissions, even when the
 * same person holds both (issue #1). Nothing about the commerce data is
 * rendered beside this — not a file, not a count, not a SKU, not an order —
 * because a refusal that leaked what it was refusing would be no refusal at
 * all.
 */
export function AccessRefused({ refusal }: { refusal: AccessRefusal }) {
  return (
    <>
      <h1 className="mt-0 mb-8 text-section font-light">Espace commerce</h1>
      <CommercePanel title="Accès refusé">
        <p data-testid="commerce-refusal" className="m-0 text-body font-light">
          {ACCESS_REFUSAL_LABELS[refusal]}
        </p>
        <form action={signOutAction} className="mt-5">
          <CommerceButton secondary pendingLabel="Déconnexion…">
            Se déconnecter
          </CommerceButton>
        </form>
      </CommercePanel>
    </>
  );
}
