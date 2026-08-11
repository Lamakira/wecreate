# WeCreate

The WeCreate website: a French-first, mobile-first portfolio and Digital Product
boutique for a cinematic video production agency in Calavi Tankpè, Bénin.

The canonical specification is GitHub issue #1. Domain vocabulary is defined in
[`CONTEXT.md`](./CONTEXT.md) and architectural decisions in
[`docs/adr/`](./docs/adr) — read both before changing anything here.

## Stack

| Concern           | Choice                                          |
| ----------------- | ----------------------------------------------- |
| Framework         | Next.js 16 (App Router, Cache Components)       |
| UI                | React 19, TypeScript, Tailwind CSS v4           |
| Managed Content   | Sanity, with the Studio embedded at `/studio`   |
| Acceptance tests  | Playwright, against the production build        |
| Package manager   | pnpm                                            |

## Getting started

```bash
pnpm install
pnpm dev
```

That is the whole setup. With no environment variables at all the application
runs on the bundled baseline content (`src/managed-content/default-content.ts`),
so the site, the acceptance suite and the design are all reviewable without a
single production credential.

Useful scripts:

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `pnpm dev`          | Development server on http://localhost:3000          |
| `pnpm build`        | Production build (also type-checks)                  |
| `pnpm start`        | Serve the production build                           |
| `pnpm typecheck`    | `tsc --noEmit`                                       |
| `pnpm lint`         | ESLint                                               |
| `pnpm test:e2e`     | The acceptance suite (builds, starts, drives it)     |
| `pnpm test:e2e:ui`  | The same suite in Playwright's UI mode               |

## Environment

Copy [`.env.example`](./.env.example) to `.env.local`. Everything in it is
optional locally; the file documents each variable and which of these categories
it belongs to.

1. **Deployment identity** — the deployment's own origin, and whether it may be
   indexed. Only production is crawlable.
2. **Managed Content provider** — which CMS this process talks to, and the
   Sanity project, dataset and read token when that is Sanity.
3. **Preview and revalidation secrets** — who may open a preview session and who
   may drop the content cache.
4. **Acceptance-test hooks** — set by `playwright.config.ts`, never by hand.

Secrets are server-only and live in the deployment platform's secret management.
Anything named `NEXT_PUBLIC_*` is compiled into the browser bundle, so nothing
sensitive may ever carry that prefix. Local, staging and production use separate
datasets and separate secrets throughout.

## Managed Content

Everything WeCreate maintains without a developer — homepage sections, global
contact and social details, navigation labels, SEO defaults, section visibility
— comes through one interface: `ManagedContentProvider` in
`src/managed-content/provider.ts`.

```
src/managed-content/
├── types.ts             the content model the whole application speaks
├── provider.ts          the interface, and which implementation is in use
├── index.ts             the cached, draft-aware read API pages call
├── default-content.ts   the canonical starting content
├── sanity/              the Sanity implementation
└── fixture/             the deterministic implementation used by tests and by
                         an unconfigured checkout
```

Two rules keep this useful:

- **The vendor SDK stays in two places** — the adapter (`managed-content/sanity/`)
  and the Studio (`src/sanity/`). Components take plain content objects, so a
  provider can be replaced without touching them, and route handlers delegate to
  `src/sanity/` rather than importing Sanity themselves.
- **Tests never mock internals.** They swap the provider at this boundary and
  drive the real running application, so they stay valid across refactors.

Later integrations — Mux, FedaPay, Resend, Calendly, Supabase Storage — get
their own boundary of the same shape.

### Homepage sections, not a page builder

The homepage is a fixed, named set of sections. Editors change their copy and
whether each is shown; they cannot add, remove, reorder or nest them. That line
is what keeps the approved design and its accessibility guarantees intact
(ADR-0001), and it is enforced by the schema in `src/sanity/schema/`.

