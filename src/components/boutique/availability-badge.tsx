import {
  AVAILABILITY_LABELS,
  type DigitalProductAvailability,
} from "@/managed-content/digital-products";

interface AvailabilityBadgeProps {
  availability: DigitalProductAvailability;
}

/**
 * Whether a Digital Product can be bought, said in words.
 *
 * Never in colour alone — the identity has no colour, and a state a visitor has
 * to infer from a shade of grey is one they cannot infer at all. Each state
 * therefore reads as its own phrase, and `data-availability` is what the
 * acceptance suite asserts against rather than the styling.
 *
 * `Disponible` is the state nothing reaches yet: no Paid Deliverable Version
 * exists (issue #8) and the licence is still provisional text, so every product
 * in the Boutique is *bientôt disponible* until WeCreate approves both.
 */
export function AvailabilityBadge({ availability }: AvailabilityBadgeProps) {
  return (
    <span
      data-testid="product-availability"
      data-availability={availability}
      className={`inline-block px-2.5 py-1.5 text-badge font-semibold tracking-20 uppercase ${
        availability === "available"
          ? "bg-wc-pure text-wc-white"
          : "border border-wc-muted-on-light text-wc-muted-on-light"
      }`}
    >
      {AVAILABILITY_LABELS[availability]}
    </span>
  );
}
