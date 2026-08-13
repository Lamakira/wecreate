/**
 * The cache tag the public read of activated Paid Deliverables carries.
 *
 * In its own module so a server action can expire it without importing the
 * server-only read API, exactly as `managed-content/tag.ts` is.
 */
export const PAID_DELIVERABLES_TAG = "paid-deliverables";