Two sections — *Travaux récents* and *La boutique* — display their empty state
until Portfolio Projects (issue #3) and Digital Products (issue #7) exist as
content types. No sample entry ships in `src/` for them under any provider:
WeCreate publishes only real, approved work, and content that could be mistaken
for a portfolio entry must not be reachable through a misconfigured deployment.
Tests that need a populated homepage seed their own from
`tests/e2e/support/sample-content.ts`.

## Setting up Sanity

1. Create a project at [sanity.io/manage](https://www.sanity.io/manage) with a
   `production` dataset, plus a separate dataset per non-production environment.
2. Put the project id and dataset in `.env.local`
   (`NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`).
3. Create a **Viewer** token and set it as `SANITY_API_READ_TOKEN`. It is what
   lets preview read unpublished documents, and it must stay server-only.
4. Add this deployment's origin to the project's CORS origins, with credentials
   allowed, so the embedded Studio can authenticate.
5. Restart. `/studio` now opens the editor; before step 2 it shows setup
   instructions instead, and the site keeps working on fixture content.

The Studio is served by the application itself, so there is no separate Studio
deployment to manage.

### Preview

An editor opens *Presentation* in the Studio and sees the real Next.js pages,
not an approximation. Under the hood:

- Presentation calls `/api/draft/enable`, which validates the editor's Sanity
  session and sets Next.js's draft-mode cookie.
- With that cookie, `readSiteContent()` reads the `drafts` perspective and the
  response is marked private and uncached. Without it, every request gets
  published content from the shared cache. There is no path by which
  unpublished content reaches an ordinary visitor.
- A banner along the bottom of every previewed page links to
  `/api/draft/disable`.

`WECREATE_PREVIEW_SECRET` opens the same session for a client that has no Sanity
account, via `/api/draft/enable?secret=…&path=/`.

### Publishing and the cache

Public pages are prerendered and cached, and Supabase is never on the browsing
path (ADR-0003). A publish therefore has to invalidate that cache:

1. In the Sanity project, add a webhook to `POST {origin}/api/revalidate`, with
   a secret, firing on create/update/delete of `siteSettings` and `homePage`.
2. Set the same value as `SANITY_WEBHOOK_SECRET`. The signature is verified
   against the raw request body.
3. The endpoint expires the `managed-content` cache tag, so the very next
   request renders the new content — an editor reloads and sees their change.

`WECREATE_REVALIDATE_SECRET` accepts the same call as a bearer token, for
operators and for deployments with no Sanity webhook.

## The acceptance seam

```bash
pnpm test:e2e                      # everything
pnpm test:e2e --project=desktop    # one viewport
pnpm test:e2e homepage             # one spec
```

One harness. It builds the application exactly as it ships, starts it against
the fixture content provider, and drives it through Chromium at a desktop and a
Pixel 7 viewport. No component tests, no mocked internals, no production
credentials.

```
tests/e2e/
├── homepage.spec.ts                  the approved design and its content
├── site-shell.spec.ts                header, navigation, cart, footer, fonts
├── managed-content-publishing.spec.ts draft, preview, publish, revalidate
├── resilience.spec.ts                reduced motion, no JS, nothing published
└── support/
    ├── managed-content.ts            editorial actions, over HTTP
    └── sample-content.ts             stand-in projects and products
```

Tests act as a Content Editor would, through `/api/test/managed-content`. That
endpoint responds 404 unless **both** `WECREATE_TEST_HOOKS=1` and
`WECREATE_CONTENT_PROVIDER=fixture` are set, so it cannot be reached on a
deployed environment.

Content is a single shared dataset, so the suite runs serially. Later tickets
that bring per-worker persistence can lift that.

Browsers are installed once with `pnpm exec playwright install chromium`.

## The hero background

The hero fills the viewport: it starts at the very top, behind the translucent
header, and runs to the bottom edge. The design handoff's cinematic letterbox
bands were removed to get there.

It is layered, and every layer above the first is optional:

1. **The gradient, halo and letterbox bands** — the design's baseline. Always
   painted, and what a visitor sees when everything above is absent.
2. **A generated WebGL field** (`hero-background.tsx`, rendered with `ogl`) —
   an approved shader preset. Treat the GLSL and its preset values as an asset,
   not as code to refactor.
3. **A scrim** — see below.
4. **An optional Playback Asset**, when Managed Content has one.

The background is deliberately absent more often than not. It is never loaded
for a visitor who prefers reduced motion or has Save-Data on; it stops rendering
once the hero scrolls out of view; and if WebGL2 is unavailable or the context is
lost it removes itself and the gradient shows through.

**The scrim is not decoration.** The shader's pale folds sweep through the area
the copy sits in, and contrast cannot be left to a surface that changes every
frame. The scrim restores a dark, stable ground where the text is, releasing
toward the top right so the field still reads. It is tuned against measured
worst-case contrast across desktop, tablet and mobile — the tightest margin is
the subtitle at 5.15:1 against a 4.5:1 requirement. Re-measure if the preset's
colours, the scrim or the hero's type colours change.

For the same reason two greys are lifted from `#777` to `#BBB`: the hero's
kicker, and the header's inactive navigation links, which sit over the same
background now that the hero runs behind the header. `#777` cannot reach 4.5:1
on *any* background — its ceiling against pure black is 4.69:1 — so no amount of
darkening fixes it. The current page stays distinguishable by its underline as
well as its colour.

## Greys and contrast

The design handoff's tertiary greys do not meet WCAG 2.2 AA on this site's own
surfaces, so the palette carries corrected values:

| Token | Handoff | Now | Why |
| --- | --- | --- | --- |
| `wc-muted-2` | `#777` | `#8A8A8A` | `#777` measures 4.42:1 on `#0A0A0A` and 4.22:1 on `#111111` |
| `wc-muted-on-light` | — | `#6A6A6A` | New. `#777` measures 4.48:1 on the white band |
| `wc-muted` | `#555` | `#555` | Kept, but for rules and underlines only — as text it reaches 2.8:1 |

No single grey can serve both grounds: against `#0A0A0A` and `#FFFFFF` together,
the best any grey manages is 4.39:1. That is why dark and light surfaces have
separate tokens, and why `#777` could not simply be darkened into compliance —
its ceiling against pure black is 4.69:1.

`tests/e2e/contrast.spec.ts` guards all of this. Flat surfaces are checked from
computed styles; the hero is checked by sampling painted pixels across several
frames, because its ground is a shader under a gradient and no computed style
describes it. Reverting `wc-muted-2` to `#777` fails that test with eleven named
elements, which is how it was verified to be worth having.

## Typography

Inter and Playfair Display are self-hosted from `public/fonts` with
`font-display: swap` and a real fallback stack. See
[`public/fonts/README.md`](./public/fonts/README.md).

## Before this goes live

Production purchasing stays disabled until the Commerce Launch Gate is signed
off — see issue #1. Nothing in this repository may switch FedaPay to live; that
is a deliberate, named decision by WeCreate.
