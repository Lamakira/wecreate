/**
 * Deployment-level configuration, as opposed to Managed Content.
 *
 * These values differ between local, staging and production and are owned by
 * whoever deploys the application — never by an editor.
 */

/** Absolute origin of this deployment, used for canonical URLs and previews. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Staging and preview deployments must never be indexed. Only an explicitly
 * flagged production deployment is crawlable.
 */
export function isIndexable(): boolean {
  return process.env.WECREATE_ALLOW_INDEXING === "true";
}

/**
 * Routes that must stay out of search results whatever the environment.
 *
 * Only paths that exist today. Later tickets add their own transaction and
 * Order Access surfaces here as they build them, rather than this file guessing
 * their URLs in advance.
 */
export const NON_INDEXABLE_PATHS = ["/studio", "/api"] as const;

/** Whether a path may appear in search results and in the sitemap. */
export function isIndexablePath(path: string): boolean {
  return !NON_INDEXABLE_PATHS.some(
    (excluded) => path === excluded || path.startsWith(`${excluded}/`),
  );
}

/** Shared secret that lets a non-Sanity client open a preview session. */
export function previewSecret(): string {
  return process.env.WECREATE_PREVIEW_SECRET ?? "";
}

/** Shared secret accepted by the cache revalidation endpoint. */
export function revalidateSecret(): string {
  return process.env.WECREATE_REVALIDATE_SECRET ?? "";
}

/**
 * Test-only HTTP hooks that let the acceptance suite drive the fixture content
 * provider. Disabled unless explicitly switched on, and refused outright unless
 * the application is running on fixture content.
 */
export function areTestHooksEnabled(): boolean {
  return (
    process.env.WECREATE_TEST_HOOKS === "1" &&
    process.env.WECREATE_CONTENT_PROVIDER === "fixture"
  );
}
