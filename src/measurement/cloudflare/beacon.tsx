"use client";

import Script from "next/script";
import { useEffect } from "react";

import { ensureZarazQueue, track } from "@/measurement/cloudflare/track";
import type { ServiceEnquiryDestination } from "@/measurement/events";

/**
 * Cloudflare Web Analytics' public site token.
 *
 * Compiled in, like every `NEXT_PUBLIC_*` value. Absent on a deployment that
 * has not created a Web Analytics property yet — page views then go uncounted
 * and the rest of the site is unaffected.
 */
export function cloudflareBeaconToken(): string {
  return process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "";
}

function enquiryFromDataset(
  value: string | undefined,
): ServiceEnquiryDestination | null {
  return value === "whatsapp" || value === "discovery_call" ? value : null;
}

/**
 * Page views, field Core Web Vitals, and the click listener for Service Enquiry
 * destinations.
 *
 * The beacon is Cloudflare Web Analytics: cookie-less, no fingerprinting, and
 * the field CWV collector ADR-0011 asks for now that the site is not on a
 * hosting platform that ships its own. Custom events go through Zaraz, which
 * the CDN injects in production; the click listener calls `zaraz.track` and
 * never `preventDefault`, so a blocked or missing analytics script cannot
 * swallow a WhatsApp or Calendly link.
 */
export function CloudflareMeasurement() {
  const token = cloudflareBeaconToken();

  useEffect(() => {
    ensureZarazQueue();

    function onClick(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const host = target.closest<HTMLElement>("[data-enquiry]");
      const destination = enquiryFromDataset(host?.dataset.enquiry);
      if (!destination) {
        return;
      }
      track({ name: "service_enquiry", destination });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!token) {
    return null;
  }

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token, spa: true })}
    />
  );
}
