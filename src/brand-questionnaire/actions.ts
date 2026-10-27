"use server";

import { getEmailProvider } from "@/email/provider";
import type { EmailAttachment } from "@/email/types";
import { readChrome } from "@/managed-content";
import { capture } from "@/monitoring/provider";
import { consume } from "@/security/rate-limit";

import { openInvitation } from "./invitation";
import { composeBrandQuestionnaireEmails } from "./message";
import {
  attachmentRefusal,
  finalAnswers,
  refusalsForAll,
  type SendOutcome,
} from "./questions";
import { readInvitationToken } from "./session";

/**
 * Sending a finished Brand Questionnaire (issue #57).
 *
 * A Server Function rather than an endpoint, for the reason the checkout's are:
 * Next.js refuses one invoked from another origin, which is the CSRF protection
 * a state-changing surface needs, and it reads the invitation cookie for free.
 * Its request body limit is already raised to 26 MB in `next.config.ts`, well
 * above the 10 MB of attachments this module allows, so a refusal is always
 * this file's, in French, and never the framework's.
 *
 * **Nothing is written anywhere.** No database, no storage, no file, no log of
 * an answer or an address: the two emails are the only place the answers exist
 * on WeCreate's side (parent decision 3, #55). Only the *name* of an error is
 * ever logged.
 *
 * **The invitation comes from the cookie, never from the form**, and is opened
 * again here: the page not rendering the form for a bad link is not a boundary.
 * Answers and files are checked again for the same reason — the browser's
 * checks are a courtesy.
 *
 * **A double submit sends once.** The idempotency keys are derived from the
 * content (see `message.ts`), so the same questionnaire asked for twice is the
 * same message and the provider delivers it once, while a corrected one is a
 * new message.
 */
export async function sendBrandQuestionnaire(
  previous: SendOutcome,
  formData: FormData,
): Promise<SendOutcome> {
  void previous;

  const token = await readInvitationToken();
  const opened = token ? openInvitation(token) : undefined;
  if (!opened || opened.status !== "valid") {
    return { status: "refused", reason: "link" };
  }
  const { invitation } = opened;

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("answers") ?? ""));
  } catch {
    raw = {};
  }
  const answers = finalAnswers(raw);

  const fields = refusalsForAll(answers);
  if (Object.keys(fields).length > 0) {
    return { status: "refused", reason: "answers", fields };
  }

  const files = formData
    .getAll("attachment")
    .filter((entry): entry is File => entry instanceof File);
  const refusal = attachmentRefusal(
    files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
  );
  if (refusal) {
    return { status: "refused", reason: "attachments", attachments: refusal };
  }

  const attachments: EmailAttachment[] = await Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      contentType: file.type,
      content: Buffer.from(await file.arrayBuffer()).toString("base64"),
    })),
  );

  // Keyed by the reference, not the address: one client's project is the thing
  // that must not be able to flood WeCreate's inbox. Counted only for a send
  // that would really go out — a refused answer costs the client nothing.
  if (!consume("questionnaire-send", invitation.reference)) {
    return { status: "refused", reason: "busy" };
  }

  const provider = await getEmailProvider();
  if (!provider) return { status: "refused", reason: "unavailable" };

  const { settings } = await readChrome();
  const { team, client } = composeBrandQuestionnaireEmails({
    invitation,
    answers,
    attachments,
    wecreateAddress: settings.contact.email,
  });

  try {
    await provider.send(team);
    await provider.send(client);
  } catch (error) {
    // The name of the failure and nothing else: the message of an error from a
    // provider may quote an address.
    console.error(
      "A brand questionnaire was not sent.",
      error instanceof Error ? error.name : "unknown error",
    );
    await capture({
      kind: "email-failure",
      source: "email",
      message: "A brand questionnaire was not accepted by the email provider.",
    });
    return { status: "refused", reason: "unavailable" };
  }

  return { status: "sent", copyTo: answers.email };
}
