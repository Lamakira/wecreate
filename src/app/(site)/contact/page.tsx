import type { Metadata } from "next";

import { ContactFormSection } from "@/components/contact/contact-form-section";
import { ContactChannelsSection } from "@/components/contact/contact-channels-section";
import { GettingStartedSection } from "@/components/contact/getting-started-section";
import { SplitHeading } from "@/components/primitives/split-heading";
import { SitePage } from "@/components/shell/site-page";
import { readContactPage } from "@/managed-content";
import { pageMetadata } from "@/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readContactPage();
  const { seo } = content.contact;

  return {
    ...pageMetadata(content.settings.seo, {
      title: seo.title,
      description: seo.description,
      imageUrl: seo.openGraphImageUrl,
    }),
    alternates: { canonical: "/contact" },
  };
}

/**
 * The Contact page.
 *
 * The form first, as in the design: describe the project and it arrives by email
 * at WeCreate. Beside it, the three other ways to reach WeCreate — WhatsApp, the
 * hosted Discovery Call, the administrative email — then how a project actually
 * starts. The order in the source is the order a visitor reads on a phone.
 *
 * The form is back (ADR-0012 amends ADR-0006): it emails WeCreate and stores
 * nothing — no endpoint to read from, no stored lead, no cookie.
 */
export default async function ContactPage() {
  const content = await readContactPage();
  const { contact, settings } = content;

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
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
        <ContactFormSection whatsappUrl={settings.contact.whatsappUrl} />
        <div className="flex flex-col gap-[clamp(48px,6vw,80px)]">
          <ContactChannelsSection
            channels={contact.channels}
            contact={settings.contact}
            socialAccounts={settings.socialAccounts}
          />
          <GettingStartedSection gettingStarted={contact.gettingStarted} />
        </div>
      </div>
    </SitePage>
  );
}
