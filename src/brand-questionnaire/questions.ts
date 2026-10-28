/**
 * The brand questionnaire a Branding client fills after agreeing a pack with
 * WeCreate (issue #57): its five steps, every question in them, and the rules
 * an answer has to meet.
 *
 * One module for both sides on purpose. The browser uses it to lay the steps
 * out, to refuse a missing brand name or an oversized attachment before
 * anything is uploaded, and to read a saved draft back; the server uses the
 * very same functions as its trust boundary, because a form is not one. What
 * the client is told and what the server enforces therefore cannot drift.
 *
 * Nothing here is stored anywhere by WeCreate (parent decision 3, #55): the
 * answers travel once, by email, to WeCreate and to the client.
 */

/** The five steps, in the order the client meets them. */
export const QUESTIONNAIRE_STEPS = [
  { id: "entreprise", label: "Entreprise" },
  { id: "cible", label: "Cible" },
  { id: "personnalite", label: "Personnalité" },
  { id: "gouts", label: "Goûts visuels" },
  { id: "supports", label: "Supports" },
] as const;

export type StepIndex = 0 | 1 | 2 | 3 | 4;

export const LAST_STEP: StepIndex = 4;

// ---------------------------------------------------------------------------
// Free-text questions
// ---------------------------------------------------------------------------

export interface TextQuestion {
  step: StepIndex;
  label: string;
  /** A textarea of this many rows; a single-line input when absent. */
  rows?: number;
  placeholder?: string;
  type?: "text" | "email";
  autoComplete?: string;
  /** Characters kept, on both sides. Longer input is cut, not refused. */
  maxLength: number;
  required?: boolean;
  hint?: string;
}

/**
 * Every free-text question, in display order within its step.
 *
 * `email` is the one question the handoff does not have: the copy of the
 * answers has to go somewhere, and the personal link deliberately carries no
 * address (parent decision 3).
 */
export const TEXT_QUESTIONS = {
  brand: {
    step: 0,
    label: "Nom de la marque",
    autoComplete: "organization",
    maxLength: 80,
    required: true,
    hint: "Il sert aux exemples de logo de l'étape 4.",
  },
  sector: {
    step: 0,
    label: "Secteur d'activité",
    placeholder: "Restaurant, cabinet, cosmétique…",
    maxLength: 120,
  },
  pitch: {
    step: 0,
    label: "Ce que vous faites, en une phrase",
    maxLength: 300,
  },
  story: {
    step: 0,
    label: "Histoire de la marque",
    rows: 4,
    placeholder: "Pourquoi elle existe, d'où vient le nom…",
    maxLength: 3000,
  },
  launch: {
    step: 0,
    label: "Date de lancement ou d'ouverture",
    placeholder: "ex. janvier 2027, ou déjà ouvert",
    maxLength: 120,
  },
  audience: {
    step: 1,
    label: "À qui vendez-vous ?",
    rows: 4,
    placeholder: "Âge, métier, habitudes, où ils vous trouvent…",
    maxLength: 3000,
  },
  problem: {
    step: 1,
    label: "Quel problème résolvez-vous pour eux ?",
    rows: 3,
    maxLength: 3000,
  },
  values: {
    step: 2,
    label: "Vos 3 valeurs principales",
    placeholder: "ex. exigence, proximité, élégance",
    maxLength: 300,
  },
  never: {
    step: 2,
    label: "Ce que votre marque ne doit jamais être",
    placeholder: "ex. bon marché, froide, tape-à-l'œil",
    maxLength: 300,
  },
  admire: {
    step: 3,
    label: "Marques que vous admirez, et pourquoi",
    rows: 3,
    maxLength: 3000,
  },
  colorsLike: {
    step: 3,
    label: "Couleurs souhaitées",
    maxLength: 200,
  },
  colorsAvoid: {
    step: 3,
    label: "Couleurs à éviter",
    maxLength: 200,
  },
  competitors: {
    step: 4,
    label: "Vos principaux concurrents",
    rows: 3,
    maxLength: 3000,
  },
  notes: {
    step: 4,
    label: "Autre chose à nous dire ?",
    rows: 4,
    maxLength: 3000,
  },
  email: {
    step: 4,
    label: "Votre email",
    type: "email",
    autoComplete: "email",
    maxLength: 254,
    required: true,
    hint: "Vous recevrez à cette adresse une copie de vos réponses.",
  },
} as const satisfies Record<string, TextQuestion>;

