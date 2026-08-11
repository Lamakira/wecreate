import { CtaLink } from "@/components/primitives/cta-link";
import { Reveal } from "@/components/primitives/reveal";
import { SplitHeading } from "@/components/primitives/split-heading";
import type { FinalCtaContent } from "@/managed-content/types";

interface FinalCtaSectionProps {
  section: FinalCtaContent;
}

/**
 * The closing call to action.
 *
 * WhatsApp is the primary route into a conversation and the Contact page the
 * secondary one. Neither creates an order, a reservation or a payment: talking
 * to WeCreate is a Service Enquiry (ADR-0006).
 */
export function FinalCtaSection({ section }: FinalCtaSectionProps) {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="mx-auto max-w-prose px-gutter py-section-lg text-center"
    >
      <Reveal>
        <SplitHeading
          as="h2"
          id="final-cta-heading"
          headline={section.headline}
          className="m-0 font-display text-cta-heading font-medium"
        />
      </Reveal>
      <Reveal>
        <p className="mt-6 mb-[34px] text-[15px] font-light text-wc-soft">
          {section.subtitle}
        </p>
      </Reveal>
      <Reveal className="flex flex-wrap justify-center gap-3">
        <CtaLink cta={section.primaryCta} variant="solid" className="px-[30px] py-[18px]" />
        <CtaLink cta={section.secondaryCta} variant="ghost" className="px-[30px] py-[18px]" />
      </Reveal>
    </section>
  );
}
