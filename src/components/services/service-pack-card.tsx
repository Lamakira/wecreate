import { CtaLink } from "@/components/primitives/cta-link";
import { formatXof } from "@/lib/format";
import { prefilledMessage, whatsAppMessageUrl } from "@/lib/whatsapp";
import type { ServicePack } from "@/managed-content/types";
import {
  serviceOfferLabel,
  type ServiceEnquiryContext,
} from "@/service-enquiry/enquiry";

interface ServicePackCardProps {
  pack: ServicePack;
  /** The universe the pack belongs to, named in the enquiry message. */
  universeTitle: string;
  serviceEnquiry: ServiceEnquiryContext;
}

/**
 * One service offer, and the two ways to talk about it.
 *
 * Both actions are plain links to somewhere else: a WhatsApp conversation
 * prefilled with this pack's name, and WeCreate's hosted Discovery Call page.
 * Neither is a button, because neither does anything on this site — there is no
 * "Ajouter au panier" and no "Réserver" here, and there cannot be: a service
 * offer never enters the Digital Cart or reaches FedaPay (ADR-0006).
 *
 * WhatsApp is first, in the primary treatment, and stays reachable whatever the
 * calendar is doing.
 */
export function ServicePackCard({
  pack,
  universeTitle,
  serviceEnquiry: { enquiry, contact, onRequestLabel },
}: ServicePackCardProps) {
  const offer = serviceOfferLabel(pack.name, universeTitle);
  const whatsappHref = whatsAppMessageUrl(
    contact.whatsappUrl,
    prefilledMessage(enquiry.whatsappMessageTemplate, offer),
  );

  return (
    <article
      data-testid="service-pack"
      className="flex h-full flex-col gap-4 border border-wc-line-dark bg-wc-surface px-[26px] pt-[30px] pb-[26px] transition-[border-color,transform] duration-500 ease-signature hover:border-wc-muted hover:-translate-y-[5px]"
    >
      <h3 className="m-0 font-display text-product-title font-medium">
        {pack.name}
      </h3>

      <p className="m-0 flex flex-wrap items-baseline gap-2 border-b border-wc-line-dark pb-4">
        <span
          data-testid="service-pack-price"
          className="text-[clamp(22px,2.4vw,30px)] font-semibold tracking-[-0.01em]"
        >
          {pack.isOnRequest ? onRequestLabel : formatXof(pack.priceXof)}
        </span>
        {!pack.isOnRequest && pack.priceUnit ? (
          <span className="text-button tracking-16 uppercase text-wc-muted-2">
            {pack.priceUnit}
          </span>
        ) : null}
      </p>

      <ul className="m-0 flex flex-1 list-none flex-col gap-[9px] p-0">
        {pack.inclusions.map((inclusion) => (
          <li
            key={inclusion}
            className="flex gap-2.5 text-body-sm font-light text-wc-soft"
          >
            <span aria-hidden="true" className="text-wc-white">
              -
            </span>
            {inclusion}
          </li>
        ))}
      </ul>

      {/* Micro-label terms with ordinary-case definitions, the meta treatment
        * used everywhere else on the site. The payment conditions are a
        * sentence, and a sentence set in capitals stops being readable. */}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-wc-line-dark pt-3.5 text-body-sm font-light text-wc-muted-2">
        <dt className="m-0 text-[10px] font-medium tracking-16 uppercase">
          Cible
        </dt>
        <dd className="m-0">{pack.audience}</dd>
        <dt className="m-0 text-[10px] font-medium tracking-16 uppercase">
          Engagement
        </dt>
        <dd className="m-0">{pack.commitment}</dd>
        <dt className="m-0 text-[10px] font-medium tracking-16 uppercase">
          Paiement
        </dt>
        <dd className="m-0">{pack.paymentTerms}</dd>
      </dl>

      <div className="flex flex-col gap-2">
        <CtaLink
          cta={{ label: enquiry.whatsappLabel, href: whatsappHref }}
          variant="solid"
          size="block"
          context={`${offer}, sur WhatsApp`}
        />
        <CtaLink
          cta={{
            label: enquiry.discoveryCallLabel,
            href: contact.discoveryCallUrl,
          }}
          variant="ghost"
          size="block"
          context={offer}
        />
      </div>
    </article>
  );
}
