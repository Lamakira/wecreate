import { CtaLink } from "@/components/primitives/cta-link";
import { Reveal } from "@/components/primitives/reveal";
import { SectionKicker } from "@/components/primitives/section-kicker";
import type { AboutCoverageContent } from "@/managed-content/types";

interface AboutCoverageProps {
  coverage: AboutCoverageContent;
}

/**
 * Where WeCreate films, and the way from reading about it into talking about it.
 *
 * The link goes to Contact rather than straight to WhatsApp: a visitor who has
 * just read the studio's story is choosing how to reach it, and Contact is where
 * all three channels sit side by side.
 */
export function AboutCoverage({ coverage }: AboutCoverageProps) {
  return (
    <section aria-labelledby="about-coverage-heading">
      <Reveal>
        <SectionKicker as="h2" id="about-coverage-heading">
          {coverage.kicker}
        </SectionKicker>
        <p className="m-0 mb-5 text-[15px] font-light leading-[1.8] text-wc-soft">
          {coverage.text}
        </p>
        <CtaLink cta={coverage.link} variant="underline" />
      </Reveal>
    </section>
  );
}
