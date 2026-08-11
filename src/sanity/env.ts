/**
 * Sanity environment.
 *
 * Nothing here throws on a missing value. A checkout with no Sanity project
 * must still build, run and pass the acceptance suite; `isSanityConfigured`
 * is what the Studio route and the Sanity provider check before doing work.
 */

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

/**
 * Pinning the API version keeps query behaviour stable when Sanity ships
 * changes. Bump it deliberately, never automatically.
 */
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-08-01";

/**
 * Server-only. Grants read access to unpublished documents, so it must never
 * reach the browser and is only used on the preview path.
 */
export const readToken = process.env.SANITY_API_READ_TOKEN ?? "";

export const isSanityConfigured = projectId.length > 0;

export function assertSanityConfigured(): void {
  if (!isSanityConfigured) {
    throw new Error(
      "Sanity is not configured. Set NEXT_PUBLIC_SANITY_PROJECT_ID, or set " +
        "WECREATE_CONTENT_PROVIDER=fixture to run against the bundled fixture content.",
    );
  }
}
