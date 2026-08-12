import type { Metadata } from "next";

import { SplitHeading } from "@/components/primitives/split-heading";
import { ServiceAddOnsSection } from "@/components/services/service-add-ons-section";
import { ServiceComparisonSection } from "@/components/services/service-comparison-section";
import { ServiceEnquiryNotice } from "@/components/services/service-enquiry-notice";
import { ServiceUniverseSection } from "@/components/services/service-universe-section";
import { readServices, readSiteSettings } from "@/managed-content";
import type { ServiceEnquiryContext } from "@/service-enquiry/enquiry";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await readServices();

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/services" },
    openGraph: {
      title: seo.title,
      description: seo.description,
      images: seo.openGraphImageUrl ? [seo.openGraphImageUrl] : undefined,
    },
  };
}

/**
 * The Services page.
 *
 * WeCreate's method, then the three universes and their packs, then the
 * Entreprises comparison and the add-ons — a fixed sequence, like the homepage,
 * whose copy, prices and order an editor owns but whose structure they do not.
 *
 * Every offer here ends outside the site, in a prefilled WhatsApp conversation
 * or on WeCreate's hosted Discovery Call page. Nothing on this page adds to the
 * Digital Cart, creates an Order Snapshot or touches FedaPay, and nothing can:
 * the page renders links, and the cart only ever accepts Digital Products
 * (ADR-0006).
 */
export default async function ServicesPage() {
  const services = await readServices();
  const settings = await readSiteSettings();

  // Where a service offer goes, and what its buttons say. Assembled once here
  // because the destinations are global contact details while the wording
  // belongs to this page.
  const serviceEnquiry: ServiceEnquiryContext = {
    enquiry: services.enquiry,
    contact: settings.contact,
    onRequestLabel: services.onRequestLabel,
  };

  return (
    <>
      <section className="wc-container pt-[clamp(28px,5vw,64px)] pb-section-sm">
        <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-muted-2">
          {services.kicker}
        </p>
        <SplitHeading
          as="h1"
          headline={services.headline}
          className="m-0 max-w-[24ch] font-display text-page-title font-medium"
        />
        <div className="mt-heading-gap-lg grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[clamp(20px,3vw,44px)] border-t border-wc-line-dark pt-[34px]">
          {services.methodColumns.map((column) => (
            <p
              key={column}
              className="m-0 text-[15px] font-light leading-[1.75] text-wc-soft"
            >
              {column}
            </p>
          ))}
        </div>
      </section>

      <ServiceEnquiryNotice serviceEnquiry={serviceEnquiry} />

      {services.universes.map((universe) => (
        <ServiceUniverseSection
          key={universe.key}
          universe={universe}
          serviceEnquiry={serviceEnquiry}
        />
      ))}

      {services.comparison.isVisible ? (
        <ServiceComparisonSection comparison={services.comparison} />
      ) : null}

      {services.addOns.isVisible ? (
        <ServiceAddOnsSection section={services.addOns} />
      ) : null}
    </>
  );
}
