import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
