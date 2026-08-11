/**
 * The full-screen film grain from the design handoff.
 *
 * Purely decorative: `pointer-events: none` keeps it out of every interaction,
 * and `aria-hidden` keeps it out of the accessibility tree.
 */
export function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-9998 opacity-[0.05] bg-[repeating-linear-gradient(0deg,#fff_0_1px,transparent_1px_3px)]"
    />
  );
}
