import "server-only";

import type { EmailProvider } from "../provider";
import { EmailProviderUnreachable, type TransactionalEmail } from "../types";

/**
 * WeCreate's mail, on Resend, and the only module that knows it exists
 * (ADR-0008).
 *
 * **One REST call and no SDK**, for the reason the FedaPay adapter is two: the
 * whole of what this application asks of Resend is "send this message once",
 * which is a `POST` with three fields and a header. A dependency for that would
 * be a dependency to audit, update and keep in step with a framework, in
 * exchange for nothing.
 *
 * `RESEND_API_KEY` is server-only and there is no `NEXT_PUBLIC_RESEND_*`
 * anything: no browser here ever holds a mail credential, and nothing on the
 * client sends a message.
 *
 * `Idempotency-Key` is what stops a webhook retry from becoming a second
 * receipt. Resend recognises a key for twenty-four hours, which is longer than
 * any redelivery window a payment provider works to, so the second request is
 * answered with the first request's result instead of sending again.
 */

const ENDPOINT = "https://api.resend.com/emails";

/**
 * How long WeCreate waits for Resend before calling a receipt undelivered.
 *
 * Bounded because this runs inside the webhook request a payment provider is
 * waiting on: a mail API that has stopped answering must not hold that request
 * open until the provider gives up and redelivers.
 */
const SEND_TIMEOUT_MS = 10_000;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new EmailProviderUnreachable(
      `${name} is required to send transactional email. See README.md, “Setting up Resend”.`,
    );
  }
  return value;
}

export const resendEmailProvider: EmailProvider = {
  id: "resend",

  async send(message: TransactionalEmail): Promise<void> {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${required("RESEND_API_KEY")}`,
        "content-type": "application/json",
        "idempotency-key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from: required("RESEND_FROM_ADDRESS"),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.body,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    }).catch((error: unknown) => {
      throw new EmailProviderUnreachable(
        `POST /emails did not answer: ${error instanceof Error ? error.name : "unknown"}`,
      );
    });

    if (!response.ok) {
      // The status and nothing else. Resend's error body can quote the message
      // it refused, and a receipt names the buyer — so what is thrown here is
      // written to be logged beside an order reference and carry no one's
      // address (issue #1).
      throw new EmailProviderUnreachable(
        `POST /emails answered ${response.status}`,
      );
    }
  },
};
