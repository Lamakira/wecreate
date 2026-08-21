"use client";

import Link from "next/link";
import { useActionState } from "react";

import { startPaymentAction } from "@/checkout/actions";
import { INITIAL_CHECKOUT_FORM } from "@/checkout/form";
import {
  GUEST_REFUSAL_LABELS,
  type GuestField,
  type GuestRefusal,
} from "@/checkout/guest";
import { checkoutMessage } from "@/checkout/messages";
import { HostedPaymentNote } from "@/components/checkout/checkout-layout";
import { ACTION_SIZES } from "@/components/primitives/action";
import { formatXof } from "@/lib/format";
import type { EffectiveLegalRevision } from "@/managed-content/legal";

interface GuestFormProps {
  /** What checkout would charge today, for the control that starts it. */
  totalXof: number;
  /** The Legal Revisions this buyer accepts before paying. */
  mustAccept: EffectiveLegalRevision[];
}

/**
 * Where a guest says who they are and what they accept.
 *
 * Four fields and no account, which is the whole list issue #1 allows: a full
 * name, an email, an international telephone and an optional company. No postal
 * address, because no provider or fiscal rule here requires one, and no
 * marketing consent — a purchase never implies one, so the question is not
 * asked rather than asked and left unticked.
 *
 * **It does not validate anything.** `noValidate` turns the browser's own
 * checking off, so every submission reaches the server and every refusal a
 * buyer reads is the server's. That is what makes the messages consistent,
 * French and announced, and it is what makes a submission that skipped this
 * form entirely subject to exactly the same rules.
 */