export type TextQuestionId = keyof typeof TEXT_QUESTIONS;

export const TEXT_QUESTION_IDS = Object.keys(TEXT_QUESTIONS) as TextQuestionId[];

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

/** Price positioning: one answer, or none. */
export const PRICE_OPTIONS = [
  "Accessible",
  "Milieu de gamme",
  "Premium",
  "Luxe",
] as const;

/** Where the clientele is: as many as apply. */
export const ZONE_OPTIONS = [
  "Calavi",
  "Cotonou",
  "Tout le Bénin",
  "Afrique de l'Ouest",
  "International",
] as const;

/** Where the brand will appear first: as many as apply. */
export const SUPPORT_OPTIONS = [
  "Réseaux sociaux",
  "Enseigne & façade",
  "Packaging",
  "Documents",
  "Site web",
  "Vidéo",
  "Uniformes",
  "Véhicules",
] as const;

/**
 * The five personality scales of step 3. Each is answered 1 (the left word)
 * to 5 (the right word), or left unanswered.
 */
export const PERSONALITY_AXES = [
  { id: "style", left: "Classique", right: "Moderne" },
  { id: "tone", left: "Sobre", right: "Expressive" },
  { id: "reach", left: "Accessible", right: "Exclusive" },
  { id: "warmth", left: "Sérieuse", right: "Chaleureuse" },
  { id: "scope", left: "Locale", right: "Internationale" },
] as const;

export type PersonalityAxisId = (typeof PERSONALITY_AXES)[number]["id"];

export const AXIS_POINTS = [1, 2, 3, 4, 5] as const;

/**
 * The logo-type cards of step 4. Each card is drawn with the client's own
 * brand name (see `logoSample`), so they choose between shapes of *their*
 * logo rather than of somebody else's.
 */
export const LOGO_TYPES = [
  {
    id: "monogramme",
    label: "Monogramme",
    description:
      "Les initiales de la marque, travaillées ensemble. Comme le « LV » de Louis Vuitton.",
  },
  {
    id: "symbole",
    label: "Symbole",
    description:
      "Une icône seule, sans texte, reconnaissable de loin. Comme la pomme d'Apple.",
  },
  {
    id: "typographique",
    label: "Typographique",
    description:
      "Le nom seul, écrit dans une typographie dessinée. Comme Google ou Zara.",
  },
  {
    id: "combine",
    label: "Combiné",
    description:
      "Une icône + le nom, utilisables ensemble ou séparément. Le plus polyvalent. Comme Adidas.",
  },
  {
    id: "embleme",
    label: "Emblème",
    description:
      "Le nom enfermé dans un badge ou un sceau. Classique, artisanal. Comme Starbucks.",
  },
  {
    id: "sans-avis",
    label: "Pas d'avis",
    description:
      "On vous recommandera la forme la plus adaptée à votre activité.",
  },
] as const;

export type LogoTypeId = (typeof LOGO_TYPES)[number]["id"];

