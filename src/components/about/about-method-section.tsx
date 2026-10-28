import { Reveal } from "@/components/primitives/reveal";
import { formatStepNumber } from "@/lib/format";
import type { AboutMethodContent } from "@/managed-content/types";

interface AboutMethodSectionProps {
  method: AboutMethodContent;
}

/**
 * How WeCreate works, on the light band.
 *
 * An ordered list, because the four steps happen in that order and a visitor
 * who cannot see the numbers still needs to know it. `data-surface="inverse"`
 * flips the focus ring so keyboard focus stays visible here.
 */
export function AboutMethodSection({ method }: AboutMethodSectionProps) {
  return (
    <section
      aria-labelledby="about-method-heading"
      data-surface="inverse"
      className="bg-wc-inverse py-section-sm text-wc-inverse-text"
    >
      <div className="wc-container">
        <Reveal>
          <p className="m-0 mb-3.5 text-micro tracking-30 uppercase text-wc-inverse-muted">
            {method.kicker}
          </p>
          <h2
            id="about-method-heading"
            className="m-0 mb-heading-gap font-display text-[clamp(28px,4.2vw,58px)] font-medium"
          >
            {method.title}
          </h2>
        </Reveal>

        <ol className="grid list-none grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-[clamp(20px,3vw,44px)] p-0">
          {method.steps.map((step, index) => (
            <Reveal
              as="li"
              key={step.key}
              className="border-t border-wc-inverse-text pt-5"
            >
              <p className="m-0 mb-3 text-micro tracking-24 text-wc-inverse-muted">
                {formatStepNumber(index)}
              </p>
              <h3 className="m-0 mb-2.5 font-display text-[24px] font-medium">
                {step.title}
              </h3>
              <p className="m-0 text-body-sm font-light text-wc-inverse-ink">
                {step.description}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
