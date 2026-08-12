import { ContactChannel } from "@/components/contact/contact-channel";
import { Reveal } from "@/components/primitives/reveal";
import { SectionKicker } from "@/components/primitives/section-kicker";
import type {
  ContactChannelsContent,
  ContactDetails,
  SocialAccount,
} from "@/managed-content/types";

interface ContactChannelsSectionProps {
  channels: ContactChannelsContent;
  /** The addresses themselves, edited once as global contact details. */
  contact: ContactDetails;
  socialAccounts: SocialAccount[];
}

/**
 * The three approved ways to reach WeCreate, and what each is for.
 *
 * WhatsApp first because it is the fastest and the one that works on any
 * connection; the hosted Discovery Call second, so a slow or missing calendar
 * never leaves a visitor without a route; the administrative email third, for
 * the questions that are not a project.
 *
 * There is no form. The design prototype had one, and issue #1 removed it: this
 * page takes no generic service enquiry and writes nothing down, which is what
 * the notice above the channels tells the visitor before they press anything
 * (ADR-0006).
 */
export function ContactChannelsSection({
  channels,
  contact,
  socialAccounts,
}: ContactChannelsSectionProps) {
  return (
    <section aria-labelledby="contact-channels-heading">
      <Reveal>
        <SectionKicker as="h2" id="contact-channels-heading">
          {channels.kicker}
        </SectionKicker>
        <p
          data-testid="contact-notice"
          className="m-0 mb-heading-gap max-w-[52ch] text-body-lg font-light text-wc-soft"
        >
          {channels.notice}
        </p>
      </Reveal>

      <Reveal>
        <ul className="flex list-none flex-col gap-[clamp(24px,3vw,34px)] p-0">
          <ContactChannel
            href={contact.whatsappUrl}
            label={contact.whatsappLabel}
            note={channels.whatsappNote}
          />
          <ContactChannel
            href={contact.discoveryCallUrl}
            label={contact.discoveryCallLabel}
            note={channels.discoveryCallNote}
          />
          <ContactChannel
            href={`mailto:${contact.email}`}
            label={contact.email}
            announcedKind={channels.emailLabel}
            note={channels.emailNote}
          />
        </ul>
      </Reveal>

      <Reveal className="mt-heading-gap-lg">
        <SectionKicker as="h3">{channels.socialKicker}</SectionKicker>
        <ul className="flex list-none flex-wrap gap-5 p-0">
          {socialAccounts.map((account) => (
            <li key={account.url}>
              <a
                href={account.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-button tracking-20 uppercase text-wc-soft transition-colors duration-300 hover:text-wc-white"
              >
                {account.label}
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-6 text-body-sm font-light text-wc-muted-2">
          {channels.locationNote}
        </p>
      </Reveal>
    </section>
  );
}
