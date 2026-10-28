import "server-only";

import { createHash } from "node:crypto";

import type { TransactionalEmail } from "@/email/types";

import { contactSubjectLabel, type ContactMessage } from "./contact-form";

/**
 * What lands in WeCreate's inbox when a visitor uses the contact form.
 *
 * Composed like the receipt (`fulfillment/receipt.ts`): a plain-text half and an
 * HTML half saying the same thing, from the same facts, with every style inline
 * and no image. `replyTo` is the visitor, so pressing Reply answers them.
 */

const NOT_GIVEN = "non indiqué";

/** Text a visitor typed, made safe to place inside HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * The key the email provider recognises a repeat by.
 *
 * The same message sent twice — a double press, a resubmitted page — is one
 * message in WeCreate's inbox. Resend honours a key for 24 hours and the
 * fixture forever, so a repeat inside that window is accepted and adds nothing.
 */
function idempotencyKey(message: ContactMessage): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        name: message.name,
        email: message.email.toLowerCase(),
        telephone: message.telephone,
        subject: message.subject,
        message: message.message,
      }),
    )
    .digest("hex");
  return `contact-${digest}`;
}

function composeText(message: ContactMessage): string {
  return [
    `De : ${message.name}`,
    `Email : ${message.email}`,
    `Téléphone : ${message.telephone ?? NOT_GIVEN}`,
    `Sujet : ${contactSubjectLabel(message.subject)}`,
    "",
    message.message,
    "",
    `Répondez à ce message : la réponse part directement à ${message.email}.`,
    "Ce message n'est enregistré nulle part ailleurs que dans cette boîte.",
  ].join("\n");
}

function composeHtml(message: ContactMessage): string {
  const row = (label: string, value: string) => `
                  <tr>
                    <td style="padding:6px 16px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;white-space:nowrap;">${escapeHtml(label)}</td>
                    <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:300;color:#000000;">${escapeHtml(value)}</td>
                  </tr>`;
  const body = escapeHtml(message.message).replaceAll(/\r\n|\r|\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#f4f4f4;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;">
            <tr>
              <td style="background-color:#000000;padding:28px 40px;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#ffffff;">WeCreate</span>
              </td>
            </tr>
            <tr>
              <td style="padding:40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;font-weight:300;color:#333333;">
                <table role="presentation" cellpadding="0" cellspacing="0">${row("De", message.name)}${row("Email", message.email)}${row("Téléphone", message.telephone ?? NOT_GIVEN)}${row("Sujet", contactSubjectLabel(message.subject))}
                </table>
                <h2 style="margin:32px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;">Message</h2>
                <p style="margin:0;">${body}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:300;color:#6a6a6a;">
                Répondez à ce message : la réponse part directement à ${escapeHtml(message.email)}.<br>
                Ce message n'est enregistré nulle part ailleurs que dans cette boîte.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function composeContactEmail({
  message,
  inbox,
}: {
  message: ContactMessage;
  inbox: string;
}): TransactionalEmail {
  return {
    to: inbox,
    replyTo: message.email,
    subject: `Contact · ${contactSubjectLabel(message.subject)} · ${message.name}`,
    body: composeText(message),
    html: composeHtml(message),
    idempotencyKey: idempotencyKey(message),
  };
}
