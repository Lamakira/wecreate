/**
 * The cache tag every published Managed Content read carries.
 *
 * Kept in its own module so route handlers can invalidate it without importing
 * the server-only read API.
 */
export const MANAGED_CONTENT_TAG = "managed-content";
