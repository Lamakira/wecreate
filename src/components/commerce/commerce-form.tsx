import type { ReactNode } from "react";

import { commerceMessage } from "@/commerce/messages";

/**
 * The back office's shared form furniture.
 *
 * Plain labels, plain inputs, plain buttons — the identity's square corners and
 * two colours, and nothing that needs JavaScript. Every control is a real form
 * control with a real label, so the whole surface is operable by keyboard and
 * readable by a screen reader without a single ARIA attribute being invented
 * for it.
 */

interface FieldProps {
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "file";
  required?: boolean;
  autoComplete?: string;
  inputMode?: "numeric";
  accept?: string;
  hint?: string;
}

export function CommerceField({ label, name, hint, ...input }: FieldProps) {
  const hintId = `${name}-hint`;

  return (
    <div>
      {/* The hint sits outside the label deliberately: inside it, it would be
          read out as part of the field's name every time focus lands there. */}
      <label className="block">
        <span className="block text-micro uppercase tracking-24 text-wc-muted-2">
          {label}
        </span>
        <input
          {...input}
          name={name}
          aria-describedby={hint ? hintId : undefined}
          className="mt-2 w-full border border-wc-border bg-wc-surface px-3 py-2 text-body text-wc-white file:mr-3 file:border-0 file:bg-transparent file:text-body-sm file:text-wc-soft"
        />
      </label>
      {hint ? (
        <p id={hintId} className="mt-2 mb-0 text-body-sm font-light text-wc-muted-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CommerceButton({
  children,
  secondary = false,
}: {
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <button
      type="submit"
      className={
        secondary
          ? "border border-wc-border px-5 py-2 text-button uppercase tracking-24 text-wc-white"
          : "border border-wc-white bg-wc-white px-5 py-2 text-button uppercase tracking-24 text-wc-pure"
      }
    >
      {children}
    </button>
  );
}

/** A titled block. The back office is a stack of these on every viewport. */
export function CommercePanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-wc-line-dark bg-wc-surface-2 p-5">
      <h2 className="m-0 text-product-title font-light">{title}</h2>
      {description ? (
        <p className="mt-2 mb-0 max-w-prose text-body-sm font-light text-wc-muted-2">
          {description}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * What the last action said.
 *
 * Read from the address rather than from state, and announced politely: an
 * operator who has just uploaded a file is looking at the form, not at the top
 * of the page.
 */
export function CommerceNotice({ message }: { message: string | undefined }) {
  const resolved = commerceMessage(message);
  if (!resolved) return null;

  return (
    <p
      role="status"
      data-testid="commerce-notice"
      data-tone={resolved.tone}
      className={
        resolved.tone === "error"
          ? "m-0 mb-8 border border-wc-white px-4 py-3 text-body font-light text-wc-white"
          : "m-0 mb-8 border border-wc-border px-4 py-3 text-body font-light text-wc-soft"
      }
    >
      {resolved.text}
    </p>
  );
}
