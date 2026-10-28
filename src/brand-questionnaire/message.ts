import { createHash } from "node:crypto";

import type { EmailAttachment, TransactionalEmail } from "@/email/types";

import type { QuestionnaireInvitation } from "./invitation";
import {
  LOGO_TYPES,
  PERSONALITY_AXES,
  QUESTIONNAIRE_STEPS,
  TEXT_QUESTIONS,
  type BrandAnswers,
  type StepIndex,
  type TextQuestionId,
} from "./questions";

/**
 * What a finished Brand Questionnaire becomes: two emails, and nothing else.
 *
 * One to WeCreate, with the client's address as its reply-to, and one copy to
 * the client. Nothing is stored (parent decision 3, #55), so these messages —
 * and the files they carry — are the only place the answers exist on WeCreate's
 * side.
 *
 * Sent as HTML with a plain-text half saying the same thing, composed here
 * from the same rows so they cannot drift apart. The HTML is the receipt's
 * identity (`src/fulfillment/receipt.ts`): black and white, every style inline,
 * no image.
 *
 * **The idempotency keys are derived from the content.** `reference` alone
 * would make the provider swallow a second, *different* submission as a repeat
 * — or, with Resend, refuse it with a 409 for reusing a key with another body.
 * Adding a digest of the answers and of the files means the same questionnaire
 * submitted twice (a double click, a retry after a timeout) is the same message
 * and is sent once, while a corrected one is a new message and goes through.
 */

const UNANSWERED = "Sans réponse";

interface AnswerRow {
  label: string;
  value: string;
}

interface AnswerSection {
  title: string;
  rows: AnswerRow[];
}

export interface BrandQuestionnaireInput {
  invitation: QuestionnaireInvitation;
  /** Already trimmed and normalized: see `finalAnswers`. */
  answers: BrandAnswers;
  attachments: EmailAttachment[];
  /** `settings.contact.email`, where the questionnaire goes. */
  wecreateAddress: string;
}

function text(value: string): string {
  return value.trim() || UNANSWERED;
}

function list(values: readonly string[]): string {
  return values.length ? values.join(", ") : UNANSWERED;
}

function textRow(answers: BrandAnswers, id: TextQuestionId): AnswerRow {
  return { label: TEXT_QUESTIONS[id].label, value: text(answers[id]) };
}

/**
 * Every question, grouped under its step, in the order the client met them.
 * Where a choice sits relative to the text questions mirrors the form.
 */
function sections(answers: BrandAnswers): AnswerSection[] {
  const axes = PERSONALITY_AXES.map((axis) => ({
    label: `${axis.left} ↔ ${axis.right}`,
    value: answers.axes[axis.id] ? `${answers.axes[axis.id]}/5` : UNANSWERED,
  }));
  const logo = answers.logo.map(
    (id) => LOGO_TYPES.find((type) => type.id === id)?.label ?? id,
  );

  const rows: Record<StepIndex, AnswerRow[]> = {
    0: [
      textRow(answers, "brand"),
      textRow(answers, "sector"),
      textRow(answers, "pitch"),
      textRow(answers, "story"),
      textRow(answers, "launch"),
    ],
    1: [
      textRow(answers, "audience"),
      textRow(answers, "problem"),
      { label: "Positionnement prix", value: text(answers.price) },
      { label: "Zone de clientèle", value: list(answers.zone) },
    ],
    2: [textRow(answers, "values"), ...axes, textRow(answers, "never")],
    3: [
      textRow(answers, "admire"),
      { label: "Type de logo souhaité", value: list(logo) },
      textRow(answers, "colorsLike"),
      textRow(answers, "colorsAvoid"),
    ],
    4: [
      textRow(answers, "competitors"),
      {
        label: "Où la marque apparaîtra en priorité",
        value: list(answers.supports),
      },
      textRow(answers, "notes"),
      textRow(answers, "email"),
    ],
  };

  return QUESTIONNAIRE_STEPS.map((step, index) => ({
    title: step.label,
    rows: rows[index as StepIndex],
  }));
}

function attachmentsLine(attachments: readonly EmailAttachment[]): string {
  return `Fichiers joints : ${
    attachments.length
      ? attachments.map((file) => file.filename).join(", ")
      : "aucun"
  }`;
}

