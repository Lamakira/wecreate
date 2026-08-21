/**
 * Requests that left this origin, ignoring Cloudflare Web Analytics.
 *
 * The cookie-less beacon is the CDN's own measurement (ADR-0011). The suite
 * compiles a token into the test build so it can see the snippet; these
 * assertions still refuse Calendly widgets, Supabase, and every other
 * third party on a public page.
 */
export function thirdPartyRequests(urls: string[], origin: string): string[] {
  return urls.filter(
    (url) =>
      !url.startsWith(origin) &&
      !/^https:\/\/(static\.)?cloudflareinsights\.com(?:\/|$)/i.test(url),
  );
}
