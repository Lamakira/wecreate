import { Reveal } from "@/components/primitives/reveal";
import { SectionKicker } from "@/components/primitives/section-kicker";
import { formatStepNumber } from "@/lib/format";
import type { ContactGettingStartedContent } from "@/managed-content/types";

interface GettingStartedSectionProps {
  gettingStarted: ContactGettingStartedContent;
}

/**
 * What happens after a visitor writes: contact, quote, signature, shoot.
 *
 * An ordered list, so the sequence survives for someone who cannot see the
 * numbers beside it. Signature and deposit happen off the site — this is a
 * description of how WeCreate works, not a flow the website runs (ADR-0006).
 */
export function GettingStartedSection({
  gettingStarted,
}: GettingStartedSectionProps) {
  return (
    <section aria-labelledby="contact-getting-started-heading">
      <Reveal>
        <SectionKicker as="h2" id="contact-getting-started-heading">
          {gettingStarted.kicker}
        </SectionKicker>
      </Reveal>
      <ol className="flex list-none flex-col gap-4 p-0">
        {gettingStarted.steps.map((step, index) => (
          <Reveal
            as="li"
            key={step.key}
            className="flex gap-[18px] border-t border-wc-line-dark pt-4"
          >
            <span className="pt-[3px] text-micro tracking-20 text-wc-muted-2">
              {formatStepNumber(index)}
            </span>
            <div>
              <h3 className="m-0 mb-1.5 text-[15px] font-medium">{step.title}</h3>
              <p className="m-0 text-body-sm font-light leading-[1.65] text-wc-muted-2">
                {step.description}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
