# WeCreate transaction prototype — review guide

This is a throwaway primary source for deciding how the Digital Product journey should fit WeCreate’s existing visual system. It does not call FedaPay, persist data, or download files.

## Decision — approved

**Variant C — Ticket transactionnel scindé** is the selected production direction.

The black order ticket preserves WeCreate’s cinematic identity while the white working surface keeps forms, payment truth, recovery guidance, and Order Access easy to scan. On mobile, the ticket must remain compact so the active transaction state appears in the first viewport.

Selected by the project owner on 11 August 2026. The production implementation should recreate the validated structure cleanly; it must not promote this throwaway HTML directly.

## Run it

Open `transaction-prototype.html` directly in a browser. No install or server is required.

Shareable examples:

- `transaction-prototype.html?variant=A&state=checkout`
- `transaction-prototype.html?variant=B&state=pending`
- `transaction-prototype.html?variant=C&state=paid`

Use the fixed bottom arrows—or the keyboard left/right arrows outside form fields—to change visual variant. Use the state controls below the header to jump directly to every transaction condition.

## Variants to compare

- **A — Feuille éditoriale claire:** the transaction becomes a calm white boutique sheet with a sticky order summary. Tests whether a dedicated light surface gives checkout the clearest continuity.
- **B — Registre de vérification sombre:** the entire journey stays in WeCreate’s cinematic dark world, with an explicit state ledger on the left. Tests whether operational clarity can live comfortably on the dark surface.
- **C — Ticket transactionnel scindé:** the order is a persistent black ticket while the active task uses a white working surface. Tests whether contrast can separate “what I bought” from “what is happening.”

## Review sequence

1. At 390 px wide, open `cart`, then press the primary action through `checkout`, `redirect`, `pending`, and `paid`.
2. In `pending`, confirm that “you may close this page” is visible without scrolling past reassurance.
3. In `paid`, press each download button and check whether “5 sur 5 restants,” the 30-day window, and short-lived-link wording feel helpful rather than technical.
4. Jump to `failed`, `price`, and `fulfillment` and ask someone unfamiliar with the project whether they can state: “Was I charged?” and “What should I do next?” within five seconds.
5. Repeat at a desktop width and compare which layout best preserves WeCreate’s cinematic identity without slowing the task.

## Remaining implementation questions

- Does the cart deserve a true drawer before this route, or should mobile navigate directly to the full cart view represented here?
- Which state distinction was weakest without accent colors?
- Did any Order Access language feel too technical or too vague?
- What failed first on a narrow or deliberately throttled connection?

## First-pass findings

- On mobile, payment truth must precede the order recap. The first render of A reversed that priority; the corrected layout now keeps the urgent state first and moves the recap after it.
- The full transaction ticket in C was too tall on a narrow viewport. A compact mobile ticket showing total and snapshot duration preserves the concept while exposing the active state sooner.
- A mobile cart drawer remains plausible only when its item list scrolls independently and the checkout action stays anchored above the prototype switcher/device edge.
- Before selection, the strongest preliminary reading was C’s black order ticket with its light working surface. The owner’s selection confirms that direction; B’s persistent ledger remains useful evidence for internal operations, but consumes too much narrow-screen space for this customer journey.

## Current design hypotheses, not yet approved

- The white work surface is more legible for form entry; the black order surface preserves brand continuity.
- Textual payment truth plus shape/symbol changes are sufficient without red/green status colors.
- Order Access reads best as one row per purchased product with one plain-language allowance counter.
- Pending needs reassurance before any retry affordance; fulfillment failure must lead with “payment approved.”

After a direction is approved, record the winner and reasons on the implementation issue, capture this prototype on a throwaway branch, and implement the validated decisions cleanly in production code.
