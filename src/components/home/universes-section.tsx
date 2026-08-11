import Link from "next/link";

import { MediaFrame } from "@/components/primitives/media-frame";
import { Reveal } from "@/components/primitives/reveal";
import type { UniversesContent } from "@/managed-content/types";

interface UniversesSectionProps {
  section: UniversesContent;
}

/** The three service universes, each linking through to the Services page. */
export function UniversesSection({ section }: UniversesSectionProps) {
  return (
    <section
      aria-labelledby="universes-heading"
      className="mx-auto max-w-site px-gutter py-section"
    >
      <Reveal className="mb-heading-gap-lg flex flex-wrap items-baseline justify-between gap-6">
        <h2
          id="universes-heading"
          className="m-0 font-display text-section font-medium"
        >
          {section.title}
        </h2>
        <p className="m-0 text-micro tracking-28 uppercase text-wc-muted-2">
          {section.kicker}
        </p>
      </Reveal>

      <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-grid-gap-lg p-0">
        {section.universes.map((universe) => (
          <Reveal as="li" key={universe.key}>
            <Link
              href={universe.href}
              className="group block h-full border border-wc-line-dark bg-wc-surface transition-[border-color,transform] duration-500 ease-signature hover:border-wc-muted hover:-translate-y-1.5"
            >
              <MediaFrame
                media={universe.media}
                surface="dark-soft"
                sizes="(max-width: 900px) 100vw, 33vw"
              />
              <div className="px-6 pt-[26px] pb-[30px]">
                <p className="m-0 mb-3 text-micro tracking-26 uppercase text-wc-muted-2">
                  {universe.kicker}
                </p>
                <h3 className="m-0 mb-3 font-display text-card-title font-medium">
                  {universe.title}
                </h3>
                <p className="m-0 mb-[18px] text-body font-light text-wc-soft">
                  {universe.description}
                </p>
                <span className="border-b border-wc-muted pb-1 text-micro tracking-20 uppercase transition-colors duration-300 group-hover:border-wc-white">
                  {universe.linkLabel}
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
