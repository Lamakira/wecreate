"use server";

import { redirect } from "next/navigation";

import { isStaff } from "@/commerce/operators";
import { readSignedInOperator } from "@/commerce/session";

import {
  defaultInvitationExpiry,
  invitationUrl,
  invitationsAreConfigured,
  sealInvitation,
} from "./invitation";
import { INVITATION_FIELD_MAX, composeInvitationMessage } from "./invitation-message";
import type {
  LinkField,
  LinkFormState,
  LinkFormValues,
  LinkRefusal,
} from "./link-form";

/**
 * Make a client's personal questionnaire link (issue #63, ADR-0013).
 *
 * **It stores nothing and logs nothing.** The four values are sealed into the
 * token and handed back with the message; no row is written, no file, no log
 * line names the client. The staff member sends the link from their own
 * WhatsApp or mail client, so the client's number and address never arrive here
 * at all.
 *
 * It is an entry point in its own right: a form is not a boundary, so the
 * session is checked before anything is read from the form. A fully
 * authenticated staff account is enough; the commerce role is not asked for.
 */
export async function makeQuestionnaireLink(
  _previous: LinkFormState,
  formData: FormData,
): Promise<LinkFormState> {
  const operator = await readSignedInOperator();
  if (!isStaff(operator)) {
    redirect(
      operator
        ? "/commerce/connexion"
        : "/commerce/connexion?message=sessionExpired",
    );
  }

  const values: LinkFormValues = {
    client: text(formData, "client"),
    brand: text(formData, "brand"),
    pack: text(formData, "pack"),
    reference: text(formData, "reference"),
  };

  if (!invitationsAreConfigured()) {
    return { status: "editing", refusals: {}, notice: "unconfigured", values };
  }

  const refusals: Partial<Record<LinkField, LinkRefusal>> = {};
  for (const field of ["client", "brand", "pack", "reference"] as const) {
    if (Array.from(values[field]).length > INVITATION_FIELD_MAX) {
      refusals[field] = "tooLong";
    } else if (field !== "brand" && values[field].length === 0) {
      refusals[field] = "missing";
    }
  }
  if (Object.keys(refusals).length > 0) {
    return { status: "editing", refusals, notice: null, values };
  }

  const expiresAt = defaultInvitationExpiry();
  const link = invitationUrl(sealInvitation({ ...values, expiresAt }));
  const expiresOn = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Africa/Porto-Novo",
  }).format(expiresAt);

  return {
    status: "made",
    values,
    link,
    expiresOn,
    message: composeInvitationMessage({ ...values, link, expiresOn }),
  };
}

function text(formData: FormData, name: LinkField): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
