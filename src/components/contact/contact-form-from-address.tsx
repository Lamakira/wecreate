"use client";

import { useSearchParams } from "next/navigation";

import { ContactForm } from "@/components/contact/contact-form";
import { isContactSubject } from "@/service-enquiry/contact-form";

/**
 * The form, with the subject a link asked for already chosen.
 *
 * `/contact?sujet=branding` is what a Discipline's call to action points at
 * (`contactFormPath`). Anything that is not a known subject is ignored rather
 * than refused: a stale or mistyped link still opens a working form. Keyed on
 * the subject so a different link starts a fresh form.
 */
export function ContactFormFromAddress({ whatsappUrl }: { whatsappUrl: string }) {
  const value = useSearchParams().get("sujet");
  const preselected = isContactSubject(value) ? value : null;

  return (
    <ContactForm
      key={preselected ?? "none"}
      preselected={preselected}
      whatsappUrl={whatsappUrl}
    />
  );
}
