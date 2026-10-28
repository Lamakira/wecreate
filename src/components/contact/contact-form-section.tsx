import { Suspense } from "react";

import { ContactForm } from "@/components/contact/contact-form";
import { ContactFormFromAddress } from "@/components/contact/contact-form-from-address";
import { SectionKicker } from "@/components/primitives/section-kicker";

interface ContactFormSectionProps {
  whatsappUrl: string;
}

/**
 * The contact form's region, first on the page.
 *
 * The form's fallback is the form itself: the subject in the address needs
 * script to be read, and a visitor without it still gets a working form, only
 * without a subject chosen for them.
 */
export function ContactFormSection({ whatsappUrl }: ContactFormSectionProps) {
  return (
    <section
      id="formulaire"
      aria-labelledby="contact-form-heading"
      className="scroll-mt-28"
    >
      <SectionKicker as="h2" id="contact-form-heading">
        Formulaire de contact
      </SectionKicker>
      <p className="m-0 mb-heading-gap max-w-[52ch] text-body-lg font-light text-wc-soft">
        Décrivez votre projet : il arrive par email chez WeCreate, qui vous
        répond à l&apos;adresse indiquée.
      </p>
      <Suspense
        fallback={<ContactForm preselected={null} whatsappUrl={whatsappUrl} />}
      >
        <ContactFormFromAddress whatsappUrl={whatsappUrl} />
      </Suspense>
    </section>
  );
}
