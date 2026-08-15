import "server-only";

import { redirect } from "next/navigation";

import { accessRefusal, type AccessRefusal } from "./operators";
import { getCommerceProvider, type CommerceProvider } from "./provider";
import { readOperatorCredentials, readSignedInOperator } from "./session";
import type { CommerceOperator, OperatorCredentials } from "./types";

/**
 * What every page of the back office asks before it renders anything.
 *
 * Written once because it is the check that must not be forgotten, exactly as
 * `working()` is in `actions.ts` for the other half: a page that renders and an
 * action that writes ask the same question, and a check repeated on four pages
 * is a check that will eventually be repeated on three.
 *
 * It is not the security boundary and does not pretend to be one. Postgres asks
 * the same question again against the request that arrives with these
 * credentials, and the data plane refuses a caller who never rendered a page.
 * What this decides is where a person is sent and what they are told.
 */

/** Who is doing the work, once every question about them has been answered. */
export interface WorkingOperator {
  operator: CommerceOperator;
  provider: CommerceProvider;
  credentials: OperatorCredentials;
}

/**
 * The same question a page asks, for something that writes rather than renders.
 *
 * It answers rather than redirecting, because the two callers do different
 * things with a refusal: a Server Function sends the browser somewhere, and a
 * route handler owes it a response. `permitted` is what this particular piece
 * of work requires — administering commerce, or being allowed to enrol a first
 * factor.
 */
export async function readWorkingOperator(
  permitted: (operator: CommerceOperator | undefined) => boolean,
): Promise<WorkingOperator | undefined> {
  const provider = await getCommerceProvider();
  const credentials = await readOperatorCredentials();
  const operator = await readSignedInOperator();

  if (!provider || !credentials || !operator || !permitted(operator)) {
    return undefined;
  }
  return { operator, provider, credentials };
}

export type BackOfficeEntry =
  | {
      status: "working";
      operator: CommerceOperator;
      provider: CommerceProvider;
      credentials: OperatorCredentials;
    }
  | { status: "refused"; refusal: AccessRefusal };

/**
 * Who is working, or why they may not.
 *
 * Three of the four refusals are the session's own to resolve, and each is sent
 * to the one place that resolves it: the sign-in form, the second factor, the
 * enrolment page. The fourth cannot be resolved by anybody sitting at a
 * browser — a Content Editor at assurance level 2 is fully authenticated and
 * still not a Commerce Operator — so it is answered rather than redirected,
 * and the page says so out loud.
 */
export async function reachBackOffice(): Promise<BackOfficeEntry> {
  const operator = await readSignedInOperator();
  const refusal = accessRefusal(operator);

  if (refusal === "notSignedIn" || refusal === "secondFactorNotVerified") {
    redirect("/commerce/connexion");
  }
  if (refusal === "noSecondFactor") {
    redirect("/commerce/securite");
  }
  if (refusal || !operator) {
    return { status: "refused", refusal: refusal ?? "notSignedIn" };
  }

  const provider = await getCommerceProvider();
  const credentials = await readOperatorCredentials();
  if (!provider || !credentials) {
    // The session went away between two reads of it, or the deployment lost its
    // data plane. Either way there is nothing to render and signing in again is
    // the only thing that could help.
    redirect("/commerce/connexion");
  }

  return { status: "working", operator, provider, credentials };
}
