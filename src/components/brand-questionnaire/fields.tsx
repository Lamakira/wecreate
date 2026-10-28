import {
  ANSWER_REFUSAL_MESSAGES,
  AXIS_POINTS,
  PERSONALITY_AXES,
  TEXT_QUESTIONS,
  type AnswerRefusal,
  type BrandAnswers,
  type PersonalityAxisId,
  type TextQuestion,
  type TextQuestionId,
} from "@/brand-questionnaire/questions";

/** The small uppercase caption every question and group of choices carries. */
const CAPTION = "text-micro tracking-26 uppercase text-wc-muted-on-light";

/**
 * A free-text question: label, control, hint, and the refusal when there is one.
 *
 * The browser's own validation is off on the form (`noValidate`), so the only
 * refusal a client reads is this module's, in French, linked to the field with
 * `aria-describedby` and announced when the field takes focus.
 */
export function TextField({
  id,
  value,
  refusal,
  onChange,
}: {
  id: TextQuestionId;
  value: string;
  refusal: AnswerRefusal | undefined;
  onChange: (value: string) => void;
}) {
  const question: TextQuestion = TEXT_QUESTIONS[id];
  const required = "required" in question && question.required;
  const hint = "hint" in question ? question.hint : undefined;
  const placeholder = "placeholder" in question ? question.placeholder : undefined;
  const type = "type" in question ? question.type : "text";
  const autoComplete = "autoComplete" in question ? question.autoComplete : undefined;
  const described = [hint ? `hint-${id}` : null, refusal ? `error-${id}` : null]
    .filter(Boolean)
    .join(" ");
  const className = `mt-2.5 block w-full bg-transparent px-4 py-3.5 text-body font-light text-wc-pure ${
    refusal ? "border-2 border-wc-error" : "border border-wc-muted-on-light"
  }`;
  const shared = {
    id: `q-${id}`,
    name: id,
    value,
    placeholder,
    maxLength: question.maxLength,
    "aria-required": required ? (true as const) : undefined,
    "aria-invalid": refusal ? (true as const) : undefined,
    "aria-describedby": described || undefined,
    className,
  };

  return (
    <div>
      <label htmlFor={`q-${id}`} className={`block ${CAPTION}`}>
        {question.label}
      </label>
      {question.rows ? (
        <textarea
          {...shared}
          rows={question.rows}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          {...shared}
          type={type}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? (
        <p
          id={`hint-${id}`}
          className="m-0 mt-2 text-body-sm font-light text-wc-muted-on-light"
        >
          {hint}
        </p>
      ) : null}
      {refusal ? (
        <p
          id={`error-${id}`}
          data-testid={`error-${id}`}
          className="m-0 mt-2 text-body-sm font-semibold text-wc-error"
        >
          {ANSWER_REFUSAL_MESSAGES[refusal]}
        </p>
      ) : null}
    </div>
  );
}

const LEGEND = `m-0 mb-3 p-0 ${CAPTION}`;

/** The chip every choice question draws: a real input, seen as a button. */
function Chip({
  type,
  name,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="relative cursor-pointer">
      <input
        type={type}
        name={name}
        value={label}
        checked={checked}
        onChange={onChange}
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none opacity-0"
      />
      <span className="block border border-wc-muted-on-light px-4 py-[11px] text-body-sm font-medium text-wc-pure peer-checked:border-wc-pure peer-checked:bg-wc-pure peer-checked:text-wc-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-wc-pure">
        {label}
      </span>
    </label>
  );
}

/** One answer out of a few, or none: native radios. */
export function RadioChips({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={LEGEND}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option}
            type="radio"
            name={name}
            label={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** As many answers as apply: native checkboxes. */
export function CheckChips<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: readonly T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={LEGEND}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option}
            type="checkbox"
            name={name}
            label={option}
            checked={value.includes(option)}
            onChange={() =>
              onChange(
                value.includes(option)
                  ? value.filter((item) => item !== option)
                  : options.filter(
                      (item) => item === option || value.includes(item),
                    ),
              )
            }
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The five personality scales: the left word, five dots, the right word.
 *
 * Each scale is a fieldset of five native radios named "1 sur 5" … "5 sur 5",
 * so a screen reader hears "Classique ou Moderne" then the position. The words
 * beside the dots are hidden from it because the legend already says them.
 */
export function PersonalityAxes({
  axes,
  onChange,
}: {
  axes: BrandAnswers["axes"];
  onChange: (axis: PersonalityAxisId, point: number) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={LEGEND}>Votre marque est plutôt…</legend>
      {PERSONALITY_AXES.map((axis) => (
        <fieldset
          key={axis.id}
          className="m-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 border-0 border-t border-wc-line-light px-0 py-3.5 sm:gap-3.5"
        >
          <legend className="sr-only">{`${axis.left} ou ${axis.right}`}</legend>
          <span
            aria-hidden="true"
            className="text-right text-body-sm [overflow-wrap:anywhere]"
          >
            {axis.left}
          </span>
          <div className="flex gap-[5px] sm:gap-1.5">
            {AXIS_POINTS.map((point) => (
              <label key={point} className="relative cursor-pointer">
                <input
                  type="radio"
                  name={`axis-${axis.id}`}
                  checked={axes[axis.id] === point}
                  onChange={() => onChange(axis.id, point)}
                  className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none opacity-0"
                />
                <span className="sr-only">{`${point} sur 5`}</span>
                <span
                  aria-hidden="true"
                  className="block size-[22px] rounded-full border border-wc-muted-on-light peer-checked:border-wc-pure peer-checked:bg-wc-pure peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-wc-pure sm:size-[26px]"
                />
              </label>
            ))}
          </div>
          <span aria-hidden="true" className="text-body-sm [overflow-wrap:anywhere]">
            {axis.right}
          </span>
        </fieldset>
      ))}
    </fieldset>
  );
}

export { CAPTION };
