import type { NextConfig } from "next";

/**
 * The Content-Security-Policy the public site is served with.
 *
 * **Why there is no nonce.** The strict form of this policy names a fresh
 * random nonce per request and trusts only the scripts carrying it. Next.js is
 * explicit that generating one "must use dynamic rendering", and dynamic
 * rendering is exactly what ADR-0003 spends `cacheComponents` to avoid: a
 * public page is a prerendered shell any cache may hand to any visitor. A nonce
 * would make every marketing page render per request, trading a documented
 * performance property for header strictness. So the policy below is static,
 * and `script-src` has to admit the inline bootstrap Next.js emits — it still
 * refuses script from any origin but this one, which is how an injected
 * `<script src>` is stopped.
 *
 * What it therefore buys, in order of what actually matters here: `object-src`
 * and `base-uri` close the two injection routes that survive an origin-limited
 * `script-src`; `frame-ancestors` decides who may frame the site; `form-action`
 * keeps a form from posting somewhere else; and the fetch directives pin the
 * three external origins this application genuinely uses.
 *
 * Adding an external service means adding its origin here — see `README.md`,
 * *Security headers*.
 */
/**
 * Where this deployment's private files are handed over.
 *
 * `form-action` has to name it: pressing *Télécharger* on the Order Access page
 * is a form submission that answers with a redirect to a temporary address in
 * the commerce data plane's own storage, and browsers have never agreed on
 * whether `form-action` follows a redirect — the same disagreement FedaPay is
 * named for below.
 *
 * Derived from the data plane's own configuration rather than written out, so a
 * project moved to another Supabase host cannot leave this behind. `undefined`
 * on a deployment with no data plane, which is also one where nothing can be
 * bought and no file can be handed over.
 */
function privateStoreOrigin(): string | undefined {
  if (process.env.WECREATE_COMMERCE_PROVIDER === "fixture") {
    // The acceptance suite's private store, and the one origin here that is not
    // read from a deployment's own configuration. It is written out rather than
    // imported because this file is a build-time config and the fixture is a
    // server module: `PRIVATE_STORE_ORIGIN` in `src/commerce/fixture/store.ts`
    // is the value it has to agree with, and a run where it does not fails
    // immediately with a blocked download rather than quietly.
    return "https://stockage.wecreate.test";
  }
  return process.env.SUPABASE_URL
    ? new URL(process.env.SUPABASE_URL).origin
    : undefined;
}

const PUBLIC_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Sanity's Presentation tool previews the real pages in an iframe, and it is
  // served from `/studio` on this same origin. Nobody else may frame the site.
  "frame-ancestors 'self'",
  // `'self'` is where every form on this site posts, including the checkout's.
  // FedaPay is named because leaving for its hosted page is a redirect out of
  // that submission, and browsers have not agreed on whether `form-action`
  // follows one. Naming the origin costs nothing this policy was protecting —
  // a form still cannot post anywhere else — and the alternative is the exact
  // silent failure this file warns about: a buyer whose payment page never
  // opens, with only a console violation to say why.
  ["form-action 'self' https://*.fedapay.com", privateStoreOrigin()]
    .filter(Boolean)
    .join(" "),
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  // Tailwind's utilities are a stylesheet, but the poster frame in
  // `src/video-playback/video-player.tsx` and Mux's player element both set
  // style attributes from JavaScript.
  "style-src 'self' 'unsafe-inline'",
  // Editorial images come from Sanity's asset CDN, video posters from Mux's.
  //
  // `*.mux.com` rather than the two hostnames the code names. A playback URL
  // starts at `stream.mux.com`, but the manifest and segments are then served
  // from whichever CDN edge Mux picked — `manifest-…-vop1.fastly.mux.com` and
  // its siblings, chosen per request and not knowable from here. Naming only
  // `stream.mux.com` leaves the poster showing and playback failing with a
  // status-0 network error, which is exactly the silent failure this policy is
  // most likely to cause.
  "img-src 'self' data: blob: https://cdn.sanity.io https://*.mux.com",
  // An adaptive stream, and the plain files development and the acceptance
  // suite run on.
  "media-src 'self' blob: https://*.mux.com",
  // `*.litix.io` is Mux's playback telemetry, which the player sends on its own.
  // Cloudflare Web Analytics' beacon is `static.cloudflareinsights.com` (script)
  // posting to `cloudflareinsights.com` (the rum collector). Zaraz custom events
  // are same-origin `/cdn-cgi/zaraz/` once the CDN proxies the site.
  "connect-src 'self' https://cdn.sanity.io https://*.mux.com https://*.litix.io https://cloudflareinsights.com https://static.cloudflareinsights.com",
  // `public/fonts`, and nowhere else. The site loads no hosted font service.
  "font-src 'self'",
  "frame-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

