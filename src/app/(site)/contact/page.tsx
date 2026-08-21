import type { Metadata } from "next";

import { ContactChannelsSection } from "@/components/contact/contact-channels-section";
import { GettingStartedSection } from "@/components/contact/getting-started-section";
import { SplitHeading } from "@/components/primitives/split-heading";
import { readContact, readSiteSettings } from "@/managed-content";
import { pageOpenGraph } from "@/seo/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await readContact();

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/contact" },
    openGraph: await pageOpenGraph({
      title: seo.title,
      description: seo.description,
      imageUrl: seo.openGraphImageUrl,
    }),
  };
}

/**
 * The Contact page.
 *
 * Three ways to reach WeCreate — WhatsApp, the hosted Discovery Call, the
 * administrative email — then how a project actually starts. The channels come
 * first in the source, so the order a visitor reads on a phone is the order they
 * would want: how to write, then what happens next.
 *
 * The design prototype's five-field form is not here and cannot come back: issue
 * #1 removed the generic service enquiry, so this page renders links and holds
 * no state, no endpoint and no stored lead (ADR-0006).
 */
export default async function ContactPage() {
  const contact = await readContact();
  const settings = await readSiteSettings();

  return (
    <>
      <section className="wc-container pt-[clamp(28px,5vw,64px)] pb-section-sm">
        <p className="m-0 mb-[22px] text-micro tracking-32 uppercase text-wc-muted-2">
          {contact.kicker}
        </p>
        <SplitHeading
          as="h1"
          headline={contact.headline}
          className="m-0 max-w-[22ch] font-display text-page-title font-medium"
        />
        <p className="mt-heading-gap max-w-[52ch] text-body-lg font-light text-wc-soft">
          {contact.responseExpectation}
        </p>
      </section>

      <div className="wc-container grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] items-start gap-[clamp(28px,4vw,72px)] pb-section-sm">
        <ContactChannelsSection
          channels={contact.channels}
          contact={settings.contact}
          socialAccounts={settings.socialAccounts}
        />
        <GettingStartedSection gettingStarted={contact.gettingStarted} />
      </div>
    </>
  );
}
