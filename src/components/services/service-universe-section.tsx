import { Reveal } from "@/components/primitives/reveal";
import { ServicePackCard } from "@/components/services/service-pack-card";
import type { ServiceUniverse } from "@/managed-content/types";
import type { ServiceEnquiryContext } from "@/service-enquiry/enquiry";

interface ServiceUniverseSectionProps {
  universe: ServiceUniverse;
  serviceEnquiry: ServiceEnquiryContext;
}

/**
 * One universe and its packs, in the order Managed Content lists them.
 *
 * The heading names the universe alone — "Entreprises", not "Nos offres
 * Entreprises" — so the section landmark, the page's heading outline and the
 * portfolio's filter for the same universe all read as the one word.
 */
export function ServiceUniverseSection({
  universe,
  serviceEnquiry,
}: ServiceUniverseSectionProps) {
  const headingId = `universe-${universe.key}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="border-t border-wc-line-dark py-section-sm"
    >
      <div className="wc-container">
        <Reveal className="mb-heading-gap flex flex-wrap items-baseline justify-between gap-6">
          <div>
            <p className="m-0 mb-3 text-micro tracking-28 uppercase text-wc-muted-2">
              {universe.kicker}
            </p>
            <h2 id={headingId} className="m-0 font-display text-section font-medium">
              {universe.title}
            </h2>
          </div>
          <p className="m-0 max-w-[44ch] text-body font-light text-wc-soft">
            {universe.intro}
          </p>
        </Reveal>

        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-grid-gap-lg p-0">
          {universe.packs.map((pack) => (
            <Reveal as="li" key={pack.id} className="h-full">
              <ServicePackCard
                pack={pack}
                universeTitle={universe.title}
                serviceEnquiry={serviceEnquiry}
              />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
