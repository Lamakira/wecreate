"use client";

import { CloudflareMeasurement } from "@/measurement/cloudflare/beacon";

/**
 * Anonymous measurement on the public site.
 *
 * This import is what makes the measurement Cloudflare's; everything else
 * here is about page views, field Core Web Vitals and the three custom
 * events issue #16 asks for. A second provider would arrive as a second
 * import beside it (ADR-0008).
 */
export function SiteMeasurement() {
  return <CloudflareMeasurement />;
}
