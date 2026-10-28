import {
  isWellFormedEmail,
  normaliseName,
  normaliseTelephone,
} from "@/commerce/contact";

/**
 * What the contact form may ask for, and what it refuses.
 *
 * Pure functions over what arrived, like `checkout/guest.ts` — no request, no
 * cookie, no provider — so the same rules answer wherever they are applied. They
 * are applied on the server, always: the form carries no validation of its own,
 * so every refusal a visitor reads is this file's, and a submission that
 * skipped the form entirely is held to exactly the same rules.
 *
 * Importable by client components, which is why nothing here is server-only:
 * the form draws its subjects, its labels and its starting state from here.
 */

/**
 * What a message can be about, in the order the form lists them.
 *
 * The slug is what travels in a link (`/contact?sujet=branding`) and in the
 * form; the label is what a visitor reads and what WeCreate's inbox shows.
 */
export const CONTACT_SUBJECTS = [
  { slug: "entreprises", label: "Entreprise — abonnement mensuel" },
  { slug: "immobilier", label: "Immobilier — location courte durée" },
  { slug: "mariage", label: "Mariage — film premium" },
  { slug: "branding", label: "Branding — système de marque" },
  { slug: "site-web", label: "Site web — sur devis" },
  { slug: "boutique", label: "Produit boutique (ebook / LUTs)" },
  { slug: "autre", label: "Autre" },
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]["slug"];

export function isContactSubject(value: unknown): value is ContactSubject {
  return CONTACT_SUBJECTS.some((subject) => subject.slug === value);
}

export function contactSubjectLabel(slug: ContactSubject): string {
  return CONTACT_SUBJECTS.find((subject) => subject.slug === slug)!.label;
}

/**
 * Where a Discipline's call to action goes: the form, with its subject chosen.
 *
 * Discipline pages link here rather than building the address themselves, so
 * the parameter's name and the anchor are written once.
 */
export function contactFormPath(subject: ContactSubject): string {
  return `/contact?sujet=${subject}#formulaire`;
}

/** The parts of the form a refusal can be about. */
export type ContactField =
  | "name"
  | "email"
  | "telephone"
  | "subject"
  | "message";

export type ContactRefusal =
  | "nameMissing"
  | "nameTooLong"
  | "emailMalformed"
  | "telephoneMalformed"
  | "subjectMissing"
  | "messageMissing"
  | "messageTooLong";

/** What the visitor is told, in French, and what to do about it. */
export const CONTACT_REFUSAL_LABELS: Record<ContactRefusal, string> = {
  nameMissing: "Indiquez votre nom.",
  nameTooLong: "Ce nom est trop long : 120 caractères au maximum.",
  emailMalformed:
    "Indiquez une adresse email valide : c'est là que WeCreate vous répondra.",
  telephoneMalformed:
    "Indiquez un numéro de téléphone valide, par exemple +229 01 97 00 00 00, ou laissez ce champ vide.",
  subjectMissing: "Choisissez le sujet de votre message.",
  messageMissing: "Décrivez votre projet en quelques lignes.",
  messageTooLong: "Ce message est trop long : 5 000 caractères au maximum.",
};

/** Which field each refusal belongs beside. */
export const CONTACT_REFUSAL_FIELDS: Record<ContactRefusal, ContactField> = {
  nameMissing: "name",
  nameTooLong: "name",
  emailMalformed: "email",
  telephoneMalformed: "telephone",
  subjectMissing: "subject",
  messageMissing: "message",
  messageTooLong: "message",
};

const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 5000;

/**
 * A telephone as a visitor writes one: national or international, digits only
 * once the punctuation is gone. Looser than checkout's E.164 on purpose — here
 * the number is only something WeCreate may call back on, not an identifier.
 */
const CONTACT_TELEPHONE_PATTERN = /^\+?\d{8,15}$/;

/** What the form sent, before any of it is believed. */
export interface ContactFormValues {
  name: string;
  email: string;
  telephone: string;
  subject: string;
  message: string;
}

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  email: "",
  telephone: "",
  subject: "",
  message: "",
};

export interface ContactMessage {
  name: string;
  email: string;
  /** What the visitor wrote, tidied of surrounding spaces; absent when left empty. */
  telephone: string | null;
  subject: ContactSubject;
  message: string;
}

export interface ContactSubmission {
  /** The message, tidied. Only meaningful when nothing is refused. */
  message: ContactMessage;
  /** At most one refusal per field, so a form can print each beside its input. */
  refusals: Partial<Record<ContactField, ContactRefusal>>;
}

/** Read a visitor's message, and say what is wrong with it. */
export function readContactMessage(values: ContactFormValues): ContactSubmission {
  const refusals: Partial<Record<ContactField, ContactRefusal>> = {};
  const refuse = (refusal: ContactRefusal) => {
    const field = CONTACT_REFUSAL_FIELDS[refusal];
    refusals[field] ??= refusal;
  };

  const name = normaliseName(values.name);
  if (name.length === 0) refuse("nameMissing");
  else if (name.length > MAX_NAME_LENGTH) refuse("nameTooLong");

  const email = values.email.trim();
  if (!isWellFormedEmail(email)) refuse("emailMalformed");

  const telephoneText = values.telephone.trim();
  if (
    telephoneText.length > 0 &&
    !CONTACT_TELEPHONE_PATTERN.test(normaliseTelephone(telephoneText))
  ) {
    refuse("telephoneMalformed");
  }

  if (!isContactSubject(values.subject)) refuse("subjectMissing");

  // A browser submits a line break as CRLF; WeCreate's inbox gets one kind.
  const message = values.message.replaceAll(/\r\n?/g, "\n").trim();
  if (message.length === 0) refuse("messageMissing");
  else if (message.length > MAX_MESSAGE_LENGTH) refuse("messageTooLong");

  return {
    message: {
      name,
      email,
      telephone: telephoneText.length > 0 ? telephoneText : null,
      subject: isContactSubject(values.subject) ? values.subject : "autre",
      message,
    },
    refusals,
  };
}

/** Something that is not about a field, in words the visitor can act on. */
export type ContactNotice = "sendFailed" | "tooManyMessages";

export const CONTACT_NOTICE_LABELS: Record<ContactNotice, string> = {
  sendFailed:
    "Votre message n'est pas parti. Rien n'est perdu : il est toujours dans le formulaire. Réessayez dans un instant, ou écrivez-nous sur WhatsApp.",
  tooManyMessages:
    "Trop de messages envoyés en peu de temps. Le vôtre est toujours dans le formulaire : réessayez dans une heure, ou écrivez-nous sur WhatsApp.",
};

/**
 * What the form knows between one submission and the next.
 *
 * Here rather than in `actions.ts`, because a `"use server"` file may only
 * export functions.
 */
export interface ContactFormState {
  status: "editing" | "sent";
  refusals: Partial<Record<ContactField, ContactRefusal>>;
  notice: ContactNotice | null;
  /** What the visitor typed, so a refusal does not cost them their typing. */
  values: ContactFormValues;
  /** Where the answer will go; null when there is nothing honest to say. */
  sentTo: string | null;
}

export const INITIAL_CONTACT_FORM: ContactFormState = {
  status: "editing",
  refusals: {},
  notice: null,
  values: EMPTY_CONTACT_FORM,
  sentTo: null,
};

/**
 * The name of the field a person never sees.
 *
 * A bot filling in every input fills this one too; a visitor cannot reach it.
 */
export const HONEYPOT_FIELD = "website";
