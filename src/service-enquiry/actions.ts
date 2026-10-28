"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { getEmailProvider } from "@/email/provider";
import { EmailProviderUnreachable } from "@/email/types";
import { readSiteSettings } from "@/managed-content";
import { capture } from "@/monitoring/provider";
import { consumeAll } from "@/security/rate-limit";
import { requestAddress } from "@/security/request-address";

import { composeContactEmail } from "./contact-email";
import {
  EMPTY_CONTACT_FORM,
  HONEYPOT_FIELD,
  readContactMessage,
  type ContactFormState,
  type ContactFormValues,
  type ContactNotice,
} from "./contact-form";

/**
 * Sending a visitor's message to WeCreate.
 *
 * ADR-0012 amends ADR-0006: the message is emailed to WeCreate's inbox and
 * stored nowhere else. Nothing is written by this file — no commerce provider,
 * no cookie, no file — so there is no lead to retain, export or erase.
 *
 * A Server Function rather than an endpoint, for the reason the checkout's are:
 * Next.js refuses one invoked from another origin, which is the CSRF protection
 * a state-changing surface needs.
 */

function submitted(formData: FormData): ContactFormValues {
  const field = (name: string) => String(formData.get(name) ?? "");
  return {
    name: field("name"),
    email: field("email"),
    telephone: field("telephone"),
    subject: field("subject"),
    message: field("message"),
  };
}

function editing(
  values: ContactFormValues,
  notice: ContactNotice,
): ContactFormState {
  return { status: "editing", refusals: {}, notice, values, sentTo: null };
}

export async function sendContactMessageAction(
  previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  void previous;
  const values = submitted(formData);

  // A bot that filled the hidden field is told it worked, and nothing is sent.
  const trap = formData.get(HONEYPOT_FIELD);
  if (typeof trap === "string" && trap.length > 0) {
    return {
      status: "sent",
      refusals: {},
      notice: null,
      values: EMPTY_CONTACT_FORM,
      sentTo: null,
    };
  }

  const { message, refusals } = readContactMessage(values);
  if (Object.keys(refusals).length > 0) {
    return { status: "editing", refusals, notice: null, values, sentTo: null };
  }

  // After validation, so a refused form does not spend a slot. The address is
  // hashed so the bucket never holds one.
  const allowed = consumeAll([
    { surface: "contact-form", key: requestAddress(await headers()) },
    {
      surface: "contact-form",
      key: `email:${createHash("sha256").update(message.email.toLowerCase()).digest("hex")}`,
    },
  ]);
  if (!allowed) return editing(values, "tooManyMessages");

  const provider = await getEmailProvider();
  if (!provider) {
    console.error("A contact form message was not sent: no email provider is configured.");
    return editing(values, "sendFailed");
  }

  // The administrative address already published on /contact: no new setting.
  const inbox = (await readSiteSettings()).contact.email;

  try {
    await provider.send(composeContactEmail({ message, inbox }));
  } catch (error) {
    const reason =
      error instanceof EmailProviderUnreachable
        ? error.message
        : "the email provider failed unexpectedly";
    // Never the visitor's address: only what failed.
    console.error(`A contact form message was not sent: ${reason}`);
    await capture({
      kind: "email-failure",
      source: "email",
      message: `A contact form message was not sent: ${reason}`,
    });
    return editing(values, "sendFailed");
  }

  return {
    status: "sent",
    refusals: {},
    notice: null,
    values: EMPTY_CONTACT_FORM,
    sentTo: message.email,
  };
}
