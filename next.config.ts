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
  },
  images: {
    // Editorial images are served from Sanity's asset CDN.
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default nextConfig;
