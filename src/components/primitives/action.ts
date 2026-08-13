/**
 * The metrics a call to action has, whichever element it turns out to be.
 *
 * A destination is a link and *Ajouter au panier* is a button, so they cannot
 * be the same component — but the design gives them the same box, and typing
 * that box out twice is how the two drift a padding value apart. `CtaLink`
 * carries the colour variants, which genuinely differ between them; the sizes
 * are shared and live here.
 */
export const ACTION_SIZES = {
  /** An action standing on its own in a section. */
  default:
    "inline-block whitespace-nowrap px-7 py-[17px] text-button font-semibold tracking-18 uppercase",
  /** One of a stack filling the foot of a card or a drawer, at its smaller type. */
  block:
    "block w-full px-5 py-[15px] text-center text-micro font-semibold tracking-18 uppercase",
} as const;

export type ActionSize = keyof typeof ACTION_SIZES;
