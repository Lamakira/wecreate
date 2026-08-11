import type { ContentPerspective, SiteContent } from "./types";

export type ManagedContentProviderId = "sanity" | "fixture";

/**
 * The single outbound boundary between WeCreate and its content management
 * system.
 *
 * Everything the application knows about Managed Content arrives through this
 * interface. Acceptance tests run the real application against the `fixture`
 * implementation, which is why no test ever needs to mock a component, a hook
 * or a query helper.
 */
export interface ManagedContentProvider {
  readonly id: ManagedContentProviderId;
  read(perspective: ContentPerspective): Promise<SiteContent>;
}

/**
 * Which provider this process talks to.
 *
 * `WECREATE_CONTENT_PROVIDER` is explicit and wins. Otherwise a configured
 * Sanity project selects Sanity, and an unconfigured checkout falls back to the
 * fixture provider so `pnpm dev` and the acceptance suite both run with no
 * production credentials.
 */
export function resolveManagedContentProviderId(): ManagedContentProviderId {
  const configured = process.env.WECREATE_CONTENT_PROVIDER;
  if (configured === "fixture" || configured === "sanity") {
    return configured;
  }
  return process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ? "sanity" : "fixture";
}

export async function getManagedContentProvider(): Promise<ManagedContentProvider> {
  if (resolveManagedContentProviderId() === "fixture") {
    const { fixtureContentProvider } = await import("./fixture/provider");
    return fixtureContentProvider;
  }

  // Imported lazily so a fixture-backed run never loads the Sanity client or
  // requires its environment variables to be present.
  const { sanityContentProvider } = await import("./sanity/provider");
  return sanityContentProvider;
}
