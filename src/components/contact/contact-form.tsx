"use client";

import { useActionState, useEffect, useRef } from "react";

import { ACTION_SIZES } from "@/components/primitives/action";
import { sendContactMessageAction } from "@/service-enquiry/actions";
import {
  CONTACT_NOTICE_LABELS,
  CONTACT_REFUSAL_LABELS,
  CONTACT_SUBJECTS,
  HONEYPOT_FIELD,
  INITIAL_CONTACT_FORM,
  type ContactField,
  type ContactRefusal,
  type ContactSubject,
} from "@/service-enquiry/contact-form";

interface ContactFormProps {
  /** A subject chosen by the link that brought the visitor here. */
  preselected: ContactSubject | null;
  /** The fastest other route, offered whenever the form cannot be. */
  whatsappUrl: string;
}

/**
 * Where a visitor writes to WeCreate.
 *
 * **It does not validate anything.** `noValidate` turns the browser's own
 * checking off, so every submission reaches the server and every refusal a
 * visitor reads is the server's: French, announced, and identical for a
 * submission that skipped this form entirely.
 *
 * The message is emailed to WeCreate and kept nowhere else (ADR-0012). What was
 * typed stays in the fields after a refusal or a failed send, so nothing is
 * lost to a provider having a bad minute.
 */
export function ContactForm({ preselected, whatsappUrl }: ContactFormProps) {
  const [state, submit, isPending] = useActionState(
    sendContactMessageAction,
    INITIAL_CONTACT_FORM,
  );
  const sentRef = useRef<HTMLDivElement>(null);

  // Focus moves to the confirmation, so it is announced and the visitor is not
  // left on a button that no longer exists.
  useEffect(() => {
    if (state.status === "sent") sentRef.current?.focus();
  }, [state.status]);

  if (state.status === "sent") {
    return (
      <div
        ref={sentRef}
        role="status"
        tabIndex={-1}
        data-testid="contact-form-sent"
        className="border border-wc-border p-6 outline-offset-4"
      >
        <p className="m-0 font-display text-[clamp(22px,2.4vw,30px)] text-wc-white">
          Message envoyé.
        </p>
        <p className="m-0 mt-3 text-body-sm font-light text-wc-soft">
          {state.sentTo
            ? `WeCreate vous répond sous 24-48h à ${state.sentTo}.`
            : "WeCreate vous répond sous 24-48h."}
        </p>
        <p className="m-0 mt-3 text-body-sm font-light text-wc-soft">
          <WhatsappLink url={whatsappUrl}>
            Pour aller plus vite, écrivez-nous sur WhatsApp
          </WhatsappLink>
        </p>
      </div>
    );
  }

  const refused = Object.values(state.refusals) as ContactRefusal[];
  const notice = state.notice ? CONTACT_NOTICE_LABELS[state.notice] : null;

  return (
    <form
      action={submit}
      noValidate
      data-testid="contact-form"
      className="relative flex flex-col gap-5"
    >
      {refused.length > 0 || notice ? (
        <div
          role="alert"
          data-testid="contact-form-errors"
          className="border border-wc-error-on-dark p-5"
        >
          <p className="m-0 text-body font-semibold text-wc-error-on-dark">
            {notice ?? "Votre message n'a pas pu être envoyé."}
          </p>
          {refused.length > 0 ? (
            <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
              {refused.map((refusal) => (
                <li
                  key={refusal}
                  className="text-body-sm font-light text-wc-error-on-dark"
                >
                  {CONTACT_REFUSAL_LABELS[refusal]}
                </li>
              ))}
            </ul>
          ) : null}
          {notice ? (
            <p className="m-0 mt-3 text-body-sm font-light text-wc-error-on-dark">
              <WhatsappLink url={whatsappUrl}>
                Écrire à WeCreate sur WhatsApp
              </WhatsappLink>
            </p>
          ) : null}
        </div>
      ) : null}

      <Field label="Nom complet" field="name" refusal={state.refusals.name}>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={state.values.name}
          required
          aria-required
          {...fieldAttributes("name", state.refusals.name)}
          className={controlClass(state.refusals.name)}
        />
      </Field>

      <Field label="Email" field="email" refusal={state.refusals.email}>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values.email}
          required
          aria-required
          {...fieldAttributes("email", state.refusals.email)}
          className={controlClass(state.refusals.email)}
        />
      </Field>

      <Field
        label="Téléphone / WhatsApp (facultatif)"
        field="telephone"
        refusal={state.refusals.telephone}
      >
        <input
          id="contact-telephone"
          name="telephone"
          type="tel"
          autoComplete="tel"
          defaultValue={state.values.telephone}
          {...fieldAttributes("telephone", state.refusals.telephone)}
          className={controlClass(state.refusals.telephone)}
        />
      </Field>

      <Field label="Sujet" field="subject" refusal={state.refusals.subject}>
        <select
          // Keyed on what was chosen: React does not move a select's default
          // after it mounts, so without it a form reset by the submission would
          // fall back to the empty option and lose the visitor's choice.
          key={state.values.subject}
          id="contact-subject"
          name="subject"
          defaultValue={state.values.subject || preselected || ""}
          required
          aria-required
          {...fieldAttributes("subject", state.refusals.subject)}
          className={controlClass(state.refusals.subject)}
        >
          <option value="">Choisissez un sujet</option>
          {CONTACT_SUBJECTS.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Votre projet en quelques lignes"
        field="message"
        refusal={state.refusals.message}
      >
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          defaultValue={state.values.message}
          required
          aria-required
          {...fieldAttributes("message", state.refusals.message)}
          className={`${controlClass(state.refusals.message)} resize-y`}
        />
      </Field>

      {/* A field no person reaches: out of the tab order, out of the
          accessibility tree, and off to the side rather than `display: none`,
          which some bots skip. A script that fills it has told us what it is. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor="contact-website">Laissez ce champ vide</label>
        <input
          id="contact-website"
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/* Refuses a second press while the first is in flight. */}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        data-testid="contact-submit"
        className={`${ACTION_SIZES.default} w-full bg-wc-white text-wc-black transition-opacity duration-300 hover:opacity-75 disabled:opacity-60`}
      >
        {isPending ? "Envoi en cours…" : "Envoyer le message"}
      </button>
    </form>
  );
}

function controlClass(refusal: ContactRefusal | undefined): string {
  return `mt-2 block w-full bg-wc-surface px-4 py-3.5 text-[15px] font-light text-wc-white ${
    refusal ? "border-2 border-wc-error-on-dark" : "border border-wc-border"
  }`;
}

function fieldAttributes(field: ContactField, refusal: ContactRefusal | undefined) {
  return {
    "aria-invalid": refusal ? (true as const) : undefined,
    "aria-describedby": refusal ? `contact-error-${field}` : undefined,
  };
}

function Field({
  label,
  field,
  refusal,
  children,
}: {
  label: string;
  field: ContactField;
  refusal: ContactRefusal | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={`contact-${field}`}
        className="block text-micro tracking-22 uppercase text-wc-muted-2"
      >
        {label}
      </label>
      {children}
      {refusal ? (
        <p
          id={`contact-error-${field}`}
          data-testid={`error-${field}`}
          className="m-0 mt-2 text-body-sm font-semibold text-wc-error-on-dark"
        >
          {CONTACT_REFUSAL_LABELS[refusal]}
        </p>
      ) : null}
    </div>
  );
}

function WhatsappLink({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="border-b border-wc-border pb-0.5 transition-colors duration-300 hover:text-wc-white"
    >
      {children}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}
