import {
  INVITATION_VALIDITY_DAYS,
  invitationsAreConfigured,
} from "@/brand-questionnaire/invitation";
import { reachStaffTool } from "@/commerce/back-office";
import { administersCommerce } from "@/commerce/operators";
import { CommercePanel } from "@/components/commerce/commerce-form";
import { OperatorBar } from "@/components/commerce/operator-bar";
import { LinkMaker } from "@/components/brand-questionnaire/link-maker";

/**
 * Where WeCreate's team makes a Branding client's personal questionnaire link
 * (issue #63).
 *
 * Any fully authenticated staff member may be here, whatever their role
 * (ADR-0013): making a link is Branding work, not commerce administration. It
 * lives under `/commerce` for the staff session cookie, which is scoped to that
 * path. The tool reads and writes no commerce data and stores nothing.
 */
export default async function QuestionnaireLinkPage() {
  const operator = await reachStaffTool();

  return (
    <>
      <OperatorBar
        title="Envoi du questionnaire"
        operatorEmail={operator.email}
        current="/commerce/questionnaire"
        showCommerce={administersCommerce(operator)}
      />
      <p className="mt-0 mb-8 max-w-prose text-body font-light text-wc-text-soft">
        Pour un client Branding qui a validé son pack. Il reçoit un lien
        personnel vers le questionnaire de marque, valable{" "}
        {INVITATION_VALIDITY_DAYS} jours. Rien de ce que vous saisissez n&apos;est
        enregistré.
      </p>
      {invitationsAreConfigured() ? (
        <LinkMaker />
      ) : (
        <CommercePanel title="Liens non configurés">
          <p className="m-0 text-body font-light">
            Ce déploiement ne peut pas créer de liens de questionnaire : la
            variable WECREATE_QUESTIONNAIRE_SECRET n&apos;est pas définie. Voir le
            README, section « The brand questionnaire ».
          </p>
        </CommercePanel>
      )}
    </>
  );
}
