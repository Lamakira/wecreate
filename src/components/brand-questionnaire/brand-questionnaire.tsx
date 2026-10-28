"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import { sendBrandQuestionnaire } from "@/brand-questionnaire/actions";
import {
  clearDraft,
  loadDraft,
  saveAnswers,
  saveFiles,
} from "@/brand-questionnaire/draft";
import {
  ATTACHMENT_REFUSAL_MESSAGES,
  INITIAL_SEND_OUTCOME,
  LAST_STEP,
  PRICE_OPTIONS,
  QUESTIONNAIRE_STEPS,
  SEND_REFUSAL_MESSAGES,
  SUPPORT_OPTIONS,
  TEXT_QUESTIONS,
  ZONE_OPTIONS,
  emptyAnswers,
  finalAnswers,
  refusalsForAll,
  refusalsForStep,
  type AnswerRefusal,
  type AttachmentRefusal,
  type BrandAnswers,
  type StepIndex,
  type TextQuestionId,
} from "@/brand-questionnaire/questions";
import { Attachments } from "@/components/brand-questionnaire/attachments";
import {
  CAPTION,
  CheckChips,
  PersonalityAxes,
  RadioChips,
  TextField,
} from "@/components/brand-questionnaire/fields";
import { LogoCards } from "@/components/brand-questionnaire/logo-cards";
import { ACTION_SIZES } from "@/components/primitives/action";

export interface BrandQuestionnaireProps {
  /** Who the client is, addressed by it. */
  client: string;
  /** Prefill for the brand question; may be empty. */
  brand: string;
  pack: string;
  reference: string;
  /** Opaque and stable per invitation: where this device keeps the draft. */
  draftKey: string;
  whatsappUrl: string;
}

type FieldErrors = Partial<Record<TextQuestionId, AnswerRefusal>>;

/** Where focus goes after the next render: the step heading, or a field. */
interface FocusRequest {
  target: "heading" | TextQuestionId;
  id: number;
}

const BUTTON_OUTLINE =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wc-pure";

/**
 * The brand questionnaire: five steps, one form, answers kept on this device.
 *
 * Only the current step's questions are rendered, but all the state lives here,
 * so going back never loses anything. The draft (answers, step, files) is
 * written to the browser's own storage as it changes and read back after a
 * reload — see `draft.ts` for why that is not WeCreate storing anything. Until
 * the saved draft has been read nothing is shown and nothing is saved, so an
 * empty first render can never overwrite a draft that is waiting.
 *
 * A step is refused only where the question is required (brand name, email):
 * the refusal stays on the step, is linked to its field and takes focus. The
 * server judges everything again when the form is sent; the messages here
 * exist so the client learns it before uploading photographs.
 */
