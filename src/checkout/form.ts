import { EMPTY_GUEST_FORM, type GuestField, type GuestFormValues, type GuestRefusal } from "./guest";
import type { CheckoutMessageKey } from "./messages";

/**
 * What the guest form knows between one submission and the next.
 *
 * Its own module rather than `actions.ts`, because a `"use server"` file may
 * only export functions: the starting value below would be a build error there.
 */
export interface CheckoutFormState {
  /** At most one refusal per field, so each prints beside its own input. */
  refusals: Partial<Record<GuestField, GuestRefusal>>;
  /** Something that is not about a field, in words the buyer can act on. */
  message: CheckoutMessageKey | null;
  /** What the buyer typed, so a refusal does not cost them their typing. */
  values: GuestFormValues;
}

export const INITIAL_CHECKOUT_FORM: CheckoutFormState = {
  refusals: {},
  message: null,
  values: EMPTY_GUEST_FORM,
};
