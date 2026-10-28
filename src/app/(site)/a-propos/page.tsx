import type { Metadata } from "next";

import { AboutCoverage } from "@/components/about/about-coverage";
import { AboutMethodSection } from "@/components/about/about-method-section";
import { AboutStorySection } from "@/components/about/about-story-section";
import { CapabilityColumn } from "@/components/about/capability-column";
import { SplitHeading } from "@/components/primitives/split-heading";
import { SitePage } from "@/components/shell/site-page";
import { readAboutPage } from "@/managed-content";
import { pageMetadata } from "@/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readAboutPage();
  const { seo } = content.about;

  return {
    ...pageMetadata(content.settings.seo, {
      title: seo.title,
      description: seo.description,
      imageUrl: seo.openGraphImageUrl,
    }),
    alternates: { canonical: "/a-propos" },
  };
}

/**
 * The À propos page.
 *
 * WeCreate's story and its portrait, then the method on the light band, then
 * what the studio is made of and where it works — a fixed sequence whose copy
 * an editor owns and whose structure they do not (ADR-0001).
 *
 * Nothing on this page stands in for approved content without saying so: the
 * portrait renders a labelled placeholder frame until a photograph exists, the
 * team column names roles rather than people, the brand statement is the
 * brief's own promise, and no client is quoted anywhere.
 */
export default async function AProposPage() {
  const content = await readAboutPage();
  const { about } = content;

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
      <section className="wc-container pt-[clamp(28px,5vw,64px)] pb-section-sm">
        <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-text-muted">
          {about.kicker}
        </p>
        <SplitHeading
          as="h1"
          headline={about.headline}
          className="m-0 max-w-[26ch] font-display text-page-title font-medium"
        />
      </section>

      <AboutStorySection story={about.story} />

      {about.method.isVisible ? (
        <AboutMethodSection method={about.method} />
      ) : null}

      <div className="wc-container grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start gap-[clamp(28px,4vw,64px)] py-section-sm">
        <CapabilityColumn column={about.team} id="about-team" />
        <CapabilityColumn column={about.equipment} id="about-equipment" />
        <AboutCoverage coverage={about.coverage} />
      </div>
    </SitePage>
  );
}
