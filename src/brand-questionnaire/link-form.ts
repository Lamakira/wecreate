import { INVITATION_FIELD_MAX } from "./invitation-message";

/**
 * What the questionnaire link maker knows between one submission and the next.
 *
 * Here rather than in `link-actions.ts`, because a `"use server"` file may only
 * export functions. Pure, like `src/service-enquiry/contact-form.ts`, so
 * the client component can import the labels too.
 */

export type LinkField = "client" | "brand" | "pack" | "reference";

export type LinkRefusal = "missing" | "tooLong";

/** Something that is not about a field. */
export type LinkNotice = "unconfigured";

export interface LinkFormValues {
  client: string;
  brand: string;
  pack: string;
  reference: string;
}

export const EMPTY_LINK_FORM: LinkFormValues = {
  client: "",
  brand: "",
  pack: "",
  reference: "",
};

export type LinkFormState =
  | {
      status: "editing";
      refusals: Partial<Record<LinkField, LinkRefusal>>;
      notice: LinkNotice | null;
      /** What was typed, so a refusal does not cost anyone their typing. */
      values: LinkFormValues;
    }
  | {
      status: "made";
      values: LinkFormValues;
      link: string;
      /** The expiry as a French date. */
      expiresOn: string;
      /** The message to send, with the link in it. */
      message: string;
    };

export const INITIAL_LINK_FORM: LinkFormState = {
  status: "editing",
  refusals: {},
  notice: null,
  values: EMPTY_LINK_FORM,
};

/** What the staff member is told, in French, and what to do about it. */
export const LINK_REFUSAL_LABELS = {
  missing: {
    client: "Indiquez le nom du client.",
    pack: "Indiquez le pack Branding.",
    reference: "Indiquez la référence WeCreate.",
  },
  tooLong: `${INVITATION_FIELD_MAX} caractères au plus.`,
} as const;

export const LINK_NOTICE_LABELS: Record<LinkNotice, string> = {
  unconfigured:
    "Les liens de questionnaire ne sont pas configurés sur ce déploiement (WECREATE_QUESTIONNAIRE_SECRET). Voir le README, section « The brand questionnaire ».",
};
