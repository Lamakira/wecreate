import Image from "next/image";
import Link from "next/link";

import type { SiteSettings } from "@/managed-content/types";

interface SiteFooterProps {
  settings: SiteSettings;
}

export function SiteFooter({ settings }: SiteFooterProps) {
  const { contact, footer, socialAccounts, navigation, brandName } = settings;

  return (
    <footer className="border-t border-wc-line-dark bg-wc-pure px-gutter pt-section-xs pb-[34px]">
      <div className="mx-auto grid max-w-site grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[clamp(28px,4vw,56px)]">
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
                className="transition-colors duration-300 hover:text-wc-white"
              >
                {contact.whatsappLabel}
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
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-[clamp(36px,5vw,64px)] flex max-w-site flex-wrap justify-between gap-4 border-t border-wc-line-dark pt-[22px]">
        <p className="m-0 text-micro tracking-20 uppercase text-wc-muted">
          {footer.legalLine}
        </p>
        <p className="m-0 text-micro tracking-20 uppercase text-wc-muted">
          {settings.positioningLine}
        </p>
      </div>
    </footer>
  );
}
