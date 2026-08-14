import type { PaymentProvider } from "../provider";
import {
  PaymentProviderUnreachable,
  type HostedPayment,
  type HostedPaymentRequest,
  type PaymentEventDelivery,
  type PaymentEventReading,
} from "../types";
import { readFedaPayEvent } from "./webhook";

/**
 * FedaPay, and the only module in the application that knows it exists
 * (ADR-0008).
 *
 * Two REST calls, no SDK. The vendor's Node package would be a dependency, a
 * `pnpm audit` surface and a second place credentials are read, in exchange for
 * wrapping two documented requests this file makes in eleven lines. What it
 * would genuinely buy — types for the responses — is not something a vendor
 * SDK's optimism can be trusted for anyway: the shapes below are read
 * defensively and proved against the real sandbox by
 * `tests/contract/fedapay.spec.ts`, which is the only thing that can prove them.
 *
 * **This file deliberately does not import `server-only`.** Every other module
 * that reads a credential does, and this one is the exception because the
 * provider-contract smoke test issue #1 asks for has to import it in Node and
 * call it against FedaPay's sandbox. What keeps it off a client bundle instead
 * is that nothing in `src/` imports it but `../provider.ts`, which does carry
 * the marker, and that the secret is read inside a function rather than at
 * module scope — so importing this module never even evaluates it.
 */

/** The two servers FedaPay runs. Nothing here may pick the second by accident. */
const API_ORIGINS = {
  sandbox: "https://sandbox-api.fedapay.com",
  live: "https://api.fedapay.com",
} as const;

export type FedaPayEnvironment = keyof typeof API_ORIGINS;

/**
 * A checkout may not hang on a provider.
 *
 * A buyer waiting on a Benin mobile connection is better served by a failed
 * attempt they can retry than by a page that never answers — and the order is
 * already recorded, so retrying costs them nothing.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Which FedaPay this process talks to. Sandbox unless something explicitly
 * names the live one.
 *
 * Live payments are the Commerce Launch Gate's own irreversible switch, and
 * issue #1 requires a named WeCreate owner to approve it. Nothing in this
 * repository selects it: it is a deployment environment variable, set once, by
 * the people whose money it is.
 */
export function fedaPayEnvironment(): FedaPayEnvironment {
  return process.env.FEDAPAY_ENVIRONMENT === "live" ? "live" : "sandbox";
}

export function fedaPayApiOrigin(): string {
  return API_ORIGINS[fedaPayEnvironment()];
}

function secretKey(): string {
  const key = process.env.FEDAPAY_SECRET_KEY;
  if (!key) {
    throw new PaymentProviderUnreachable(
      "FEDAPAY_SECRET_KEY is not configured for this deployment",
    );
  }
  return key;
}

/**
 * The country FedaPay is told the telephone belongs to.
 *
 * FedaPay requires one beside the number. Asking a buyer for it would be a
 * fifth field for something their own telephone number already says, so it is
 * derived from the international dialling code they typed. The countries below
 * are the ones FedaPay collects in; anything else falls back to WeCreate's own,
 * and a number the provider then refuses becomes a failed attempt with a retry
 * beside it rather than a charge.
 */
const DIALLING_COUNTRIES: Record<string, string> = {
  "229": "bj",
  "225": "ci",
  "221": "sn",
  "228": "tg",
  "226": "bf",
  "227": "ne",
  "223": "ml",
  "224": "gn",
  "245": "gw",
};

export function telephoneCountry(telephone: string): string {
  const digits = telephone.replace(/\D/g, "");
  return DIALLING_COUNTRIES[digits.slice(0, 3)] ?? "bj";
}

/**
 * A full name as two fields, because FedaPay asks for two.
 *
 * WeCreate asks for one, which is the field a person actually has. The first
 * word is the given name and the rest is the family name; a single-word name is
 * both, because leaving one empty is what FedaPay refuses.
 */
export function splitName(fullName: string): {
  firstname: string;
  lastname: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstname: "Client", lastname: "Client" };
  }
  if (parts.length === 1) {
    return { firstname: parts[0], lastname: parts[0] };
  }
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

async function post(path: string, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${fedaPayApiOrigin()}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey()}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // A name that would not resolve, a connection that dropped, a request that
    // ran out of time. None of them says anything about money.
    throw new PaymentProviderUnreachable(
      `POST ${path} did not complete: ${(error as Error).name}`,
    );
  }

  if (!response.ok) {
    // The status and nothing else. A provider's error body can quote back what
    // was sent, and what was sent includes a buyer's details.
    throw new PaymentProviderUnreachable(
      `POST ${path} answered ${response.status}`,
    );
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new PaymentProviderUnreachable(`POST ${path} answered unreadable JSON`);
  }
}

/**
 * FedaPay wraps a resource under a key naming its type, and has spelled that
 * key more than one way across API versions. Both are read, and the bare object
 * as well, so a response shape moving is a thing the contract test catches
 * rather than a checkout that fails in production.
 */
function unwrap(payload: unknown, resource: string): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) {
    return {};
  }
  const body = payload as Record<string, unknown>;
  const nested = body[`v1/${resource}`] ?? body[resource];
  return typeof nested === "object" && nested !== null
    ? (nested as Record<string, unknown>)
    : body;
}

export const fedaPayProvider: PaymentProvider = {
  id: "fedapay",

  async createHostedPayment(
    request: HostedPaymentRequest,
  ): Promise<HostedPayment> {
    const { firstname, lastname } = splitName(request.buyer.fullName);

    const created = unwrap(
      await post("/v1/transactions", {
        description: request.description,
        // Whole XOF, as an integer, which is the only shape FedaPay accepts and
        // the only shape WeCreate prices in.
        amount: request.amountXof,
        currency: { iso: "XOF" },
        callback_url: request.returnUrl,
        customer: {
          firstname,
          lastname,
          email: request.buyer.email,
          phone_number: {
            number: request.buyer.telephone,
            country: telephoneCountry(request.buyer.telephone),
          },
        },
      }),
      "transaction",
    );

    const transactionId = created.id;
    if (typeof transactionId !== "number" && typeof transactionId !== "string") {
      throw new PaymentProviderUnreachable(
        "the created transaction carried no id",
      );
    }

    // The documented way to get the hosted page. Some responses already carry an
    // `authorization_url`; asking for the token is what the integration guide
    // describes, and it is what a buyer's link is supposed to come from.
    const token = unwrap(
      await post(`/v1/transactions/${transactionId}/token`),
      "token",
    );
    const redirectUrl =
      typeof token.url === "string"
        ? token.url
        : typeof created.authorization_url === "string"
          ? created.authorization_url
          : undefined;
    if (!redirectUrl) {
      throw new PaymentProviderUnreachable(
        "the transaction token carried no payment page",
      );
    }

    return { providerTransactionId: String(transactionId), redirectUrl };
  },

  readPaymentEvent(delivery: PaymentEventDelivery): PaymentEventReading {
    return readFedaPayEvent(delivery);
  },
};
