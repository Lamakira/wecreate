import { MediaFrame } from "@/components/primitives/media-frame";
import { Reveal } from "@/components/primitives/reveal";
import type { AboutStoryContent } from "@/managed-content/types";

interface AboutStorySectionProps {
  story: AboutStoryContent;
}

/**
 * WeCreate's story, beside the studio portrait.
 *
 * The portrait is a `MediaFrame`, so until a real photograph is uploaded the
 * slot renders the design handoff's labelled grey frame at 4:5. That is the
 * point: an empty slot has to look like an empty slot, never like a photograph
 * WeCreate approved, and it reserves the same space either way so dropping the
 * real one in later cannot shift the page.
 *
 * The line under the paragraphs is a brand statement WeCreate has approved, not
 * a testimonial — nobody is quoted, and no client is named.
 */
export function AboutStorySection({ story }: AboutStorySectionProps) {
  return (
    <section
      data-testid="about-story"
      className="wc-container grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(28px,4vw,72px)] pb-section-sm"
    >
      <Reveal>
        <MediaFrame
          media={story.portrait}
          surface="dark-soft"
          sizes="(max-width: 900px) 100vw, 45vw"
        />
      </Reveal>

      <Reveal>
        {story.paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="m-0 mb-[22px] text-[16px] font-light leading-[1.85] text-wc-soft"
          >
            {paragraph}
          </p>
        ))}
        <p className="m-0 mt-[34px] font-display text-[clamp(22px,2.6vw,34px)] leading-[1.35] italic">
          {story.brandStatement}
        </p>
      </Reveal>
    </section>
  );
}
