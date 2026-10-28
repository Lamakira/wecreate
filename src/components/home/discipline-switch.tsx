import Link from "next/link";

import {
  DISCIPLINES,
  disciplineLabel,
  disciplinePath,
  type Discipline,
} from "@/discipline";

/**
 * The switch between WeCreate's three Disciplines, at the top of each
 * homepage's hero.
 *
 * Links, not state: each Discipline's homepage has its own address, so it is
 * indexable, shareable and works without JavaScript — there is nothing to
 * hydrate and no client component here. The current Discipline is marked with
 * `aria-current="page"`, which is also what the accent styling follows.
 *
 * The pill sits over the hero's moving WebGL background. Its ground is
 * near-opaque rather than glass because the acceptance suite samples the hero
 * text's contrast from painted pixels, and a translucent pill would let the
 * background's pale folds through.
 */
export function DisciplineSwitch({ current }: { current: Discipline }) {
  return (
    <nav aria-label="Disciplines" data-testid="discipline-switch">
      <ul className="m-0 flex list-none flex-wrap justify-center gap-0.5 rounded-full border border-wc-line-strong bg-[color-mix(in_srgb,var(--color-wc-ground)_88%,transparent)] p-1 backdrop-blur-sm">
        {DISCIPLINES.map((discipline) => (
          <li key={discipline}>
            <Link
              href={disciplinePath(discipline)}
              aria-current={discipline === current ? "page" : undefined}
              className={`block rounded-full px-[clamp(11px,2vw,22px)] py-3 text-[clamp(10px,1.2vw,11px)] font-semibold tracking-[clamp(.06em,.8vw,.14em)] whitespace-nowrap uppercase transition-colors duration-300 ${
                discipline === current
                  ? "bg-wc-accent text-wc-on-accent"
                  : "text-wc-text-soft hover:text-wc-text"
              }`}
            >
              {disciplineLabel(discipline)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
