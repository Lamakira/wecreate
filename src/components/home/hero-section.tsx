import { CtaLink } from "@/components/primitives/cta-link";
import { SplitHeading } from "@/components/primitives/split-heading";
import { HeroPlayback } from "@/components/home/hero-playback";
import type { HeroContent } from "@/managed-content/types";

interface HeroSectionProps {
  hero: HeroContent;
}

/**
 * The hero.
 *
 * The gradient, halo and letterbox bands are the design's baseline; an optional
 * Playback Asset layers on top of them when one is configured and the visitor
 * has not asked for less motion. Nothing in the heading, subtitle or CTAs
 * depends on that video existing.
 */
export function HeroSection({ hero }: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[92vh] flex-col justify-end overflow-hidden pt-[clamp(28px,6vw,80px)] pb-section-xs">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(115deg,#141414_0%,#000_45%,#1A1A1A_100%)]"
      />
      {hero.playbackAsset ? <HeroPlayback playback={hero.playbackAsset} /> : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,rgba(255,255,255,.10),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-letterbox bg-wc-pure"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-letterbox bg-wc-pure"
      />

      <div className="wc-container relative">
        <div className="max-w-hero animate-wc-fade">
          <p className="m-0 mb-[clamp(20px,4vw,34px)] text-micro tracking-34 uppercase text-wc-muted-2">
            {hero.kicker}
          </p>
          <SplitHeading
            as="h1"
            headline={hero.headline}
            className="m-0 font-display text-hero font-medium text-balance"
          />
          <p className="mt-[clamp(22px,3vw,34px)] mb-0 max-w-[52ch] text-body-lg font-light text-wc-soft">
            {hero.subtitle}
          </p>
          <div className="mt-[clamp(28px,4vw,44px)] flex flex-wrap gap-3">
            <CtaLink cta={hero.primaryCta} variant="solid" />
            <CtaLink cta={hero.secondaryCta} variant="ghost" />
          </div>
        </div>
      </div>
    </section>
  );
}
