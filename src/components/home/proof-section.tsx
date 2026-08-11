import { Reveal } from "@/components/primitives/reveal";
import type { ProofContent } from "@/managed-content/types";

interface ProofSectionProps {
  section: ProofContent;
}

/**
 * The white band. `data-surface="light"` flips the focus ring to black so
 * keyboard focus stays visible against the inverted background.
 */
export function ProofSection({ section }: ProofSectionProps) {
  return (
    <section
      aria-labelledby="proof-heading"
      data-surface="light"
      className="bg-wc-white px-gutter py-proof text-wc-pure"
    >
      <div className="mx-auto max-w-site">
        <Reveal>
          <h2
            id="proof-heading"
            className="m-0 mb-[clamp(32px,5vw,56px)] text-micro tracking-30 uppercase font-normal text-wc-muted-2"
          >
            {section.kicker}
          </h2>
        </Reveal>
        <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[clamp(24px,4vw,56px)] p-0">
          {section.points.map((point) => (
            <Reveal
              as="li"
              key={point.key}
              className="border-t border-wc-line-light pt-[22px]"
            >
              <p className="m-0 mb-2.5 font-display text-proof font-medium">
                {point.figure}
              </p>
              <p className="m-0 text-body-sm font-light text-wc-ink">
                {point.description}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
