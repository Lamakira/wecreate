import { CtaLink } from "@/components/primitives/cta-link";
import { Reveal } from "@/components/primitives/reveal";
import type { SiteWebOfferContent } from "@/managed-content/types";
import { contactFormPath } from "@/service-enquiry/contact-form";

interface SiteWebOfferSectionProps {
  siteWeb: SiteWebOfferContent;
}

/**
 * What WeCreate builds as websites, and the one way to ask for a quote.
 *
 * The Site web offer has no pack and no price yet (spec #55 decision 5), so
 * there is nothing to list or compare: a short presentation, then one call to
 * action that opens a Service Enquiry through the contact form with its subject
 * set to Site web — never the Digital Cart (ADR-0006).
 *
 * The section stays black and white. A Discipline's colours belong on that
 * Discipline's own pages only (spec #55 decision 4), and this one sits on the
 * shared Services page.
 */
export function SiteWebOfferSection({ siteWeb }: SiteWebOfferSectionProps) {
  return (
    <section
      id="site-web"
      aria-labelledby="site-web-offer-heading"
      data-testid="site-web-offer"
      className="border-t border-wc-line py-section-sm"
    >
      <div className="wc-container">
        <Reveal className="mb-heading-gap flex flex-wrap items-baseline justify-between gap-6">
          <div>
            <p className="m-0 mb-3 text-micro tracking-28 uppercase text-wc-text-muted">
              {siteWeb.kicker}
            </p>
            <h2
              id="site-web-offer-heading"
              className="m-0 font-display text-section font-medium"
            >
              {siteWeb.title}
            </h2>
          </div>
          {siteWeb.intro ? (
            <p className="m-0 max-w-[44ch] text-body font-light text-wc-text-soft">
              {siteWeb.intro}
            </p>
          ) : null}
        </Reveal>

        {siteWeb.formats.length > 0 ? (
          <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-grid-gap-lg p-0">
            {siteWeb.formats.map((format) => (
              <Reveal
                as="li"
                key={format.key}
                className="border-t border-wc-line pt-[18px]"
              >
                <h3 className="m-0 mb-2 text-[15px] font-medium">
                  {format.title}
                </h3>
                <p className="m-0 text-body-sm font-light text-wc-text-muted">
                  {format.description}
                </p>
              </Reveal>
            ))}
          </ul>
        ) : null}

        <Reveal className="mt-heading-gap">
          <CtaLink
            cta={{
              label: siteWeb.quoteLabel,
              href: contactFormPath("site-web"),
            }}
            variant="solid"
            size="block"
            context={siteWeb.title}
            className="sm:inline-block sm:w-auto"
          />
        </Reveal>
      </div>
    </section>
  );
}
