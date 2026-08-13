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
| Public video      | Mux, uploaded from the Studio                   |
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
3. **Video platform** — Mux's environment key, for anonymous aggregate playback
   measurement. Mux's API token is not here: the Studio keeps it in the dataset.
4. **Preview and revalidation secrets** — who may open a preview session and who
   may drop the content cache.
5. **Acceptance-test hooks** — set by `playwright.config.ts`, never by hand.

Secrets are server-only and live in the deployment platform's secret management.
Anything named `NEXT_PUBLIC_*` is compiled into the browser bundle, so nothing
sensitive may ever carry that prefix. Local, staging and production use separate
datasets and separate secrets throughout.

## Managed Content

Everything WeCreate maintains without a developer — homepage sections, Portfolio
Projects, global contact and social details, navigation labels, SEO defaults,
section visibility — comes through one interface: `ManagedContentProvider` in
`src/managed-content/provider.ts`.

```
src/managed-content/
├── types.ts             the content model the whole application speaks
├── provider.ts          the interface, and which implementation is in use
├── index.ts             the cached, draft-aware read API pages call
├── portfolio.ts         when a Portfolio Project may be published, and its poster
├── digital-products.ts  when a Digital Product may be sold, and its families
├── legal.ts             which legal revision is in force, and what a checkout
│                        may do with it
├── addresses.ts         finding what lives at a slug, and following one that
│                        has moved — shared by the two collections that move
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

Later integrations — FedaPay, Resend, Supabase Storage — get their own boundary
of the same shape. Mux already has one; see *Portfolio Projects and video*
below. Calendly is the exception and never gets one: the site links to its
hosted page and loads none of its code, so there is no vendor behind a boundary
to hide (see *Services and Service Enquiries*).

### Homepage sections, not a page builder

The homepage is a fixed, named set of sections. Editors change their copy and
whether each is shown; they cannot add, remove, reorder or nest them. That line
is what keeps the approved design and its accessibility guarantees intact
(ADR-0001), and it is enforced by the schema in `src/sanity/schema/`.

Neither of the two list sections owns its list. *Travaux récents* is the first
six published Portfolio Projects, and *La boutique* is the first three Digital
Products an editor marked featured, so each is written once and appears in both
places.

No sample Portfolio Project ships in `src/` under any provider: WeCreate
publishes only real, approved work, and content that could be mistaken for a
portfolio entry must not be reachable through a misconfigured deployment. Tests
that need a populated portfolio seed their own from
`tests/e2e/support/sample-content.ts`. Digital Products are the opposite case and
do ship — see below.

## Portfolio Projects and video

A Portfolio Project is a client-approved body of work with its editorial
context, its poster and its Playback Asset. Editors create them in the Studio;
`/portfolio` lists them, filters them by universe and opens each one as a
lightbox, and `/portfolio/[slug]` is the same project as a page of its own — the
one a shared link, a crawler or a visitor without JavaScript arrives at.

**Publication is a decision, not a state.** `publicationRequirements()` in
`src/managed-content/portfolio.ts` is the rule, and `readPortfolio()` applies it:
a project missing its client, description, role, deliverables, poster,
alternative text, video, the client's permission — or, when its speech carries
meaning, captions or a transcript — is *absent* from what a visitor is served.
Nothing counts it, links to it, lists it in the sitemap or serves it at its own
URL. In preview the gate is lifted and each project says what it still needs, so
an editor reviews their work in the real page.

The Studio asks for the same fields, so an editor is told while writing rather
than by an empty portfolio. Keep the two in step: a requirement added to
`publicationRequirements()` without a matching rule in
`src/sanity/schema/portfolio.ts` lets an editor publish something the site then
refuses, with nothing on screen to explain it. The client's permission is the
one deliberate exception — the Studio accepts an unticked box, because deciding
not to publish yet is a normal thing for an editor to do.

**Video goes through its own boundary** (ADR-0007, ADR-0008):

```
src/video-playback/
├── provider.ts       the interface, and what an editor's video association is
├── mux/provider.ts   Mux: renditions, poster and preview loop, capped at 1080p
├── mux/player.tsx    Mux's player — the only module allowed to import its SDK
└── video-player.tsx  a Playback Asset, played; and the poster it falls back to
```

An editor drops a file into the project's *Vidéo* field; Mux ingests, transcodes
and issues the playback identity, and the adapter derives every URL from it. No
editor sees or types a playback id. Playback degrades in one direction only:
still transcoding, unreachable, or failing in the browser all end at the film's
poster with the project's words underneath. Nothing autoplays, on any device.
Hover previews exist only where a fine pointer says the visitor is on a desktop
and motion is not suppressed, and nothing is downloaded for one until the pointer
is actually over the card.

One consequence worth knowing: a project that does not exist answers **200 with
`noindex`**, not 404. Under Cache Components every route with a dynamic segment
streams a static shell before the slug is resolved, so the status is already
committed by then; a real 404 would mean resolving every slug in a proxy, which
puts a content read on every request into the portfolio (ADR-0003). See
`src/app/(site)/not-found.tsx`.

## The Boutique and Digital Products

`/boutique` is the site's one light page — the design handoff's own choice for
it — and it sells exactly two families: *Ebooks & Guides* and *LUTs & Presets*.
The prototype's third tab, *Packs Services*, put a 350,000 F service pack in the
same cart as a 15,000 F ebook; issue #1 removed it, and a service offer can never
enter the Digital Cart at all (ADR-0006). `/boutique/[slug]` is one product on a
page of its own, which is where a shared link, a crawler, a receipt and a visitor
without JavaScript arrive.

**The six products ship in `src/`, and none of them can be sold.** They are
WeCreate's own tools, named, described and priced by the project brief (§6.1 and
§6.2) — unlike a Portfolio Project, there is no client to approve them and
nothing here could be mistaken for someone else's work. Issue #1 asks for exactly
this: the catalogue as content that is not purchase-enabled until WeCreate
validates its prices and launch assets.

What is *absent* from them matters as much. The prototype prints page counts,
study counts and bundled extras — "92 pages PDF", "1 LUT offerte". The brief
states none of it, so `inclusions` ships empty rather than guessed, the same way
the services comparison leaves out rows the brief never gave values for.

**Selling is three decisions in two systems, and no one of them is enough:**

```
publier la fiche      Sanity's own publish. Makes the page public.
En vente              WeCreate's intent to sell — `isPurchaseEnabled`.
un fichier activé     an active Paid Deliverable Version, in the commerce
                      system, which Managed Content never sees (issue #8).
```

`purchaseRequirements()` in `src/managed-content/digital-products.ts` is the
rule, and it also demands a price in whole francs, a cover, a description, the
inclusions, and the *Licence des produits numériques* in force as **approved**
text rather than the placeholder that ships. `src/paid-deliverables/versions.ts`
is the commerce half of the answer; today it reports that nothing is activated,
because nothing is. Every product therefore reads *Bientôt disponible*, and in
preview each one lists what it is still missing — including the two things no
editor can fix, so they know who to ask.

A visitor is told one of three things: *Disponible*, *Bientôt disponible*, or
*Plus disponible*. The third is archiving, and it is not deletion: an
`isArchived` product leaves the Boutique, the homepage teaser, the sitemap and
search, and keeps its identity and its page, because an Order Snapshot, an Order
Access grant and a receipt all point at it. There is no *Ajouter au panier*
anywhere — the Digital Cart arrives with issue #9, and a buy button that could
not take money would be worse than none.

**Sanity holds the shop, never the goods.** The `digitalProduct` document type
has covers, words, a price, availability flags and a SKU, and no file field at
all: a Paid Deliverable is a private object in the commerce system, uploaded and
versioned by a Commerce Operator. The SKU is the one identity the two systems
share — it is what an Order Snapshot records and what a version is activated
against — so ADR-0001 keeps it outside editorial control, and the Studio enforces
that rather than asking: it refuses to publish a SKU that has changed since it
was published, or one another product already carries.

**A changed slug keeps its old address**, exactly as a legal document's does —
literally so, since `src/managed-content/addresses.ts` and
`src/sanity/schema/addresses.ts` are what both collections use.
`previousSlugs` is the record, the Studio refuses to publish a changed address
until the one being left behind is in it, and `src/proxy.ts` turns that record
into a real 308 for both sections before anything renders. See *Legal documents*
below for why it has to run there.

## Services and Service Enquiries

`/services` is where WeCreate sells: three universes — Entreprises, Immobilier,
Mariage — each with its packs, then the Entreprises comparison and the add-ons.
Every price, inclusion, commitment, payment condition and the order they appear
in is Managed Content, and the whole catalogue ships as the baseline in
`src/managed-content/default-content.ts`.

**The commercial values come from the brief, not the prototype.** Issue #1 makes
`docs/BRIEF-PROJET-Site-WeCreate.md` authoritative wherever the design handoff
disagrees, and it disagrees in several places: the handoff sells 16 videos a
month on Domination against the brief's 12, compares packs on shooting days and
drone inclusion the brief never promises, and prices six add-ons that do not
exist. None of those are here. If you are tempted to "restore" a number from the
prototype, that is the disagreement, and the brief wins.

The same rule decides what the comparison table can say. The brief asks for
rows on delivery times, retouch cycles, briefs and reviews, but only states some
of those for some packs — it gives no retouch figure for Domination and no brief
for Présence or Domination. Those two rows are therefore **absent rather than
guessed**: in this table an em dash means "not included", so filling a gap with
one would publish an exclusion WeCreate never agreed to, and inventing a figure
would be worse. Every row present is complete for all three packs. Add the
missing rows once WeCreate states the values — they are Managed Content, so that
is an edit in the Studio, not a code change.

**A pack ends in a conversation, never in a transaction.** ADR-0006 keeps
services out of website commerce entirely, and the page is built so that it
cannot drift back:

- Each pack offers a prefilled WhatsApp link first, and WeCreate's hosted
  Discovery Call second. Both are ordinary `<a>` elements to another origin, so
  they work with scripting disabled and a slow calendar cannot hold up the page.
  `src/service-enquiry/enquiry.ts` builds the addresses and holds no state.
- The message names the offer — `Pack Croissance — Entreprises` — so WeCreate
  never has to ask what it is about. It is percent-encoded, because
  `URLSearchParams` would write spaces as `+` and leave the visitor deleting
  them.
- Nothing here adds to the Digital Cart, creates an Order Snapshot or reaches
  FedaPay. The cart's own type only admits a Digital Product, and the Service
  Enquiry notice above the packs tells the visitor the same thing in French,
  where they press.
- Wedding Film Signature shows *Sur demande* instead of an amount. Its reference
  price stays in Managed Content — it is what the quote starts from — and the
  page never prints it.

**Calendly is a URL, not an integration.** `settings.contact.discoveryCallUrl`
is an address an editor maintains, and no Calendly script or iframe is ever
loaded (issue #1, ADR-0003). A wrong address is therefore a broken link and
nothing more. The shipped default is a placeholder; WeCreate replaces it in the
Studio once the production account exists.

## À propos and Contact

The two pages a visitor reads when deciding whether to trust WeCreate, and how
to reach it. Both are Managed Content in the same shape as the homepage: a fixed
sequence of named sections whose copy an editor owns and whose structure they do
not (ADR-0001).

**`/a-propos`** carries the story, the studio portrait, the four-step method on
the light band, then what the studio is made of — *L'équipe*, *L'équipement* —
and where it works. Two things it deliberately does not carry:

- **Nobody's words but WeCreate's.** The large italic line is the brief's own
  promise. The design prototype's "Le budget d'une vidéo n'est pas une dépense.
  C'est le prix du désir que vous créez." is a commercial claim the brief never
  makes, and issue #1 gives the brief authority over commercial content, so it
  is not published. No client is quoted anywhere on the page.
- **Nobody's name.** *L'équipe* lists roles, and `Capability` has no field for a
  person — WeCreate has approved no team identities for publication, and a name
  written into source would read to a visitor exactly like an approved one. The
  Studio asks for the same shape, so the people go in once WeCreate decides who
  is named.

The portrait is a `MediaFrame` with no image, so it renders the labelled grey
frame at 4:5 rather than anything that could pass for a photograph — and it
reserves the same space either way, so the real one drops in without moving the
page.

**`/contact`** offers three channels and nothing else: WhatsApp first, the
hosted Discovery Call second so a slow calendar never leaves a visitor stranded,
and the administrative email third. Then *Comment démarrer* — contact, quote,
signature, shoot — which describes how WeCreate works rather than a flow the
website runs.

There is no form. The prototype had five fields and answered them with "Demande
enregistrée"; issue #1 removed the generic service enquiry, so this page renders
links, holds no state and stores no lead. Nothing on it submits, and the notice
above the channels says so in French where a visitor is about to press.

The addresses themselves are not page content — they are `settings.contact`, the
same values the header, the footer and every service pack read, so an editor
changes a number once and the whole site follows. Each link's `href` is the real
destination: no redirect, no tracker, and one that opens a new tab says so in its
accessible name.

## Legal documents

Five documents and exactly five — CGV, livraison et remboursement, licence,
politique de confidentialité, mentions légales — each published at
`/legal/<slug>` and listed in the footer. The set is fixed for the reason the
homepage's sections are, and one more: a checkout records *which* terms a buyer
accepted, so every document it can require has to be one the application knows
by name. Editors own each document's words, its address and its history; they
cannot invent a sixth kind or delete one.

```
src/managed-content/legal.ts      the rules: what is in force, what a checkout
                                  must have, what the launch gate is waiting for
src/app/(site)/legal/[slug]/      the document at its current address
             └── [revision]/      one named revision, current or superseded
src/proxy.ts                      a former address, redirected 308
```

**A revision is append-only.** New terms are a new revision with a new `id` and
its own effective date, never an edit of the one already published: an Order
Snapshot references exactly that identity and has to keep resolving to exactly
those words. `/legal/<slug>/<revision>` is where it resolves — marked as
archived, `noindex`, and out of the sitemap, because superseded terms must not
compete in search with the ones in force.

The Studio is where that is enforced, because it is the only place it could be
broken: the application sees one snapshot of the content and cannot tell an
edited revision from an honest one. So `src/sanity/schema/legal.ts` compares the
draft against what is already published and refuses both halves of "does not
rewrite or delete" — a published revision that has gone, and one whose date,
status or wording no longer matches what was published under that identity.

**Which revision applies is a question of dates, not of publishing.** It is the
most recent one whose effective date has arrived, so an editor prepares a change
weeks ahead and it applies on its own day; until then it has no page and no
place in the history. Today is read through `readLegalDay()` rather than from
the clock: Cache Components refuses a moving clock in a prerender, so it is
cached under the content tag and dropped whenever a publish drops the content —
which is what makes terms dated today live the moment they are published.

**None of this is WeCreate's text yet.** Legal copy is an external launch input
(issue #1), so every shipped revision is a `placeholder` that says what the
approved document will cover and what remains to be decided. The status is
enforced rather than advisory: a placeholder is readable and previewable, it
stays out of the sitemap and out of search results, and it appears in
`readEffectiveLegalTerms().awaitingApproval` — the legal half of the Commerce
Launch Gate, and the reason a live checkout cannot run. In preview, that same
list is printed on the page the editor is already looking at.

**Checkout reads a boundary, not a page.** `readEffectiveLegalTerms()` returns
what is in force, and a `checkout` that is either `blocked` — naming the
documents still awaiting approval — or `ready`, carrying the revisions a buyer
must accept before paying (the CGV and the delivery/refund terms, per issue #1).
A union rather than a list that happens to be empty, because "nothing left to
accept" and "not allowed to take money" must not look alike to a caller. Issue
#10 narrows on it and records the revision identities in the Order Snapshot. Each page also states, where a
visitor reads it, whether the document is accepted before payment or is
information only — and that nothing on this site collects marketing consent.

**A changed slug keeps its old address.** `previousSlugs` is the record, and the
Studio will not publish a changed address until the one being left behind is in
it — so the redirect is part of changing the address rather than a chore beside
it, which is what issue #1's "publishing a changed slug creates a permanent
redirect" asks for. `src/proxy.ts` turns that record into a real 308 before
anything renders, including for a link to one named revision. It has to run there: under Cache Components a route
with a dynamic segment streams its shell before the slug is resolved, so by the
time the page knows the address has moved the status is already committed and
`permanentRedirect()` can only insert a client-side redirect — which the page
still does, as a fallback. The proxy reads `/api/legal/redirects` — and
`/api/boutique/redirects` for a Digital Product — cached maps of former
addresses, and its matcher touches no other route.
`src/app/(site)/not-found.tsx` explains why the portfolio deliberately does not
do the same.

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
6. Open the Studio's *Videos* tool and enter a Mux access token with read and
   write on video and read on data. It is stored in the dataset rather than in
   the environment, so each environment's dataset carries its own — which is
   also what keeps staging uploads out of the production Mux environment.

Uploads use Mux's `basic` quality level, capped at 1080p, with no downloadable
rendition. Encoding is free at that level and the first 100,000 delivered
minutes each month are free, so a portfolio of this size is billed for storage
and very little else. `plus` buys per-title encoding at a per-minute charge:
worth considering once WeCreate has real films on the site, and a deliberate
decision when it happens rather than a default that quietly costs money.

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
   a secret, firing on create/update/delete of `siteSettings`, `homePage`,
   `portfolioPage`, `portfolioProject`, `boutiquePage`, `digitalProduct`,
   `servicesPage`, `aboutPage`,
   `contactPage` and `legalDocument`.
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
├── portfolio.spec.ts                 filters, counts, the project dialog and its
│                                     keyboard, playback fallback, publication
├── boutique.spec.ts                  family filters, crawlable product pages,
│                                     draft exclusion, forthcoming and archived
│                                     states, published price changes, redirects
├── services.spec.ts                  canonical packs and prices, the prefilled
│                                     WhatsApp message, the hosted Discovery
│                                     Call, the comparison, no service commerce
├── about.spec.ts                     the story, the placeholder portrait, roles
│                                     without names, the method, no testimonial
├── contact.spec.ts                   the three channels, the absent form,
│                                     reading order, keyboard, draft exclusion
├── legal.spec.ts                     effective dates and revision selection,
│                                     provisional text, retained revisions,
│                                     slug redirects, the launch gate
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

Two parts of that gate are already enforced in code, and they reinforce each
other. Every legal document ships as provisional text, so
`readEffectiveLegalTerms().checkout` reports `blocked` and names what is still
waiting for WeCreate's own text until an editor publishes an approved revision of
each. And every Digital Product ships without purchase enabled, without a cover,
without its inclusions and without an activated Paid Deliverable Version, so
`purchaseRequirements()` refuses all six — including on the strength of that same
unapproved licence. See *Legal documents* and *The Boutique and Digital Products*
above.