function sectionsText(answers: BrandAnswers): string {
  return sections(answers)
    .map((section) =>
      [
        section.title,
        ...section.rows.map((row) => `${row.label} : ${row.value}`),
      ].join("\n"),
    )
    .join("\n\n");
}

/** A value from a form, made safe to place inside HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Escaped, with the client's own line breaks kept. */
function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

const HEADING_STYLE =
  "margin:32px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;";

function sectionsHtml(answers: BrandAnswers): string {
  return sections(answers)
    .map((section) => {
      const rows = section.rows
        .map(
          (row) => `
          <tr>
            <td valign="top" style="padding:8px 16px 8px 0;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#000000;width:38%;">${escapeHtml(row.label)}</td>
            <td valign="top" style="padding:8px 0;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:300;color:#000000;">${multiline(row.value)}</td>
          </tr>`,
        )
        .join("");
      return `
                <h2 style="${HEADING_STYLE}">${escapeHtml(section.title)}</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}
                </table>`;
    })
    .join("");
}

/** The shell of the receipt's identity around some paragraphs of body. */
function page(inner: string): string {
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
              <td style="padding:40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;font-weight:300;color:#333333;">${inner}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:300;color:#6a6a6a;">
                WeCreate - Calavi Tankpè, Bénin
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraphs(lines: readonly string[]): string {
  return lines
    .map((line) => `
                <p style="margin:0 0 8px;">${escapeHtml(line)}</p>`)
    .join("");
}

/** First 32 hex characters of SHA-256 over what makes this submission this one. */
function digest(
  reference: string,
  answers: BrandAnswers,
  attachments: readonly EmailAttachment[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        reference,
        answers,
        attachments: attachments.map((file) => ({
          filename: file.filename,
          contentType: file.contentType,
          sha256: createHash("sha256")
            .update(Buffer.from(file.content, "base64"))
            .digest("hex"),
        })),
      }),
    )
    .digest("hex")
    .slice(0, 32);
}

export function composeBrandQuestionnaireEmails({
  invitation,
  answers,
  attachments,
  wecreateAddress,
}: BrandQuestionnaireInput): { team: TransactionalEmail; client: TransactionalEmail } {
  const { client, pack, reference } = invitation;
  // One line: it goes into a subject, and a request need not have come from
  // the form.
  const brand = answers.brand.replace(/\s+/g, " ");
  const clientEmail = answers.email;
  const key = `brand-questionnaire-${reference}-${digest(reference, answers, attachments)}`;

  const identity = [
    `Client : ${client}`,
    `Pack : ${pack}`,
    `Référence : ${reference}`,
    `Email : ${clientEmail}`,
  ];
  const files = attachmentsLine(attachments);

  const team: TransactionalEmail = {
    to: wecreateAddress,
    replyTo: clientEmail,
    subject: `Questionnaire de marque · ${brand} · ${reference}`,
    body: [...identity, "", sectionsText(answers), "", files].join("\n"),
    html: page(`${paragraphs(identity)}${sectionsHtml(answers)}
                <p style="margin:24px 0 0;">${escapeHtml(files)}</p>`),
    idempotencyKey: `${key}-team`,
    attachments,
  };

  const intro = [
    `Bonjour ${client},`,
    `Voici une copie des réponses envoyées à WeCreate pour ${brand} (${pack}, référence ${reference}).`,
  ];
  const outro = `Une question ? Écrivez-nous à ${wecreateAddress} en indiquant la référence ${reference}.`;

  const copy: TransactionalEmail = {
    to: clientEmail,
    subject: `Votre questionnaire de marque · ${brand}`,
    body: [...intro, "", sectionsText(answers), "", files, "", outro].join("\n"),
    html: page(`${paragraphs(intro)}${sectionsHtml(answers)}
                <p style="margin:24px 0 0;">${escapeHtml(files)}</p>
                <p style="margin:24px 0 0;">Une question ? Écrivez-nous à <a href="mailto:${escapeHtml(wecreateAddress)}" style="color:#000000;">${escapeHtml(wecreateAddress)}</a> en indiquant la référence ${escapeHtml(reference)}.</p>`),
    idempotencyKey: `${key}-client`,
    attachments,
  };

  return { team, client: copy };
}
