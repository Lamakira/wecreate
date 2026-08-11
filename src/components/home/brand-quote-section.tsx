import { Reveal } from "@/components/primitives/reveal";
import type { BrandQuoteContent } from "@/managed-content/types";

interface BrandQuoteSectionProps {
  section: BrandQuoteContent;
}

export function BrandQuoteSection({ section }: BrandQuoteSectionProps) {
  return (
    <section className="border-y border-wc-line-dark px-gutter py-section-lg text-center">
      <Reveal>
        <figure className="m-0">
          <blockquote className="m-0 mx-auto max-w-[20ch] font-display text-quote font-normal italic">
            {section.quote}
          </blockquote>
          <figcaption className="mt-[clamp(24px,4vw,40px)] text-micro tracking-26 uppercase text-wc-muted-2">
            {section.attribution}
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
