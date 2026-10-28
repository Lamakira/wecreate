import { Reveal } from "@/components/primitives/reveal";
import type { ProofContent } from "@/managed-content/types";

interface ProofSectionProps {
  section: ProofContent;
}

/**
 * The inverted band — white in Vidéographie. `data-surface="inverse"` flips the
 * focus ring to the band's own text colour so keyboard focus stays visible on it.
 */
export function ProofSection({ section }: ProofSectionProps) {
  return (
    <section
      aria-labelledby="proof-heading"
      data-surface="inverse"
      className="bg-wc-inverse py-proof text-wc-inverse-text"
    >
      <div className="wc-container">
        <Reveal>
          <h2
            id="proof-heading"
            className="m-0 mb-[clamp(32px,5vw,56px)] text-micro tracking-30 uppercase font-normal text-wc-inverse-muted"
          >
            {section.kicker}
          </h2>
        </Reveal>
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[clamp(24px,4vw,56px)] p-0">
          {section.points.map((point) => (
            <Reveal
              as="li"
              key={point.key}
              className="border-t border-wc-inverse-line pt-[22px]"
            >
              <p className="m-0 mb-2.5 font-display text-proof font-medium">
                {point.figure}
              </p>
              <p className="m-0 text-body-sm font-light text-wc-inverse-ink">
                {point.description}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