/**
 * The same policy, relaxed for the Studio at `/studio`.
 *
 * The Studio is a vendor-built single-page application, not a page this
 * repository renders: it evaluates code at runtime, talks to Sanity's API and
 * its websocket, and handles asset uploads through blob URLs. None of that is
 * true of the public site, so widening the public policy to cover it would
 * weaken every marketing page for the sake of one authenticated admin surface.
 *
 * `frame-ancestors` stays `'self'` — this is the document that *does* the
 * framing, not one that should be framed.
 */
const STUDIO_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.sanity.io https://*.mux.com",
  "media-src 'self' blob: https://*.sanity.io https://*.mux.com",
  // Not `registry.npmjs.org`: the Studio polls it to check whether a newer
  // `sanity` has been published, and that fetch already fails on its own — it
  // is refused before the policy ever sees it, so allowing the origin adds
  // reach without fixing anything.
  "connect-src 'self' https://*.sanity.io wss://*.sanity.io https://*.mux.com https://*.litix.io",
  "font-src 'self' data: https://*.sanity.io",
  // The Presentation tool frames the public site, which is this same origin.
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
].join("; ");

/**
 * Everything that is true of every response, whatever it serves.
 *
 * No `X-Frame-Options`: Next.js' own guidance is that `frame-ancestors`
 * supersedes it, and the two saying the same thing in two syntaxes is one more
 * place for them to disagree.
 */
const BASELINE_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Two years, matching what a preload submission would require, without the
  // preload commitment itself. Ignored by browsers over plain HTTP, so local
  // development and the acceptance suite are unaffected.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // The site asks for none of these. `fullscreen` is the exception: the video
  // player's own control needs it.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self)",
  },
];

const nextConfig: NextConfig = {
  /**
   * Emit `.next/standalone`: the server, plus only the parts of `node_modules`
   * the build traced as reachable.
   *
   * This is what makes ADR-0011's deployment an artifact swap. The server it
   * runs on has two cores and somebody else's site on them, so `next build`
   * must never happen there — but neither should `pnpm install`, which is
   * minutes of CPU and a network dependency at the worst possible moment. A
   * standalone bundle needs neither: CI builds it, the deployment unpacks it,
   * and a rollback is a symlink pointing at the previous one.
   *
   * It changes nothing locally. `pnpm build` still produces the same `.next`
   * it always did and `pnpm start` still serves it, which is what the
   * acceptance suite runs; the standalone tree is written alongside.
   */
  output: "standalone",
  /**
   * Two rules, deliberately overlapping. Next.js applies every rule whose
   * source matches and lets a later rule override an earlier one for the same
   * header key, so `/studio` picks up the baseline from the first rule and
   * replaces only its Content-Security-Policy.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...BASELINE_HEADERS,
          {
            key: "Content-Security-Policy",
            value: PUBLIC_CONTENT_SECURITY_POLICY,
          },
        ],
      },
      {
        source: "/studio/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: STUDIO_CONTENT_SECURITY_POLICY,
          },
        ],
      },
    ];
  },
  // Cache Components gives us the split ADR-0003 asks for: public pages render from a
  // prerendered, globally cacheable shell, and only explicitly uncached work reaches a
  // server at request time.
  cacheComponents: true,
  cacheLife: {
    // Managed Content is invalidated on publish through /api/revalidate. The timings below
    // are the safety net for when a publish webhook is missed, not the primary mechanism.
    managedContent: {
      stale: 300,
      revalidate: 3600,
      expire: 86400,
    },
    // Which products have an activated Paid Deliverable Version. Expired
    // outright when a Commerce Operator activates one, so these are the safety
    // net for a deployment where that never reached this instance. Shorter than
    // the content profile: this is the difference between a product being on
    // sale and not.
    paidDeliverables: {
      stale: 60,
      revalidate: 300,
      expire: 3600,
    },
  },
  experimental: {
    serverActions: {
      // A Paid Deliverable is uploaded through the back office rather than
      // straight to storage, so the request carries the file. One megabyte
      // above MAX_DELIVERABLE_BYTES in `src/commerce/paid-deliverables.ts`,
      // because this bounds the whole multipart body rather than the file
      // inside it — a file at the cap would otherwise be refused by the
      // framework before the application could say why. The README records what
      // a platform with a smaller request limit of its own needs before real
      // deliverables can be uploaded there.
      bodySizeLimit: "26mb",
    },
  },
  images: {
    // Editorial images are served from Sanity's asset CDN.
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default nextConfig;
