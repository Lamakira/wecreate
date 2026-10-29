import { Reveal } from "@/components/primitives/reveal";
import { ServicePackCard } from "@/components/services/service-pack-card";
import type { BrandingOfferContent } from "@/managed-content/types";
import { contactFormPath } from "@/service-enquiry/contact-form";
import type { ServiceEnquiryContext } from "@/service-enquiry/enquiry";

interface BrandingOfferSectionProps {
  branding: BrandingOfferContent;
  serviceEnquiry: ServiceEnquiryContext;
}

/**
 * The Branding packs, then the conditions they are sold under.
 *
 * Branding is sold through conversation like every other service: each pack
 * ends in a prefilled WhatsApp message, the hosted Discovery Call, or the
 * contact form with its subject set to Branding — never in the Digital Cart.
 * The conditions are stated so a client can prepare; nothing here enforces
 * them.
 *
 * The section stays black and white. A Discipline's colours belong on that
 * Discipline's own pages only (spec #55 decision 4), and this one sits on the
 * shared Services page.
 */
export function BrandingOfferSection({
  branding,
  serviceEnquiry,
}: BrandingOfferSectionProps) {
  const { conditions } = branding;

  return (
    <>
      <section
        id="branding"
        aria-labelledby="branding-offer-heading"
        data-testid="branding-offer"
        className="border-t border-wc-line py-section-sm"
      >
        <div className="wc-container">
          <Reveal className="mb-heading-gap flex flex-wrap items-baseline justify-between gap-6">
            <div>
              <p className="m-0 mb-3 text-micro tracking-28 uppercase text-wc-text-muted">
                {branding.kicker}
              </p>
              <h2
                id="branding-offer-heading"
                className="m-0 font-display text-section font-medium"
              >
                {branding.title}
              </h2>
            </div>
            {branding.intro ? (
              <p className="m-0 max-w-[44ch] text-body font-light text-wc-text-soft">
                {branding.intro}
              </p>
            ) : null}
          </Reveal>

          <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-grid-gap-lg p-0">
            {branding.packs.map((pack) => (
              <Reveal as="li" key={pack.id} className="h-full">
                <ServicePackCard
                  pack={pack}
                  universeTitle={branding.title}
                  serviceEnquiry={serviceEnquiry}
                  contactForm={{
                    label: branding.contactFormLabel,
                    href: contactFormPath("branding"),
                  }}
                />
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {conditions.conditions.length > 0 ? (
        <section
          aria-labelledby="branding-conditions-heading"
          data-testid="branding-conditions"
          className="wc-container pb-section-sm"
        >
          <Reveal className="mb-heading-gap">
            <p className="m-0 mb-3 text-micro tracking-28 uppercase text-wc-text-muted">
              {conditions.kicker}
            </p>
            <h2
              id="branding-conditions-heading"
              className="m-0 font-display text-section font-medium"
            >
              {conditions.title}
            </h2>
          </Reveal>

          <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-grid-gap-lg p-0">
            {conditions.conditions.map((condition) => (
              <Reveal
                as="li"
                key={condition.key}
                className="border-t border-wc-line pt-[18px]"
              >
                <h3 className="m-0 mb-2 text-[15px] font-medium">
                  {condition.title}
                </h3>
                <p className="m-0 text-body-sm font-light text-wc-text-muted">
                  {condition.text}
                </p>
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
