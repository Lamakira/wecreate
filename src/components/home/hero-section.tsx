import { CtaLink } from "@/components/primitives/cta-link";
import { SplitHeading } from "@/components/primitives/split-heading";
import { HeroBackdrop } from "@/components/home/hero-backdrop";
import { HeroPlayback } from "@/components/home/hero-playback";
import type { HeroContent } from "@/managed-content/types";

interface HeroSectionProps {
  hero: HeroContent;
}

/**
 * The hero.
 *
 * Fills the viewport, edge to edge and behind the fixed header.
 *
 * Four layers, each one optional except the first:
 *
 * 1. the gradient and halo — the design's baseline, always painted, and what a
 *    visitor sees when everything above it is absent;
 * 2. the generated WebGL background, for visitors who have not asked for less
 *    motion and whose device can run it;
 * 3. an optional Playback Asset, when Managed Content has one;
 * 4. the copy, which never depends on any of the above.
 */
export function HeroSection({ hero }: HeroSectionProps) {
  return (
    // Fills the viewport edge to edge. The negative margin cancels the padding
    // `main` uses to clear the fixed header, so the background runs up behind
    // the header — which is translucent and meant to sit over content — and
    // `min-h-dvh` follows the *dynamic* viewport, so mobile browser chrome
    // retracting does not leave a strip of the next section showing.
    <section
      data-testid="hero"
      className="relative -mt-header-offset flex min-h-dvh flex-col justify-end overflow-hidden pt-header-offset pb-section-xs"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(115deg,#141414_0%,#000_45%,#1A1A1A_100%)]"
      />
      <HeroBackdrop />
      {hero.playbackAsset ? <HeroPlayback playback={hero.playbackAsset} /> : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,rgba(255,255,255,.10),transparent_60%)]"
      />

      <div className="wc-container relative">
        <div className="max-w-hero animate-wc-fade">
          {/* `text-wc-soft` rather than the `text-wc-muted-2` the other kickers
              use. This one sits over the generated background, whose pale folds
              sweep through it; at #777 it measures 2.1:1 there and cannot reach
              4.5:1 on any ground — #777's ceiling against pure black is 4.69:1.
              #BBB clears the bar with the scrim in place. */}
          <p className="m-0 mb-[clamp(20px,4vw,34px)] text-micro tracking-34 uppercase text-wc-soft">
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
