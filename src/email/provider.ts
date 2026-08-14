import "server-only";

import type { EmailProviderId, TransactionalEmail } from "./types";

export type { EmailProviderId } from "./types";

/**
 * The single outbound boundary between WeCreate and whoever carries its mail
 * (ADR-0008).
 *
 * One method, because there is one direction: WeCreate hands over a message and
 * is told whether it was accepted. Nothing comes back the other way — there is
 * no inbox here, no reply handling and no delivery webhook — so this interface
 * has nowhere to put them.
 */
export interface EmailProvider {
  readonly id: EmailProviderId;

  /**
   * Send one message, or throw `EmailProviderUnreachable`.
   *
   * Sending the same `idempotencyKey` twice must not put two messages in a
   * buyer's inbox. Where the provider offers that itself, the adapter passes the
   * key through rather than keeping a record of its own: the provider is the one
   * that knows what it has already accepted.
   */
  send(message: TransactionalEmail): Promise<void>;
}

/** Which provider this process sends through. See `EmailProviderId`. */
export function resolveEmailProviderId(): EmailProviderId {
  const configured = process.env.WECREATE_EMAIL_PROVIDER;
  if (configured === "fixture" || configured === "resend") {
    return configured;
  }
  return process.env.RESEND_API_KEY ? "resend" : "none";
}

/** The provider in use, or `undefined` on a deployment that sends no mail. */
export async function getEmailProvider(): Promise<EmailProvider | undefined> {
  switch (resolveEmailProviderId()) {
    case "fixture": {
      const { fixtureEmailProvider } = await import("./fixture/provider");
      return fixtureEmailProvider;
    }
    case "resend": {
      // Imported lazily so a deployment that sends no mail never loads the
      // adapter or requires its environment variables to be present.
      const { resendEmailProvider } = await import("./resend/provider");
      return resendEmailProvider;
    }
    default:
      return undefined;
  }
}
