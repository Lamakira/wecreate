import type { Metadata } from "next";

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
export const NON_INDEXABLE_PATHS = [
  "/studio",
  "/commerce",
  "/api",
  // Checkout. Issue #1 keeps every transaction surface out of search results,
  // and this one is a page a crawler could otherwise reach from the cart.
  "/commande",
] as const;

/** Whether a path may appear in search results and in the sitemap. */
export function isIndexablePath(path: string): boolean {
  return !NON_INDEXABLE_PATHS.some(
    (excluded) => path === excluded || path.startsWith(`${excluded}/`),
  );
}

/**
 * Page metadata that keeps one page out of search results, for a page the site
 * serves but does not want found — unapproved legal text, a superseded legal
 * revision, a preview session.
 *
 * Empty on a deployment that is not crawlable at all, and that is the point:
 * the root layout already says `noindex, nofollow` there, which is stricter
 * than this. A page-level `robots` value does not merge with the layout's, it
 * replaces it — so answering here at all would *loosen* the deployment's own
 * rule, which is how a staging site ends up in a search index.
 */
export function keepOutOfSearchResults(): Pick<Metadata, "robots"> {
  return isIndexable() ? { robots: { index: false, follow: true } } : {};
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

/**
 * The same switch for the commerce data plane, asked of its own provider.
 *
 * Separate from the content one because the two providers are selected
 * separately: a run could be on fixture content and a real Supabase project,
 * and a hook that reset WeCreate's Paid Deliverables because the *content* was
 * fake would be a catastrophe.
 */
export function areCommerceTestHooksEnabled(): boolean {
  return (
    process.env.WECREATE_TEST_HOOKS === "1" &&
    process.env.WECREATE_COMMERCE_PROVIDER === "fixture"
  );
}

/**
 * The same switch again, for the outbox.
 *
 * This one reads what the application asked its email provider to send, which
 * on a real deployment is a receipt naming a buyer, an order and an Order
 * Access token. It is gated on the *email* provider being the fixture for that
 * reason: a run backed by Resend has a real outbox, and nothing here may offer
 * a way to read it.
 */
export function areEmailTestHooksEnabled(): boolean {
  return (
    process.env.WECREATE_TEST_HOOKS === "1" &&
    process.env.WECREATE_EMAIL_PROVIDER === "fixture"
  );
}