/** What the logo cards print, derived from the brand name the client typed. */
export function logoSample(brand: string): { name: string; initials: string } {
  const trimmed = brand.trim() || "Maison";
  const words = trimmed.split(/\s+/).filter(Boolean);
  const initials =
    words.length > 1
      ? `${words[0][0]}${words[1][0]}`
      : Array.from(trimmed).slice(0, 2).join("");
  return {
    name: Array.from(trimmed).slice(0, 14).join(""),
    initials: initials.toUpperCase(),
  };
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

export type BrandAnswers = Record<TextQuestionId, string> & {
  price: (typeof PRICE_OPTIONS)[number] | "";
  zone: (typeof ZONE_OPTIONS)[number][];
  logo: LogoTypeId[];
  supports: (typeof SUPPORT_OPTIONS)[number][];
  /** 1 to 5, or 0 for a scale left unanswered. */
  axes: Record<PersonalityAxisId, number>;
};

export function emptyAnswers(): BrandAnswers {
  const text = Object.fromEntries(
    TEXT_QUESTION_IDS.map((id) => [id, ""]),
  ) as Record<TextQuestionId, string>;
  return {
    ...text,
    price: "",
    zone: [],
    logo: [],
    supports: [],
    axes: Object.fromEntries(PERSONALITY_AXES.map((axis) => [axis.id, 0])) as Record<
      PersonalityAxisId,
      number
    >,
  };
}

function only<T extends string>(allowed: readonly T[], value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return allowed.filter((option) => value.includes(option));
}

/**
 * Whatever arrived, as answers this questionnaire could have produced.
 *
 * Every string is cut to its question's length, every choice outside the
 * offered options is dropped, every scale outside 1–5 is unanswered. It never
 * throws: a draft saved by an older version of this page, or a request that
 * skipped the page entirely, reads as fewer answers rather than as an error.
 * Text is not trimmed here — the browser runs this on a draft being typed —
 * and is trimmed by `finalAnswers` at the moment of sending.
 */
export function normalizeAnswers(raw: unknown): BrandAnswers {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const answers = emptyAnswers();

  for (const id of TEXT_QUESTION_IDS) {
    const value = input[id];
    answers[id] =
      typeof value === "string"
        ? value.slice(0, TEXT_QUESTIONS[id].maxLength)
        : "";
  }

  answers.price = PRICE_OPTIONS.find((option) => option === input.price) ?? "";
  answers.zone = only(ZONE_OPTIONS, input.zone);
  answers.logo = only(
    LOGO_TYPES.map((type) => type.id),
    input.logo,
  );
  answers.supports = only(SUPPORT_OPTIONS, input.supports);

  const axes = (input.axes && typeof input.axes === "object" ? input.axes : {}) as Record<
    string,
    unknown
  >;
  for (const axis of PERSONALITY_AXES) {
    const value = axes[axis.id];
    answers.axes[axis.id] =
      typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
        ? value
        : 0;
  }

  return answers;
}

/** The answers as they are sent: normalized, and every text trimmed. */
export function finalAnswers(raw: unknown): BrandAnswers {
  const answers = normalizeAnswers(raw);
  for (const id of TEXT_QUESTION_IDS) {
    answers[id] = answers[id].trim();
  }
  return answers;
}

// ---------------------------------------------------------------------------
// What a step refuses
// ---------------------------------------------------------------------------

export type AnswerRefusal = "brandMissing" | "emailMissing" | "emailInvalid";

export const ANSWER_REFUSAL_MESSAGES: Record<AnswerRefusal, string> = {
  brandMissing: "Indiquez le nom de la marque.",
  emailMissing: "Indiquez votre email pour recevoir la copie de vos réponses.",
  emailInvalid: "Cet email ne semble pas complet. Vérifiez-le, par exemple nom@exemple.com.",
};

/** Deliberately loose: one `@`, something either side, a dot in the domain. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What stops the client leaving this step, question by question.
 *
 * Only two questions are required — the brand name, which the logo cards are
 * drawn with, and the email the copy goes to. Everything else may be left
 * blank: a client who skips a question is still a client WeCreate can talk to.
 */
export function refusalsForStep(
  step: StepIndex,
  answers: BrandAnswers,
): Partial<Record<TextQuestionId, AnswerRefusal>> {
  const refusals: Partial<Record<TextQuestionId, AnswerRefusal>> = {};
  if (step === 0 && !answers.brand.trim()) {
    refusals.brand = "brandMissing";
  }
  if (step === 4) {
    const email = answers.email.trim();
    if (!email) refusals.email = "emailMissing";
    else if (!EMAIL_SHAPE.test(email)) refusals.email = "emailInvalid";
  }
  return refusals;
}

/** Every step's refusals at once: what the server checks before sending. */
export function refusalsForAll(
  answers: BrandAnswers,
): Partial<Record<TextQuestionId, AnswerRefusal>> {
  return Object.assign(
    {},
    ...QUESTIONNAIRE_STEPS.map((_, step) =>
      refusalsForStep(step as StepIndex, answers),
    ),
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/**
 * How much may be attached: the documented cap issue #57 asks for.
 *
 * Five files and ten megabytes in all. Both emails carry every attachment, and
 * the client is on a mobile connection: ten megabytes is a current logo, a few
 * photographs of a shopfront and a couple of screenshots — the use the
 * question names — and stays far below what the mail provider accepts in one
 * message once encoded (Resend: 40 MB). The server action's own body limit
 * (`next.config.ts`) is well above it, so a refusal is always this module's,
 * in French, and never the framework's.
 */
export const ATTACHMENT_LIMITS = {
  maxFiles: 5,
  maxTotalBytes: 10 * 1024 * 1024,
} as const;

/** Images, and PDF for a logo or a brochure that only exists as one. */
export const ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/** The file picker's `accept` attribute, saying the same as the list above. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.join(",");

export type AttachmentRefusal = "tooMany" | "tooLarge" | "wrongType" | "empty";

export const ATTACHMENT_REFUSAL_MESSAGES: Record<AttachmentRefusal, string> = {
  tooMany: `Vous pouvez joindre ${ATTACHMENT_LIMITS.maxFiles} fichiers au plus. Retirez-en avant d'en ajouter d'autres.`,
  tooLarge: `L'ensemble des fichiers joints ne peut pas dépasser ${ATTACHMENT_LIMITS.maxTotalBytes / (1024 * 1024)} Mo. Retirez un fichier ou choisissez une image plus légère.`,
  wrongType:
    "Seules les images (JPEG, PNG, WebP, GIF, HEIC) et les PDF peuvent être joints.",
  empty: "Un des fichiers choisis est vide. Choisissez-en un autre.",
};

export interface AttachmentFacts {
  name: string;
  size: number;
  type: string;
}

/**
 * Whether this whole set of files may be sent, or the first reason it may not.
 *
 * Called with the files already attached *plus* the ones being added, so a
 * selection that would cross a cap is refused as a whole and before upload.
 */
export function attachmentRefusal(
  files: readonly AttachmentFacts[],
): AttachmentRefusal | null {
  if (files.length > ATTACHMENT_LIMITS.maxFiles) return "tooMany";
  if (
    files.some(
      (file) =>
        !(ATTACHMENT_TYPES as readonly string[]).includes(file.type.toLowerCase()),
    )
  ) {
    return "wrongType";
  }
  if (files.some((file) => file.size === 0)) return "empty";
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > ATTACHMENT_LIMITS.maxTotalBytes) return "tooLarge";
  return null;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * Why a send did not happen, in words the client can act on.
 *
 * `link` is an invitation that is no longer valid by the time it is used;
 * `unavailable` is the mail provider refusing or absent; `busy` is a rate
 * limit. In every case the answers stay on screen (issue #57).
 */
export type SendRefusal =
  | "link"
  | "answers"
  | "attachments"
  | "unavailable"
  | "busy";

export const SEND_REFUSAL_MESSAGES: Record<SendRefusal, string> = {
  link: "Votre lien personnel n'est plus valide. Vos réponses restent sur cette page : écrivez-nous sur WhatsApp pour recevoir un nouveau lien.",
  answers: "Certaines réponses sont à compléter avant l'envoi.",
  attachments: "Les fichiers joints ne peuvent pas être envoyés tels quels.",
  unavailable:
    "L'envoi n'a pas abouti. Vos réponses sont toujours là : réessayez dans quelques minutes, ou écrivez-nous sur WhatsApp si cela persiste.",
  busy: "Trop d'envois en peu de temps. Patientez quelques minutes, vos réponses restent sur cette page, puis réessayez.",
};

export type SendOutcome =
  | { status: "idle" }
  | { status: "sent"; copyTo: string }
  | {
      status: "refused";
      reason: SendRefusal;
      fields?: Partial<Record<TextQuestionId, AnswerRefusal>>;
      attachments?: AttachmentRefusal;
    };

export const INITIAL_SEND_OUTCOME: SendOutcome = { status: "idle" };
