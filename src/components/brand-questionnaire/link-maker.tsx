"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  BRANDING_PACK_SUGGESTIONS,
  INVITATION_FIELD_MAX,
  mailtoHref,
  whatsappHref,
} from "@/brand-questionnaire/invitation-message";
import { makeQuestionnaireLink } from "@/brand-questionnaire/link-actions";
import {
  INITIAL_LINK_FORM,
  LINK_NOTICE_LABELS,
  LINK_REFUSAL_LABELS,
  type LinkField,
  type LinkFormState,
} from "@/brand-questionnaire/link-form";
import { CommerceButton } from "@/components/commerce/commerce-button";
import { CommerceField, CommercePanel } from "@/components/commerce/commerce-form";

/**
 * Where a staff member makes a client's questionnaire link and sends it
 * (issue #63, ADR-0013).
 *
 * **Nothing here persists.** No `localStorage`, `sessionStorage`, IndexedDB,
 * cookie or address parameter: what is typed lives in the form and in React
 * state, and a reload empties it. The server seals the four words into a link
 * and forgets them (`makeQuestionnaireLink`).
 *
 * It does not validate anything in the browser. `noValidate` turns the
 * browser's own checking off, so every refusal read here is the server's, in
 * French. What was typed stays in the fields after a refusal, and after the
 * link is made, so a second client of the same pack is a matter of editing two
 * fields.
 *
 * The client's number and address are two fields **outside** the form. They
 * only shape the `wa.me` and `mailto:` addresses this component builds, so they
 * never reach the server, and WhatsApp and the mail client are opened by the
 * staff member's own device.
 */
export function LinkMaker() {
  const [state, dispatch] = useActionState(
    makeQuestionnaireLink,
    INITIAL_LINK_FORM,
  );
  const refusals = state.status === "editing" ? state.refusals : {};
  const notice = state.status === "editing" ? state.notice : null;

  const error = (field: LinkField): string | undefined => {
    const refusal = refusals[field];
    if (!refusal) return undefined;
    return refusal === "tooLong"
      ? LINK_REFUSAL_LABELS.tooLong
      : LINK_REFUSAL_LABELS.missing[field as "client" | "pack" | "reference"];
  };

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <CommercePanel title="Le client">
        <form
          action={dispatch}
          noValidate
          data-testid="questionnaire-link-form"
          className="flex flex-col gap-5"
        >
          {notice ? (
            <p
              role="alert"
              className="m-0 border border-wc-error px-4 py-3 text-body font-light text-wc-error"
            >
              {LINK_NOTICE_LABELS[notice]}
            </p>
          ) : null}
          <CommerceField
            label="Nom du client"
            name="client"
            required
            maxLength={INVITATION_FIELD_MAX}
            defaultValue={state.values.client}
            error={error("client")}
          />
          <CommerceField
            label="Nom de la marque · optionnel"
            name="brand"
            maxLength={INVITATION_FIELD_MAX}
            defaultValue={state.values.brand}
            error={error("brand")}
          />
          <CommerceField
            label="Pack Branding"
            name="pack"
            required
            list="branding-packs"
            maxLength={INVITATION_FIELD_MAX}
            defaultValue={state.values.pack}
            error={error("pack")}
          />
          <datalist id="branding-packs">
            {BRANDING_PACK_SUGGESTIONS.map((pack) => (
              <option key={pack} value={pack} />
            ))}
          </datalist>
          <CommerceField
            label="Référence WeCreate"
            name="reference"
            required
            maxLength={INVITATION_FIELD_MAX}
            defaultValue={state.values.reference}
            hint="Votre référence de projet, par exemple WC-Q48213."
            error={error("reference")}
          />
          <div>
            <CommerceButton pendingLabel="Création…">Créer le lien</CommerceButton>
          </div>
        </form>
      </CommercePanel>

      {state.status === "made" ? (
        <LinkResult key={state.link} made={state} />
      ) : null}
    </div>
  );
}

const LINK_ACTION_CLASS =
  "inline-block border px-5 py-2 text-button uppercase tracking-24";
const PRIMARY_ACTION_CLASS = `${LINK_ACTION_CLASS} border-wc-text bg-wc-inverse text-wc-inverse-text`;
const SECONDARY_ACTION_CLASS = `${LINK_ACTION_CLASS} border-wc-line-strong text-wc-text`;

/**
 * The link, the message and the three ways to send it.
 *
 * Mounted afresh for each link (`key`), so the copied state and the client's
 * number and address never outlive the link they were typed for.
 */
function LinkResult({
  made,
}: {
  made: Extract<LinkFormState, { status: "made" }>;
}) {
  const resultRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  // Focus moves to the result, so it is read out and the staff member is not
  // left on a button that has done its job. Not a live region: it holds
  // fields, and typing in them would be announced again and again.
  useEffect(() => {
    resultRef.current?.focus();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(made.link);
      setCopy("copied");
    } catch {
      // No clipboard API (an insecure address) or a refusal: leave the link
      // selected so Ctrl+C finishes the job.
      linkRef.current?.select();
      setCopy("failed");
    }
  }

  return (
    <CommercePanel title="Le lien" testId="questionnaire-link-result">
      <div
        ref={resultRef}
        tabIndex={-1}
        className="flex flex-col gap-5 outline-offset-4"
      >
        <div>
          <label className="block">
            <span className="block text-micro uppercase tracking-24 text-wc-text-muted">
              Lien personnel
            </span>
            <input
              ref={linkRef}
              type="text"
              readOnly
              value={made.link}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full border border-wc-line-strong bg-wc-surface px-3 py-2 text-body text-wc-text"
            />
          </label>
          <p className="mt-2 mb-0 text-body-sm font-light text-wc-text-muted">
            Valable jusqu&apos;au {made.expiresOn}.
          </p>
        </div>

        <pre
          data-testid="questionnaire-link-message"
          className="m-0 whitespace-pre-wrap break-words border border-wc-line bg-wc-surface p-4 font-sans text-body-sm font-light text-wc-text-soft"
        >
          {made.message}
        </pre>

        <CommerceField
          label="WhatsApp du client · optionnel"
          name="client-whatsapp"
          type="tel"
          autoComplete="off"
          hint="Avec l'indicatif s'il n'est pas béninois, par exemple +33 6 12 34 56 78. Sans numéro, WhatsApp s'ouvre et vous choisissez le contact."
          onChange={(event) => setPhone(event.target.value)}
        />
        <CommerceField
          label="Email du client · optionnel"
          name="client-email"
          type="email"
          autoComplete="off"
          onChange={(event) => setEmail(event.target.value)}
        />

        <div className="flex flex-wrap gap-3">
          <a
            href={whatsappHref(made.message, phone)}
            target="_blank"
            rel="noopener noreferrer"
            className={PRIMARY_ACTION_CLASS}
          >
            Envoyer sur WhatsApp
          </a>
          <a href={mailtoHref(made.message, email)} className={SECONDARY_ACTION_CLASS}>
            Envoyer par email
          </a>
          <button
            type="button"
            onClick={copyLink}
            className={`${SECONDARY_ACTION_CLASS} cursor-pointer`}
          >
            {copy === "copied" ? "Lien copié" : "Copier le lien"}
          </button>
        </div>

        <p
          aria-live="polite"
          className="m-0 min-h-[1lh] text-body-sm font-light text-wc-text-muted"
        >
          {copy === "copied"
            ? "Lien copié."
            : copy === "failed"
              ? "Copie impossible : le lien est sélectionné, copiez-le avec Ctrl+C."
              : ""}
        </p>
      </div>
    </CommercePanel>
  );
}