export function BrandQuestionnaire({
  client,
  brand,
  pack,
  reference,
  draftKey,
  whatsappUrl,
}: BrandQuestionnaireProps) {
  const titleId = useId();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<StepIndex>(0);
  const [answers, setAnswers] = useState<BrandAnswers>(() => ({
    ...emptyAnswers(),
    brand,
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [attachmentError, setAttachmentError] =
    useState<AttachmentRefusal | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const [outcome, dispatch, isPending] = useActionState(
    sendBrandQuestionnaire,
    INITIAL_SEND_OUTCOME,
  );
  const [seenOutcome, setSeenOutcome] = useState(outcome);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);
  const sending = useRef(false);

  const sent = outcome.status === "sent";

  // A refusal that names fields puts the client on the first step that has one.
  // Done while rendering rather than in an effect: it is a reaction to a new
  // outcome, and doing it here avoids a frame showing the wrong step.
  if (outcome !== seenOutcome) {
    setSeenOutcome(outcome);
    if (outcome.status === "refused" && outcome.fields) {
      const ids = Object.keys(outcome.fields) as TextQuestionId[];
      if (ids.length > 0) {
        const first = ids.reduce((a, b) =>
          TEXT_QUESTIONS[b].step < TEXT_QUESTIONS[a].step ? b : a,
        );
        setFieldErrors(outcome.fields);
        setStep(TEXT_QUESTIONS[first].step);
        setFocusRequest((previous) => ({
          target: first,
          id: (previous?.id ?? 0) + 1,
        }));
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    void loadDraft(draftKey).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setStep(draft.step);
        setAnswers(draft.answers);
        setFiles(draft.files);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (ready && !sent) void saveAnswers(draftKey, step, answers);
  }, [ready, sent, draftKey, step, answers]);

  useEffect(() => {
    if (ready && !sent) void saveFiles(draftKey, files);
  }, [ready, sent, draftKey, files]);

  useEffect(() => {
    if (!isPending) sending.current = false;
  }, [isPending]);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === "heading") {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: "start" });
    } else {
      document.getElementById(`q-${focusRequest.target}`)?.focus();
    }
  }, [focusRequest]);

  useEffect(() => {
    if (!sent) return;
    void clearDraft(draftKey);
    sentHeadingRef.current?.focus();
    sentHeadingRef.current?.scrollIntoView({ block: "start" });
  }, [sent, draftKey]);

  function request(target: FocusRequest["target"]) {
    setFocusRequest((previous) => ({ target, id: (previous?.id ?? 0) + 1 }));
  }

  function goTo(next: number) {
    setStep(next as StepIndex);
    request("heading");
  }

  function setText(id: TextQuestionId, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    if (fieldErrors[id]) {
      setFieldErrors((current) => {
        const rest = { ...current };
        delete rest[id];
        return rest;
      });
    }
  }

  function refuse(errors: FieldErrors, at: StepIndex) {
    setFieldErrors(errors);
    setStep(at);
    const ids = Object.keys(errors) as TextQuestionId[];
    request(ids.find((id) => TEXT_QUESTIONS[id].step === at) ?? ids[0]);
  }

  function next() {
    const errors = refusalsForStep(step, answers);
    if (Object.keys(errors).length > 0) {
      refuse(errors, step);
      return;
    }
    setFieldErrors({});
    goTo(step + 1);
  }

  function send() {
    if (sending.current) return;
    const errors = refusalsForAll(answers);
    const ids = Object.keys(errors) as TextQuestionId[];
    if (ids.length > 0) {
      const first = Math.min(...ids.map((id) => TEXT_QUESTIONS[id].step));
      refuse(errors, first as StepIndex);
      return;
    }
    sending.current = true;
    const formData = new FormData();
    formData.set("answers", JSON.stringify(finalAnswers(answers)));
    for (const file of files) formData.append("attachment", file);
    startTransition(() => dispatch(formData));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < LAST_STEP) next();
    else send();
  }

  if (sent) {
    return (
      <SentSection
        headingRef={sentHeadingRef}
        brand={answers.brand.trim()}
        copyTo={outcome.copyTo}
        whatsappUrl={whatsappUrl}
      />
    );
  }

  const text = (id: TextQuestionId) => (
    <TextField
      key={id}
      id={id}
      value={answers[id]}
      refusal={fieldErrors[id]}
      onChange={(value) => setText(id, value)}
    />
  );

  const refused = outcome.status === "refused" && !isPending ? outcome : null;

  return (
    <section data-surface="light" className="bg-wc-white text-wc-pure">
      <div className="px-gutter py-[clamp(36px,5vw,72px)]">
        <div className="max-w-prose">
          <p className="m-0 text-micro tracking-28 uppercase text-wc-muted-on-light">
            {`Référence ${reference} · ${pack}`}
          </p>
          <h1
            id={titleId}
            className="m-0 mt-5 font-display text-[clamp(30px,4.4vw,58px)] leading-[1.04] font-medium"
          >
            Questionnaire de <em>marque</em>.
          </h1>
          <p className="m-0 mt-5 text-body-lg font-light text-wc-ink">
            {`Bonjour ${client}. Votre activité, votre cible, vos valeurs, vos goûts. Plus vos réponses sont précises, plus vos pistes de logo seront justes.`}
          </p>

          {ready ? (
            <>
              <ol
                aria-label="Étapes du questionnaire"
                className="m-0 mt-9 mb-8 grid list-none grid-cols-5 gap-1.5 p-0"
              >
                {QUESTIONNAIRE_STEPS.map((item, index) => (
                  <li
                    key={item.id}
                    aria-current={index === step ? "step" : undefined}
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <span
                      aria-hidden="true"
                      className={`block h-0.5 ${
                        index <= step ? "bg-wc-pure" : "bg-wc-line-light"
                      }`}
                    />
                    <span
                      className={`overflow-hidden text-badge tracking-16 whitespace-nowrap text-ellipsis uppercase ${
                        index === step
                          ? "font-semibold text-wc-pure"
                          : "text-wc-muted-on-light"
                      }`}
                    >
                      {`${String(index + 1).padStart(2, "0")} ${item.label}`}
                    </span>
                  </li>
                ))}
              </ol>

              <form
                aria-labelledby={titleId}
                noValidate
                onSubmit={submit}
                className="flex flex-col gap-7"
              >
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  data-testid="questionnaire-step"
                  className={`m-0 scroll-mt-24 ${CAPTION} focus:outline-none`}
                >
                  {`Étape ${step + 1} sur ${QUESTIONNAIRE_STEPS.length} · ${QUESTIONNAIRE_STEPS[step].label}`}
                </h2>

                {step === 0 ? (
                  <>
                    {text("brand")}
                    {text("sector")}
                    {text("pitch")}
                    {text("story")}
                    {text("launch")}
                  </>
                ) : null}

                {step === 1 ? (
                  <>
                    {text("audience")}
                    {text("problem")}
                    <RadioChips
                      legend="Positionnement prix"
                      name="price"
                      options={PRICE_OPTIONS}
                      value={answers.price}
                      onChange={(price) =>
                        setAnswers((current) => ({
                          ...current,
                          price: price as BrandAnswers["price"],
                        }))
                      }
                    />
                    <CheckChips
                      legend="Zone de clientèle"
                      name="zone"
                      options={ZONE_OPTIONS}
                      value={answers.zone}
                      onChange={(zone) =>
                        setAnswers((current) => ({ ...current, zone }))
                      }
                    />
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    {text("values")}
                    <PersonalityAxes
                      axes={answers.axes}
                      onChange={(axis, point) =>
                        setAnswers((current) => ({
                          ...current,
                          axes: { ...current.axes, [axis]: point },
                        }))
                      }
                    />
                    {text("never")}
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    {text("admire")}
                    <LogoCards
                      brand={answers.brand}
                      value={answers.logo}
                      onChange={(logo) =>
                        setAnswers((current) => ({ ...current, logo }))
                      }
                    />
                    <div className="grid gap-6 sm:grid-cols-2">
                      {text("colorsLike")}
                      {text("colorsAvoid")}
                    </div>
                    <Attachments
                      files={files}
                      refusal={attachmentError}
                      onFiles={setFiles}
                      onRefusal={setAttachmentError}
                    />
                  </>
                ) : null}

                {step === 4 ? (
                  <>
                    {text("competitors")}
                    <CheckChips
                      legend="Où la marque apparaîtra en priorité"
                      name="supports"
                      options={SUPPORT_OPTIONS}
                      value={answers.supports}
                      onChange={(supports) =>
                        setAnswers((current) => ({ ...current, supports }))
                      }
                    />
                    {text("notes")}
                    {text("email")}
                  </>
                ) : null}

                {refused ? (
                  <div className="flex flex-col gap-3">
                    <div
                      role="alert"
                      data-testid="send-error"
                      className="border border-wc-error p-5"
                    >
                      <p className="m-0 text-body font-semibold text-wc-error">
                        {SEND_REFUSAL_MESSAGES[refused.reason]}
                      </p>
                      {refused.attachments ? (
                        <p className="m-0 mt-2 text-body-sm font-light text-wc-error">
                          {ATTACHMENT_REFUSAL_MESSAGES[refused.attachments]}
                        </p>
                      ) : null}
                    </div>
                    {refused.reason === "link" ||
                    refused.reason === "unavailable" ? (
                      <p className="m-0">
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`border-b border-wc-muted-on-light pb-0.5 text-body ${BUTTON_OUTLINE}`}
                        >
                          Écrire sur WhatsApp
                          <span className="sr-only"> - nouvel onglet</span>
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-wc-line-light pt-6">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => goTo(step - 1)}
                      className={`${ACTION_SIZES.default} border border-wc-muted-on-light text-wc-pure hover:border-wc-pure ${BUTTON_OUTLINE}`}
                    >
                      Précédent
                    </button>
                  ) : (
                    <span />
                  )}
                  {step < LAST_STEP ? (
                    // Keyed apart from the send button, which takes its place on
                    // the last step: React would otherwise reuse this element,
                    // and the Enter that pressed *Suivant* would then submit.
                    <button
                      key="next"
                      type="button"
                      onClick={next}
                      className={`${ACTION_SIZES.default} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80 ${BUTTON_OUTLINE}`}
                    >
                      Suivant
                    </button>
                  ) : (
                    <button
                      key="send"
                      type="submit"
                      disabled={isPending}
                      aria-busy={isPending}
                      className={`${ACTION_SIZES.default} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80 disabled:bg-wc-muted-on-light ${BUTTON_OUTLINE}`}
                    >
                      {isPending ? "Envoi en cours…" : "Envoyer le questionnaire"}
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SentSection({
  headingRef,
  brand,
  copyTo,
  whatsappUrl,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  brand: string;
  copyTo: string;
  whatsappUrl: string;
}) {
  return (
    <section
      data-surface="light"
      data-testid="questionnaire-sent"
      className="bg-wc-white px-gutter py-[clamp(36px,5vw,72px)] text-wc-pure"
    >
      <div className="max-w-prose">
        {/* The page's heading now: the questionnaire it replaces is gone. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="m-0 font-display text-[clamp(28px,4vw,48px)] leading-[1.1] font-medium focus:outline-none"
        >
          Merci. On s&apos;occupe de <em>{brand}</em>.
        </h1>
        <p className="m-0 mt-5 text-body-lg font-light text-wc-ink">
          {`Une copie de vos réponses a été envoyée à ${copyTo}. Vos premières pistes de logo vous arriveront par email et WhatsApp ; chaque étape attend votre validation avant la suivante.`}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ACTION_SIZES.default} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80 ${BUTTON_OUTLINE}`}
          >
            Une question ? WhatsApp
            <span className="sr-only"> - nouvel onglet</span>
          </a>
          <Link
            href="/"
            className={`${ACTION_SIZES.default} border border-wc-muted-on-light text-wc-pure hover:border-wc-pure ${BUTTON_OUTLINE}`}
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
