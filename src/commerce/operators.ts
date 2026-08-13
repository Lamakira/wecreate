import type { CommerceOperator } from "./types";

/**
 * Who may see and change commerce data.
 *
 * Pure rules over a session, applied in three places that must agree: the pages
 * that decide what to render, the actions that decide what to perform, and
 * Postgres itself, whose policies say the same thing in SQL
 * (`supabase/migrations/`). Two of those are inside this application and could
 * be got past by a request that never renders a page; the third cannot.
 */

/**
 * The role that admits someone to commerce administration.
 *
 * One string, named once, and the same one in three places: the adapter that
 * reads it off a staff member's account, the fixture that seeds it, and the
 * Postgres policies that check it (`supabase/migrations/`). A Content Editor
 * does not have it, whether or not the same person also edits content.
 */
export const COMMERCE_OPERATOR_ROLE = "commerce_operator";

/** Why a signed-in staff member may not administer commerce. */
export type AccessRefusal =
  | "notSignedIn"
  | "noSecondFactor"
  | "secondFactorNotVerified"
  | "notACommerceOperator";

/** French wording for each refusal. Every one of them names what to do next. */
export const ACCESS_REFUSAL_LABELS: Record<AccessRefusal, string> = {
  notSignedIn: "Connectez-vous pour accéder à l'espace commerce.",
  noSecondFactor:
    "Enregistrez une application d'authentification avant d'accéder aux données commerciales.",
  secondFactorNotVerified:
    "Saisissez le code de votre application d'authentification pour continuer.",
  notACommerceOperator:
    "Votre compte n'administre pas le commerce. Les fichiers livrés et le journal des opérations sont réservés aux opératrices et opérateurs commerce.",
};

/**
 * Why this session may not reach commerce data, or `undefined` if it may.
 *
 * The order matters: it is the order the operator has to resolve them in, and
 * each answer sends them to exactly one place — the sign-in form, the second
 * factor form, the enrolment page, or a conversation with WeCreate about their
 * role.
 *
 * Assurance level 2 is required for *viewing* as much as for changing (issue
 * #1): the list of files WeCreate sells, who uploaded them and when is commerce
 * data, and a stolen password alone must not open it.
 */
export function accessRefusal(
  operator: CommerceOperator | undefined,
): AccessRefusal | undefined {
  if (!operator) return "notSignedIn";
  if (operator.factors.length === 0) return "noSecondFactor";
  if (operator.assurance !== "aal2") return "secondFactorNotVerified";
  if (!operator.administersCommerce) return "notACommerceOperator";
  return undefined;
}

/** Whether this session may see and change commerce data. */
export function administersCommerce(
  operator: CommerceOperator | undefined,
): operator is CommerceOperator {
  return accessRefusal(operator) === undefined;
}

/**
 * Whether this staff member may still enrol a factor without one of their own.
 *
 * The one thing a session at assurance level 1 may do, and it exists so a new
 * staff member can set their account up. Someone who already has a factor has
 * to prove it before adding a second, or a stolen password would be enough to
 * enrol a "backup" nobody asked for.
 */
export function mayEnrolSecondFactor(
  operator: CommerceOperator | undefined,
): operator is CommerceOperator {
  if (!operator) return false;
  return operator.factors.length === 0 || operator.assurance === "aal2";
}
