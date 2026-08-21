import Image from "next/image";
import Link from "next/link";

import { enquiryDestination } from "@/components/primitives/cta-link";
import type { EffectiveLegalRevision } from "@/managed-content/legal";
import type { SiteSettings } from "@/managed-content/types";

interface SiteFooterProps {
  settings: SiteSettings;
  /**
   * The legal documents in force, in presentation order.
   *
   * Derived from the documents themselves rather than maintained as a second
   * list an editor keeps in step: a document with no revision in force has no
   * page, and so has no link here either.
   */
  legalLinks: EffectiveLegalRevision[];
}

export function SiteFooter({ settings, legalLinks }: SiteFooterProps) {
  const { contact, footer, socialAccounts, navigation, brandName } = settings;
  const whatsappEnquiry = enquiryDestination(contact.whatsappUrl);

  return (
    <footer className="border-t border-wc-line-dark bg-wc-pure pt-section-xs pb-[34px]">
      <div className="wc-container grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[clamp(28px,4vw,56px)]">
        <div>
          <Image
            src="/brand/logo-blanc.svg"
            alt={brandName}
            width={196}
            height={26}
            className="mb-[18px] h-[26px] w-auto"
          />
          <p className="m-0 max-w-[26ch] font-display text-baseline italic text-wc-soft">
            {footer.baseline}
          </p>
        </div>

        <nav aria-label="Navigation du pied de page">
          <p className="m-0 mb-4 text-micro tracking-26 uppercase text-wc-muted-2">
            {footer.navigationHeading}
          </p>
          <ul className="flex list-none flex-col items-start gap-2.5 p-0">
            {navigation.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-meta font-light text-wc-soft transition-colors duration-300 hover:text-wc-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="m-0 mb-4 text-micro tracking-26 uppercase text-wc-muted-2">
            {footer.contactHeading}
          </p>
          <ul className="flex list-none flex-col items-start gap-2.5 p-0 text-meta font-light text-wc-soft">
            <li>
              <a
                href={contact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                {...(whatsappEnquiry ? { "data-enquiry": whatsappEnquiry } : undefined)}
                className="transition-colors duration-300 hover:text-wc-white"
              >
                {contact.whatsappLabel}
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${contact.email}`}
                className="transition-colors duration-300 hover:text-wc-white"
              >
                {contact.email}
              </a>
            </li>
            <li>{contact.locationLabel}</li>
          </ul>
        </div>

        <div>
          <p className="m-0 mb-4 text-micro tracking-26 uppercase text-wc-muted-2">
            {footer.socialHeading}
          </p>
          <ul className="flex list-none flex-col items-start gap-2.5 p-0 text-meta font-light text-wc-soft">
            {socialAccounts.map((account) => (
              <li key={account.url}>
                <a
                  href={account.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors duration-300 hover:text-wc-white"
                >
                  {account.label}
                  <span className="sr-only"> (nouvel onglet)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="wc-container mt-[clamp(36px,5vw,64px)] border-t border-wc-line-dark pt-[22px]">
        {legalLinks.length > 0 ? (
          <nav aria-label="Informations légales" className="mb-[18px]">
            <ul className="flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0">
              {legalLinks.map((legal) => (
                <li key={legal.kind}>
                  <Link
                    href={legal.path}
                    className="border-b border-wc-muted pb-px text-micro tracking-20 uppercase text-wc-muted-2 transition-colors duration-300 hover:border-wc-white hover:text-wc-white"
                  >
                    {legal.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="flex flex-wrap justify-between gap-4">
          <p className="m-0 text-micro tracking-20 uppercase text-wc-muted-2">
            {footer.legalLine}
          </p>
          <p className="m-0 text-micro tracking-20 uppercase text-wc-muted-2">
            {settings.positioningLine}
          </p>
        </div>
      </div>
    </footer>
  );
}
