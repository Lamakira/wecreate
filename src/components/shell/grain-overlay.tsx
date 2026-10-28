/**
 * The full-screen film grain from the design handoff.
 *
 * It sits *behind* the page rather than over it. The handoff puts it on top of
 * everything, which also lays a white line every three pixels across every
 * poster, every film and the project lightbox — a texture meant for the empty
 * dark ground ends up scratching WeCreate's own work. A negative stack level
 * paints it just above the body's black and below every surface, card, image
 * and video, so it shows only where the page is bare.
 *
 * Purely decorative: `pointer-events: none` keeps it out of every interaction,
 * and `aria-hidden` keeps it out of the accessibility tree.
 */
export function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      data-testid="grain-overlay"
      className="pointer-events-none fixed inset-0 -z-10 opacity-[0.05] bg-[repeating-linear-gradient(0deg,var(--color-wc-text)_0_1px,transparent_1px_3px)]"
    />
  );
}
