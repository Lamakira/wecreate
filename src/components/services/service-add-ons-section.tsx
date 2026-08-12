import { Reveal } from "@/components/primitives/reveal";
import { formatXof } from "@/lib/format";
import type { ServiceAddOnsContent } from "@/managed-content/types";

interface ServiceAddOnsSectionProps {
  section: ServiceAddOnsContent;
}

/**
 * The options sold alongside a pack.
 *
 * Priced in whole XOF like everything else WeCreate publishes, and just as
 * uncommerced: an add-on is part of the conversation a pack opens, never a line
 * a visitor can add to anything here.
 */
export function ServiceAddOnsSection({ section }: ServiceAddOnsSectionProps) {
  return (
    <section
      aria-labelledby="service-add-ons-heading"
      className="wc-container py-section-sm"
    >
      <Reveal>
        <p className="m-0 mb-3.5 text-micro tracking-30 uppercase text-wc-muted-2">
          {section.kicker}
        </p>
        <h2
          id="service-add-ons-heading"
          className="m-0 mb-heading-gap font-display text-[clamp(28px,4.2vw,58px)] font-medium"
        >
          {section.title}
        </h2>
      </Reveal>

      <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-grid-gap p-0">
        {section.addOns.map((addOn) => (
          <Reveal
            as="li"
            key={addOn.key}
            className="border-t border-wc-line-dark pt-5"
          >
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="m-0 text-[15px] font-medium">{addOn.title}</h3>
              <p className="m-0 text-right text-body-sm font-semibold whitespace-nowrap">
                {formatXof(addOn.priceXof)}
                {addOn.priceUnit ? (
                  <span className="block text-micro font-normal tracking-16 uppercase text-wc-muted-2">
                    {addOn.priceUnit}
                  </span>
                ) : null}
              </p>
            </div>
            <p className="m-0 text-body-sm font-light text-wc-muted-2">
              {addOn.description}
            </p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
