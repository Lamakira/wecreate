import { CtaLink } from "@/components/primitives/cta-link";
import { Reveal } from "@/components/primitives/reveal";
import type { ServiceEnquiryContext } from "@/service-enquiry/enquiry";

interface ServiceEnquiryNoticeProps {
  serviceEnquiry: ServiceEnquiryContext;
}

/**
 * What pressing a service CTA does — stated before the packs, not after.
 *
 * The prototype sold service packs through a cart and a "Réserver" button. This
 * site does not: a service offer ends in a conversation, and version one takes
 * no service order, holds no date and collects no service payment (ADR-0006).
 * A visitor learns that here rather than discovering it in WhatsApp.
 */
export function ServiceEnquiryNotice({
  serviceEnquiry: { enquiry, contact },
}: ServiceEnquiryNoticeProps) {
  return (
    <section
      aria-labelledby="service-enquiry-heading"
      data-testid="service-enquiry-notice"
      className="wc-container pb-section-sm"
    >
      <Reveal className="border border-wc-border p-[clamp(20px,3vw,32px)]">
        <h2
          id="service-enquiry-heading"
          className="m-0 mb-3.5 text-micro tracking-30 uppercase font-medium text-wc-muted-2"
        >
          {enquiry.title}
        </h2>
        <p className="m-0 max-w-[68ch] text-body-lg font-light text-wc-soft">
          {enquiry.notice}
        </p>
        <p className="m-0 mt-3 max-w-[68ch] text-body-sm font-light text-wc-muted-2">
          {enquiry.discoveryCallNote}
        </p>
        <div className="mt-heading-gap flex flex-wrap gap-3">
          <CtaLink
            cta={{ label: contact.whatsappLabel, href: contact.whatsappUrl }}
            variant="solid"
          />
          <CtaLink
            cta={{
              label: contact.discoveryCallLabel,
              href: contact.discoveryCallUrl,
            }}
            variant="ghost"
          />
        </div>
      </Reveal>
    </section>
  );
}