export function GuestForm({ totalXof, mustAccept }: GuestFormProps) {
  const [state, submit, isPending] = useActionState(
    startPaymentAction,
    INITIAL_CHECKOUT_FORM,
  );

  const message = checkoutMessage(state.message);
  const refused = Object.values(state.refusals) as GuestRefusal[];

  return (
    <form
      action={submit}
      noValidate
      data-testid="guest-form"
      className="flex flex-col gap-7"
    >
      {refused.length > 0 || message ? (
        <div
          role="alert"
          data-testid="checkout-errors"
          className="border border-wc-error p-5"
        >
          <p className="m-0 text-body font-semibold text-wc-error">
            {message ?? "Votre commande n'a pas pu être lancée."}
          </p>
          {refused.length > 0 ? (
            <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
              {refused.map((refusal) => (
                <li key={refusal} className="text-body-sm font-light text-wc-error">
                  {GUEST_REFUSAL_LABELS[refusal]}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          field="fullName"
          label="Nom complet"
          autoComplete="name"
          defaultValue={state.values.fullName}
          refusal={state.refusals.fullName}
          wide
        />
        <Field
          field="email"
          label="Email de livraison"
          type="email"
          autoComplete="email"
          hint="Le reçu et vos téléchargements arrivent à cette adresse."
          defaultValue={state.values.email}
          refusal={state.refusals.email}
        />
        <Field
          field="telephone"
          label="Téléphone international"
          type="tel"
          autoComplete="tel"
          hint="Avec l'indicatif du pays, par exemple +229."
          defaultValue={state.values.telephone}
          refusal={state.refusals.telephone}
        />
        <Field
          field="company"
          label="Entreprise (facultatif)"
          autoComplete="organization"
          defaultValue={state.values.company}
          refusal={state.refusals.company}
          optional
          wide
        />
      </div>

      {/*
        Absent rather than empty when there is nothing to accept. That happens
        on one surface: an order being paid again, which recorded the Legal
        Revisions its buyer accepted and keeps them (issue #13). A legend over
        no checkboxes would suggest a step that is not there, and a checkbox
        would collect an acceptance the retry cannot record.
      */}
      {mustAccept.length === 0 ? null : (
        <fieldset className="m-0 border-0 p-0">
          <legend className="m-0 mb-4 p-0 text-micro tracking-26 uppercase text-wc-muted-on-light">
            Conditions de la vente
          </legend>

          <div className="flex flex-col gap-4">
            {mustAccept.map((revision) => (
              <div key={revision.revisionId} className="flex items-start gap-3">
                <input
                  id={`accept-${revision.kind}`}
                  type="checkbox"
                  name="accept"
                  value={revision.revisionId}
                  data-testid="legal-acceptance"
                  aria-required="true"
                  aria-describedby={
                    state.refusals.legal ? "error-legal" : undefined
                  }
                  className="mt-1 size-4 shrink-0 accent-wc-pure"
                />
                <p className="m-0 text-body font-light text-wc-ink">
                  <label htmlFor={`accept-${revision.kind}`}>
                    J&apos;accepte «&nbsp;{revision.title}&nbsp;» en vigueur.
                  </label>{" "}
                  <Link
                    href={revision.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-b border-wc-muted-on-light pb-0.5 transition-colors duration-300 hover:border-wc-pure"
                  >
                    Lire {revision.title}
                    <span className="sr-only"> - nouvel onglet</span>
                  </Link>
                </p>
              </div>
            ))}
          </div>

          {state.refusals.legal ? (
            <FieldError field="legal" refusal={state.refusals.legal} />
          ) : null}
        </fieldset>
      )}

      <p
        data-testid="checkout-no-marketing"
        className="m-0 text-body-sm font-light text-wc-muted-on-light"
      >
        Vos coordonnées servent à livrer cette commande et à répondre à vos
        questions. Cet achat ne crée aucune inscription à une lettre
        d&apos;information.
      </p>

      <div>
        {/* Refuses a second press while the first is in flight, which is what
            keeps an impatient buyer from creating two orders — the same reason
            the back office's own submit button does it. */}
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          data-testid="checkout-submit"
          className={`${ACTION_SIZES.default} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80 disabled:bg-wc-muted-on-light`}
        >
          {isPending
            ? "Ouverture du paiement…"
            : `Continuer vers FedaPay · ${formatXof(totalXof)}`}
        </button>
        <HostedPaymentNote />
      </div>
    </form>
  );
}

interface FieldProps {
  field: GuestField;
  label: string;
  type?: "text" | "email" | "tel";
  autoComplete: string;
  hint?: string;
  defaultValue: string;
  refusal: GuestRefusal | undefined;
  optional?: boolean;
  wide?: boolean;
}

function Field({
  field,
  label,
  type = "text",
  autoComplete,
  hint,
  defaultValue,
  refusal,
  optional,
  wide,
}: FieldProps) {
  const described = [hint ? `hint-${field}` : null, refusal ? `error-${field}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={field}
        className="block text-micro tracking-26 uppercase text-wc-muted-on-light"
      >
        {label}
      </label>
      <input
        id={field}
        name={field}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={!optional}
        aria-required={optional ? undefined : true}
        aria-invalid={refusal ? true : undefined}
        aria-describedby={described || undefined}
        // A refused field is red as well as thicker: the weight alone reads as
        // emphasis, and an error a buyer cannot spot is one they cannot fix.
        className={`mt-2.5 block w-full bg-transparent px-4 py-3.5 text-body font-light text-wc-pure ${
          refusal
            ? "border-2 border-wc-error"
            : "border border-wc-muted-on-light"
        }`}
      />
      {hint ? (
        <p
          id={`hint-${field}`}
          className="m-0 mt-2 text-body-sm font-light text-wc-muted-on-light"
        >
          {hint}
        </p>
      ) : null}
      {refusal ? <FieldError field={field} refusal={refusal} /> : null}
    </div>
  );
}

function FieldError({
  field,
  refusal,
}: {
  field: GuestField;
  refusal: GuestRefusal;
}) {
  return (
    <p
      id={`error-${field}`}
      data-testid={`error-${field}`}
      className="m-0 mt-2 text-body-sm font-semibold text-wc-error"
    >
      {GUEST_REFUSAL_LABELS[refusal]}
    </p>
  );
}
