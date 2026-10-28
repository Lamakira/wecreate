import {
  LOGO_TYPES,
  logoSample,
  type LogoTypeId,
} from "@/brand-questionnaire/questions";
import { CAPTION } from "@/components/brand-questionnaire/fields";

/** The name shrinks with its length so a long one never leaves the card. */
function typographicSize(length: number): number {
  if (length <= 6) return 22;
  if (length <= 9) return 17;
  if (length <= 12) return 13;
  return 11;
}

function combinedSize(length: number): number {
  if (length <= 7) return 22;
  if (length <= 10) return 18;
  return 15;
}

/**
 * What each card draws: the client's own brand name in that logo shape.
 *
 * Black on a light grey ground, no colour — these are only shapes to choose
 * between, and WeCreate designs the real thing afterwards.
 */
function Sample({ id, brand }: { id: LogoTypeId; brand: string }) {
  const { name, initials } = logoSample(brand);
  const length = Array.from(name).length;

  switch (id) {
    case "monogramme":
      return (
        <span className="border-[1.5px] border-wc-pure px-3.5 py-1.5 font-display text-[40px] leading-none font-medium tracking-[-0.04em]">
          {initials}
        </span>
      );
    case "symbole":
      return (
        <span className="grid size-14 place-items-center rounded-full bg-wc-pure">
          <span className="block size-5 rotate-45 bg-wc-white" />
        </span>
      );
    case "typographique":
      return (
        <span
          className="max-w-full px-3 font-bold tracking-[0.14em] whitespace-nowrap"
          style={{ fontSize: typographicSize(length) }}
        >
          {name}
        </span>
      );
    case "combine":
      return (
        <span className="flex max-w-full items-center justify-center gap-3 px-3">
          <span className="grid size-[30px] shrink-0 place-items-center bg-wc-pure">
            <span className="block size-2.5 rounded-full bg-wc-white" />
          </span>
          <span
            className="font-display font-medium whitespace-nowrap"
            style={{ fontSize: combinedSize(length) }}
          >
            {name}
          </span>
        </span>
      );
    case "embleme":
      return (
        <span className="grid size-24 place-items-center rounded-full border-[1.5px] border-wc-pure p-[7px]">
          <span className="grid size-full place-items-center rounded-full border border-wc-pure px-2">
            <span className="block max-w-[70px] truncate font-display text-[13px] font-semibold">
              {name}
            </span>
          </span>
        </span>
      );
    case "sans-avis":
      return (
        <span className="font-display text-[44px] text-wc-muted-on-light italic">
          ?
        </span>
      );
  }
}

/**
 * The logo-type question: one card per shape, each a real checkbox.
 *
 * The label is stretched over the whole card (`after:absolute after:inset-0`)
 * so the card is the click target while the checkbox keeps a short accessible
 * name — "Monogramme" — described by the sentence under it, instead of reading
 * the sample out as part of the name.
 */
export function LogoCards({
  brand,
  value,
  onChange,
}: {
  brand: string;
  value: readonly LogoTypeId[];
  onChange: (value: LogoTypeId[]) => void;
}) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={`m-0 mb-3 p-0 ${CAPTION}`}>
        Type de logo souhaité · plusieurs choix possibles
      </legend>
      <p className="m-0 mb-3 text-body-sm font-light text-wc-ink">
        Les exemples utilisent le nom de votre marque.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {LOGO_TYPES.map((type) => {
          const checked = value.includes(type.id);
          return (
            <div
              key={type.id}
              data-testid={`logo-card-${type.id}`}
              className={`relative flex flex-col border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wc-pure ${
                checked
                  ? "border-wc-pure outline outline-1 outline-wc-pure"
                  : "border-wc-muted-on-light"
              }`}
            >
              <input
                id={`logo-${type.id}`}
                type="checkbox"
                name="logo"
                value={type.id}
                checked={checked}
                aria-describedby={`logo-description-${type.id}`}
                onChange={() =>
                  onChange(
                    checked
                      ? value.filter((item) => item !== type.id)
                      : LOGO_TYPES.map((t) => t.id).filter(
                          (id) => id === type.id || value.includes(id),
                        ),
                  )
                }
                className="absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none opacity-0"
              />
              <div
                aria-hidden="true"
                data-testid={`logo-sample-${type.id}`}
                className="grid aspect-[16/10] place-items-center overflow-hidden bg-wc-line-light text-wc-pure"
              >
                <Sample id={type.id} brand={brand} />
              </div>
              <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
                <span className="flex justify-between text-body-sm font-semibold">
                  <label
                    htmlFor={`logo-${type.id}`}
                    className="cursor-pointer"
                  >
                    {type.label}
                  </label>
                  <span aria-hidden="true">{checked ? "✓" : ""}</span>
                </span>
                <span
                  id={`logo-description-${type.id}`}
                  className="text-body-sm font-light text-wc-ink"
                >
                  {type.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
