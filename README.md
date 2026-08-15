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
| Commerce          | Supabase, behind the back office at `/commerce` |
| Payments          | FedaPay, on its own hosted page                 |
| Transactional email | Resend, for receipts and Order Access         |
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
| `pnpm test:contract`| The provider-contract smoke suite; skips with no credentials |
| `pnpm capture:fedapay`| Capture one FedaPay sandbox webhook delivery for that suite |

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
4. **Commerce data plane** — which one this process talks to, the Supabase
   project and anonymous key when that is Supabase, and the secret that lets
   this deployment record a payment event. There is no service role key: see
   *The commerce data plane* below.
5. **Payments** — which provider takes the money, FedaPay's secret key, the
   endpoint secret its webhooks are signed with, and which of its two
   environments this deployment uses. Sandbox unless something explicitly names
   the live one.
6. **Transactional email** — which provider carries a buyer's receipt, its key,
   and the verified address that receipt comes from.
7. **Preview and revalidation secrets** — who may open a preview session and who
   may drop the content cache.
8. **Acceptance-test hooks** — set by `playwright.config.ts`, never by hand.

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

Every other integration has a boundary of the same shape. Mux is under
`src/video-playback/`; see *Portfolio Projects and video* below. Supabase is
under `src/commerce/`; see *The commerce data plane*. FedaPay is under
`src/payments/`; see *Guest checkout*. Resend is under `src/email/`; see
*Fulfillment and Order Access*. Calendly is the
exception and never gets one: the site links to its hosted page and loads none
of its code, so there is no vendor behind a boundary to hide (see *Services and
Service Enquiries*).

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
text rather than the placeholder that ships. `readPurchaseContext()` in
`src/commerce/` supplies the two answers Managed Content cannot give: whether
that licence is approved, and which SKUs have an activated Paid Deliverable
Version. On a shipped checkout neither is true, so every product reads *Bientôt
disponible*, and in preview each one lists what it is still missing — including
the two things no editor can fix, so they know who to ask.

A visitor is told one of three things: *Disponible*, *Bientôt disponible*, or
*Plus disponible*. The third is archiving, and it is not deletion: an
`isArchived` product leaves the Boutique, the homepage teaser, the sitemap and
search, and keeps its identity and its page, because an Order Snapshot, an Order
Access grant and a receipt all point at it. *Ajouter au panier* is rendered for
*Disponible* and for nothing else, so on a shipped checkout it appears nowhere at
all: a buy button that could not take money would be worse than none.

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

## The Digital Cart

One copy of each Digital Product a shopper means to buy, carried for thirty
days, and checked against what WeCreate actually sells before any of it can be
paid for.

```
src/digital-cart/
├── cart.ts             what may be stored, and what the shop makes of it
├── cookie.ts           the thirty-day cookie
├── actions.ts          add, remove, accept a new price — as Server Functions
└── use-digital-cart.tsx the browser's side: the drawer, the count, the controls
```

**The cookie is a list of identifiers, and nothing in it is believed.** It holds
one pair per line — a Digital Product's id, and the whole-XOF amount the shopper
last accepted — and no title, no Paid Deliverable, and nothing about the person
carrying it. Every title, every price and every answer to *may this still be
bought* is read back from published Managed Content and from
`readPurchaseContext()` each time the cart is shown, which is what issue #1 means
by treating the stored cart as a convenience pointer. The amount is stored for
one purpose and used for one: noticing that a published price has moved. It is
never displayed and never charged — the drawer prints today's price and says
that it changed, and the figure in the cookie only decides whether it has to say
so.

**Why the amount is there at all**, against an acceptance criterion that asks
for identifiers only: telling a shopper their price has changed means knowing
what it was before, and an anonymous cart has nowhere else to keep that. The
alternatives are a server-side store keyed to a shopper who has no identity —
which puts a database on the browsing path ADR-0003 keeps it off — or never
warning a returning shopper at all. Tampering with it buys nothing: set it low
and the shop asks you to accept today's price, set it to today's price and you
have skipped a confirmation for yourself. Nothing gets cheaper either way.

A cart that names something the shop cannot resolve therefore fails safe rather
than failing loudly. Four outcomes, and the last is what makes ADR-0006
structural rather than a rule someone has to remember:

| What the identifier names          | What the shopper sees                     |
| ---------------------------------- | ----------------------------------------- |
| a product WeCreate may sell        | an ordinary line                          |
| one whose price has changed        | the new amount, and a request to accept it |
| one archived or not on sale        | the line, the reason, and no way past it  |
| anything else                      | dropped, counted, and said out loud       |

A service pack, an add-on and the Wedding Film Signature all land in the last
row by construction: the cart resolves Digital Product identities, and a service
offer has none.

**Accepting a price accepts the one that was on screen.** *Accepter les nouveaux
prix* sends the amounts the drawer was showing, and a line is accepted only
where that amount is still the amount on sale. A price published between the
drawer being drawn and the button being pressed is therefore refused and asked
again with the newer figure — accepting an amount nobody has seen is the exact
surprise the step exists to prevent.

**It is the one cookie here a page may read.** Every other one this application
sets is `httpOnly`, because every other one is a credential. This is a shopping
list, so being readable costs nothing and buys the header its count without a
request — a visitor whose cart is empty, which is every visitor before the
Commerce Launch Gate, causes no cart traffic at all. Nothing else is read from
it in the browser, and the application is still its only writer: the four
Server Functions in `actions.ts` own every change, which is also what gives a
state-changing surface its CSRF protection without inventing a token scheme.

The drawer is quick review and removal with the checkout action anchored below a
scrolling list, which is the shape issue #1 asks for on a phone. Form entry is
not there: *Passer commande* leaves for `/commande`, which is the next section.

## Guest checkout

Where a Digital Cart becomes an order, and the buyer leaves for a page WeCreate
does not host.

```
src/checkout/
├── guest.ts      the four things a guest is asked for, and what is refused
├── checkout.ts   which of five states a buyer has arrived at
├── index.ts      resolving all of it again, on the server
├── session.ts    the http-only cookie naming the order in progress
├── actions.ts    starting a payment, and starting one again
├── form.ts       what the guest form remembers between submissions
└── messages.ts   what the checkout says when a submission is not a payment

src/payments/
├── types.ts           a hosted payment, a delivered event, and how each fails
├── provider.ts        the interface, and which implementation is in use
├── fedapay/provider.ts  FedaPay over REST — the only module that knows it
├── fedapay/webhook.ts   its signature scheme, and how its events read
└── fixture/provider.ts  the deterministic one the acceptance suite runs against
```

**Nothing the browser sent decides anything.** `readCheckout()` resolves every
product, its published title, its price, whether WeCreate may still sell it,
whether a Paid Deliverable Version stands behind it and which Legal Revisions
are in force — from Managed Content and the commerce data plane, at the moment
the page is drawn, and again at the moment the order is written. The cart cookie
contributes identifiers; the form contributes a name, an email, a telephone, an
optional company and which revisions were ticked. No amount, no currency, no
product, no total and no provider identifier is believed from a request.

The composition is the approved Variant C: a black Order Snapshot ticket beside
a white working surface, stacking on a phone with the ticket compressed to its
total and its duration so the active state is on screen without scrolling. Five
states share it — the guest form, a cart that needs a price accepted or a
product removed, an empty cart, a checkout that is not open, and an order
already with the payment provider — and they are told apart by words and
structure, never by a status colour.

**A second payment *while one is outstanding* is the thing this refuses
hardest.** After a buyer has been redirected, WeCreate cannot know whether they
paid — only a verified webhook may say so — so `/commande` stops offering any
way to pay and points at the verification page instead. What decides that is the
Payment Prospect — `paymentProspect()` in `src/commerce/orders.ts` — and it is
the same answer the checkout, the payment return page and Postgres all act on:

| Prospect    | When                                                      | What is offered      |
| ----------- | --------------------------------------------------------- | -------------------- |
| `awaiting`  | an attempt is open and no verified event has answered it   | nothing but waiting  |
| `resumable` | pending, inside twenty-four hours, nothing ever opened     | the same order again |
| `retryable` | refused or cancelled, inside twenty-four hours             | the same order again |
| `closed`    | approved, or past those twenty-four hours                  | the Boutique         |

**The two middle rows are the retry, and it is one more attempt rather than one
more order.** `resumable` is issue #10's: the payment page never opened, so the
guest form comes back with what the buyer typed and pressing it again opens
another attempt against the *same* Order Snapshot. `retryable` is issue #13's:
`/commande/retour` says the payment did not go through and offers *Reprendre le
paiement*, which is a link back to `/commande` because the provider needs a
name, an email and a telephone and the data plane deliberately will not hand
those back for a reference. Either way the reference, the products, the prices,
the Paid Deliverable Versions and the accepted Legal Revisions are the ones
already recorded, and pressing the control changes no Payment State — only a
verified webhook does that. A retry is also not asked to accept anything: the
Legal Revisions the order recorded are the ones it keeps, so the acceptances are
absent from that form rather than collected again and discarded.

The two differ in one place, and it is the cart. An attempt that never reached
the provider leaves the buyer where they were, still in this checkout with this
cart, so it is resumed only while the cart holds exactly what the order
recorded. An order FedaPay refused is resolved **before the cart is consulted at
all**: for twenty-four hours the Order Snapshot is what is being paid, so a
price the catalogue published since, a product WeCreate withdrew since and a
cart the buyer emptied since have no say in it. What the cart holds decides what
a *new* order would contain, which is a different question and the one asked
once the window has closed.

A buyer who has changed their mind can leave the order — it stays recorded, and
their browser stops pointing at it. That control is on the two surfaces that
hold them to one: a payment already with the provider, and a `retryable` order.
Not on `resumable`, which needs no way out because it *is* resolved against the
cart — changing the cart is already the way past it.

**The order is written before FedaPay is contacted.** `commerce_create_order`
stores the Order Snapshot, its accepted revisions and a `pending` payment
attempt in one transaction, so a transaction that reached the provider always
has a record here to explain it. Only then is a hosted payment created; the
attempt is settled `redirected` with the provider's transaction id, or `failed`
with the reason. What each line receives is decided in Postgres, not here: the
function reads the Paid Deliverable Version activated at that instant, sums the
total from the lines it stored, and refuses outright if a product lost its file
in between.

**`/commande/retour` cannot approve anything.** It declares no `searchParams` at
all, so a provider's callback values and a forged `?status=approved` are not
merely distrusted — they are never read. It prints what the data plane has
recorded, and the only thing that can put a decision there is a verified
webhook.

**`POST /api/paiement/fedapay` is that webhook, and the one caller in this
application whose word moves a Payment State.** The order of what it does is the
security of the surface: a deployment with no payment provider answers 404; the
body is bounded at 64 KB before it is read; the *raw* body is verified against
`X-FEDAPAY-SIGNATURE` before anything is parsed; and every verified delivery
gets the same `{ "received": true }` whatever it turned out to mean, so the
difference between "that transaction is one of ours" and "it is not" is not
something a prober can read off a status code. Verification itself is the
provider's and lives in its adapter — the route knows that events are signed and
nothing about how (ADR-0008). Without `FEDAPAY_WEBHOOK_SECRET` nothing verifies,
which leaves every order pending: the safe failure, and one to notice before
going live.

**Events are the record; the Payment State is a conclusion drawn from them.**
Every verified delivery is written to `commerce.payment_events` with FedaPay's
own identity and timestamp on it, and nothing edits or deletes one.
`(provider, provider_event_id)` is unique, so a redelivery is recognised and
acknowledged without anything happening twice — which is what makes a provider's
retries safe, and what fulfillment hangs off. What an
event is then allowed to do is one rule in two places, `paymentEventEffect()` in
`src/commerce/orders.ts` and `commerce.payment_event_effect` in Postgres, and
Postgres is not taking the application's word for the signature either: it is
the only function granted to `anon` that can approve a payment, and it is
addressed by FedaPay's transaction id rather than by an unguessable reference,
so it demands `WECREATE_PAYMENT_EVENT_SECRET` before it reads a row. A leaked
anonymous key approves nothing. The rule itself:
`transaction.created` announces a transaction and changes nothing; a pending
order takes the first outcome that reaches it; an approval decides an order
whose payment had not succeeded; and anything else is recorded and ignored.

**One direction is closed and it is the one that matters: nothing may unsay
that a buyer paid.** An approved order is final against every later event, so a
refusal, a cancellation and a provider retrying out of order are all kept for
reconciliation rather than acted on (ADR-0005, ADR-0009). A refusal is *not* final in the
same way, because a buyer may pay again for twenty-four hours (issue #13) and a
retry that could never be approved would be a button that cannot work — but the
only thing that may replace it is an approval, so a second refusal cannot
rewrite the first. An event for a transaction this deployment never opened is
acknowledged and dropped — that is another environment's webhook, not an error.

**An attempt carries what FedaPay finally said about it**, read back out of
those events rather than stored beside them, so the two cannot drift. It is what
tells an outstanding payment from a settled one once an order has more than one
attempt: an order still recording *Paiement non abouti* may have a fresh
transaction open with FedaPay, and that is exactly when a second payment page
would charge somebody twice.

**`GET /commande/etat` is what the buyer's page polls, and it answers where the
payment stands and whether anything is still coming.** It lives under
`/commande` rather than `/api` because that is where the order cookie is scoped:
the order is the one this browser is carrying, never one a caller names, so no
reference reaches an access log, a referrer or a browser history. It returns a
Payment State, a Fulfillment State and whether an attempt is still outstanding,
and there is nowhere in it for anything *about the order* to appear — not the
reference, not the total, not the product, not the masked address. That is the
rule it keeps, rather than a count of fields. A browser with no order, an order
nobody here knows and an unreachable data plane all answer `unknown` and stay
outstanding, which the page treats as "keep waiting" and never as a failure.

The third word is there because the first two stopped answering the question.
Once a buyer may pay again, a refused retry leaves the Payment State exactly as
it was, so a page watching that state for a change would go on saying
*Vérification du paiement* over a payment FedaPay had already refused twice.

**The waiting itself is the only client-side code on the checkout.**
`PaymentVerification` asks that endpoint on a growing delay — two seconds out to
twenty, then it stops and says so — and refreshes the route once nothing is
outstanding any more, rather than rendering the new state itself. A hidden tab and an offline
browser schedule nothing at all; the browser's own `online` and
`visibilitychange` events restart it, which is faster than any interval. A
request that failed or timed out is never evidence: the page keeps saying
*Vérification du paiement*, and a dropped connection is said out loud as a
dropped connection. Issue #1 is explicit that connectivity uncertainty must
never become a failed payment.

The states are told apart by their heading, their structure and what a buyer can
do next — never by a colour, and the mark beside each (`✓`, `×`, `…`) is
`aria-hidden` decoration with the word beside it. What each says is the Payment
State and the Payment Prospect together, because neither answers alone: a
refusal offers *Reprendre le paiement* while the order is inside its window and
the way back to the Boutique once it is not, and a payment being verified and an
approved one offer no second payment at all, which is the distinction issue #13
asks this surface to draw. A payment being relaunched leads with *Vérification
du paiement* and says so in as many words, with the refusal it has not replaced
still printed underneath: leading with the refusal while a transaction is open
would invite the very second payment this page exists to prevent. And a `pending`
order with nothing outstanding — a payment page that never opened, or one
nobody ever heard back about — reads *Paiement non confirmé* rather than
borrowing the sentence about waiting for FedaPay, because nothing is on its way.

**Approved says the money arrived and stops there**, and what follows it is
decided by the Fulfillment State printed beside it: what was bought and where
the files open from, or a way to be helped. Payment and delivery are two facts
and this page prints two — see *Fulfillment and Order Access* below.

The buyer's contact details are recorded with the order and are deliberately
absent from what the boundary reads back: an order is addressed by its reference
alone, with no session behind it, so the read returns what was bought, what it
costs, where payment stands and a masked `a***@exemple.com` — enough for a buyer
to recognise their own address and not enough for anyone else to learn one. The
reference carries fifty bits of randomness for the same reason. The back office
reads the rest under a staff identity (issue #15).

Both `/commande` and `/commande/retour` are out of search results on every
deployment, as every transaction surface on this site is.

**FedaPay is two REST calls and no SDK** — create the transaction, ask for its
payment token, send the buyer to the URL it answers with — plus one signature to
verify on the way back in. `FEDAPAY_SECRET_KEY` and `FEDAPAY_WEBHOOK_SECRET` are
both server-only and there is no `NEXT_PUBLIC_FEDAPAY_*` anything, because no
browser here ever holds a payment credential. `FEDAPAY_ENVIRONMENT` selects
sandbox or live and defaults to sandbox; switching it is the Commerce Launch
Gate's own irreversible decision — see *Before this goes live*.

### Setting up FedaPay

1. Create a FedaPay account and work in its **sandbox** until the Commerce
   Launch Gate says otherwise. Put the sandbox secret API key in
   `FEDAPAY_SECRET_KEY`; leave `FEDAPAY_ENVIRONMENT` unset.
2. In *Workbench → Webhooks*, add an endpoint at
   `POST {origin}/api/paiement/fedapay` subscribed to the transaction events —
   `transaction.approved`, `transaction.canceled`, `transaction.declined` and
   `transaction.created`. Anything else it sends is acknowledged and ignored.
3. Reveal that endpoint's secret and set it as `FEDAPAY_WEBHOOK_SECRET`. It is
   generated per endpoint and per environment: sandbox and live never share one,
   and neither do staging and production.
4. Prove it end to end before trusting it. Send a test delivery from FedaPay's
   webhook tooling and check the endpoint answers `200`; a `401` means the
   secret does not match. Then run one sandbox payment through `/commande` and
   watch `/commande/retour` move to *Paiement approuvé* on its own.

#### Capturing a delivery for the contract suite

The contract suite is the only thing in this repository that can prove the
adapter reads FedaPay's real signature scheme and its real event shape — the
acceptance suite runs a fixture that signs its own way on purpose, so it cannot.
The suite cannot provoke a webhook either: a webhook goes to a public address.
So it runs against a delivery you capture once, here:

1. `pnpm capture:fedapay` — a bare HTTP server on port 4488 that writes the next
   delivery to `.wecreate/fedapay-delivery.json`, which is gitignored.
2. Expose it: `ngrok http 4488`, or any tunnel that gives an `https://` address.
3. Add a **second** sandbox webhook endpoint in *Workbench → Webhooks* pointing
   at that address, subscribed to the same four events, and reveal its secret.
   It is its own endpoint with its own secret — a capture only ever verifies
   against the secret of the endpoint that sent it, so keep the two together.
4. Make one sandbox payment. `transaction.approved` is the capture worth having;
   `transaction.created` parses too and proves less.
5. Run the suite:

   ```bash
   FEDAPAY_SECRET_KEY=sk_sandbox_… \
   FEDAPAY_WEBHOOK_SECRET=wh_sandbox_… \
   FEDAPAY_WEBHOOK_DELIVERY=$PWD/.wecreate/fedapay-delivery.json \
   pnpm test:contract
   ```

6. Delete the temporary endpoint in FedaPay. The tunnel address dies with the
   tunnel, and the endpoint would go on collecting failed deliveries.

**Never copy the body out of the dashboard.** The signature is over the exact
bytes FedaPay sent; a body that has been pretty-printed, re-indented or passed
through `JSON.parse` is a different body and will not verify however correct the
adapter is. That is what the capture script is for, and it never parses the body
on the way to disk.

**Capture from the sandbox only.** A live delivery carries a real buyer's
contact details and this writes them to disk in the clear.

Capture a fresh one whenever FedaPay changes its API version: it is the only
thing here that can catch that scheme moving before a buyer does.

## Fulfillment and Order Access

What an approved payment turns into: a durable grant per purchased product, one
receipt, and files the buyer can open for thirty days without an account.

```
src/fulfillment/
├── token.ts     the credential a buyer is emailed, and the digest that is kept
├── receipt.ts   what WeCreate writes to a buyer whose payment was approved
├── session.ts   the http-only cookie the emailed address is exchanged for
├── messages.ts  what the access surfaces say when something is refused
└── index.ts     the workflow: claim, grant, send, settle — and the two reads

src/email/
├── types.ts             a transactional message, its idempotency key, and how
│                        sending one fails
├── provider.ts          the interface, and which implementation is in use
├── resend/provider.ts   Resend over REST — the only module that knows it
└── fixture/provider.ts  an outbox on disk, for the acceptance suite

src/commerce/order-access.ts   thirty days, five downloads, fifteen minutes, and
                               how all three are said in French
```

**Payment and delivery move independently, and delivery never leads** (ADR-0005).
The webhook records the event first; only a *first effective approval* then
starts a delivery, and the delivery cannot fail that request — a receipt that
did not go out leaves an approved payment approved, and the buyer's page leads
with *Paiement approuvé* whatever happened next.

**One approval delivers once, and the data plane decides that rather than the
application.** `commerce_begin_fulfillment` claims the order with its row
locked: a Fulfillment State leaves `not_started` exactly once, so a redelivered
webhook, a retried request and two processes racing produce one set of grants
and one receipt between them. Idempotency that lived in one process would be one
process's opinion.

**The order of the steps is the guarantee.** The grants are made *inside* the
claim and the receipt is attempted after, so a buyer whose email never went out
still owns everything they paid for — which is why `/commande/retour` lists what
was bought even when the Fulfillment State reads *Livraison à reprendre*, and
adds one way to be helped rather than another way to pay.

**A failed delivery stays failed, for now.** Nothing in this application can
claim one a second time — Postgres refuses the transition, deliberately — so
until the back office gains the retry and the access reissue that issue #15
brings it, resolving one means writing to the buyer by hand with the reference
their page is showing them. That is a small number of orders and a visible
state, which is the right trade against a retry surface nobody has designed.

**Only the digest of the token is stored.** The emailed address carries 256 bits
from a cryptographic source; what the data plane holds is its SHA-256, and
access is looked up by that. A leak of the database is not a leak of anybody's
files, and no log, query or backup can contain a working credential. It is a
plain digest rather than a password hash because the input is already 256 random
bits: there is no dictionary to slow down.

**The token stops travelling at the first page.** `/commande/acces/<token>`
moves it into an http-only cookie scoped to `/commande/acces` and redirects to
`/commande/acces`, so what the buyer then reads, reloads, bookmarks or shows
somebody carries no credential and sends none in a referrer. An expired token, a
replaced one and one nobody was ever given all produce the same page, which
names no product and no order — working through guesses never reveals that an
order exists. Rate limiting on that is issue #17's.

**A grant belongs to an order line, not to a token.** So reissuing a token —
a lost email, a corrected address (issue #15) — leaves the allowance where the
buyer left it, and a grant keeps pointing at the Paid Deliverable Version its
Order Snapshot recorded rather than at whatever is on sale today. Archiving the
product changes nothing about it.

**A download is counted when a file is handed over, not when a button is
pressed.** Pressing *Télécharger* is a form `POST` — a `GET` could be prefetched,
scanned or replayed out of history, and each of those would spend one of the
five for the buyer. The route then reads and refuses, asks Storage for a
fifteen-minute address, and only then spends a download, so a store that did not
answer costs nothing. And while the last address is still good, asking again is
the *same* download signed to die at the same moment: a normal delay must not
cost part of what somebody paid for, and extending it instead would mean a buyer
who kept pressing never spent a second one.

**The signed address is never rendered.** It crosses the commerce boundary — the
one exception to that boundary's rule — to be redirected to, and it is not
printed, logged or stored. What the pages show is a title, a date and a count:
no bucket, no token, no signature, no expiry in minutes.

`/commande/acces` and the download are out of search results on every
deployment, as every transaction surface here is.

### Setting up Resend

1. Create a Resend account and add WeCreate's domain, then complete its DNS
   verification. A verified sender is one of the Commerce Launch Gate's own
   prerequisites — until it is done, receipts either fail to send or land in
   spam, and both are a buyer who did not get their files.
2. Create an API key with permission to send, and put it in `RESEND_API_KEY`.
   Staging and production get separate keys and separate senders.
3. Set `RESEND_FROM_ADDRESS` to an address on that verified domain, in the form
   `WeCreate <commandes@wecreate.bj>`.
4. Prove it end to end: run one sandbox payment through `/commande`, watch
   `/commande/retour` reach *Livraison envoyée*, open the address in the
   message, and take one download.

Without a key there is no email provider, and that is a deliberate state rather
than a broken one: the grants are still made, and the Fulfillment State reads
*Livraison à reprendre* so a buyer who received nothing is visible as one.

## The commerce data plane

The other half of the shop, and the other side of the business. Supabase holds
the private files WeCreate sells, which version of each is on sale, WeCreate's
own staff accounts, and an append-only record of what they did. It is reached
through one boundary of the same shape Managed Content has (ADR-0008):

```
src/commerce/
├── types.ts             Paid Deliverable Version, Commerce Operator, audit
│                        entry, Order Snapshot, Payment State, order state
├── provider.ts          the interface, and which data plane is in use
├── paid-deliverables.ts what may be uploaded, and where its bytes are addressed
├── orders.ts            how an order is named, how long it may still be paid,
│                        and what a verified event does to its Payment State
├── operators.ts         who may see and change commerce data
├── session.ts           the operator's session, in an http-only cookie
├── actions.ts           everything an operator can do, as form submissions
├── messages.ts          what the back office says after one, in French
├── tag.ts               the cache tag the public read carries
├── index.ts             the cached public read, and the purchase context
├── supabase/            the Supabase implementation
└── fixture/             the deterministic one the acceptance suite runs against
```

`/commerce` is where a Commerce Operator works. It is not part of the website:
no header, no footer, no cart, and `noindex` on every deployment including
production. It holds Digital Product commerce and nothing else — Service
Enquiries and Calendly bookings are not there and never will be (ADR-0006).

**Two proofs, every time.** Each staff member has their own Supabase Auth
account and their own authenticator. That nobody shares an account is WeCreate's
own rule rather than something code can detect — but nothing here makes a shared
one convenient: sign-up is disabled, each account needs its own enrolled factor,
and every audit entry names the individual who acted. A password reaches assurance level 1 and
opens nothing: **reading** which files WeCreate sells is behind level 2 exactly
as changing them is. A staff member with no factor yet is sent to
`/commerce/securite` to enrol one, and enrolling a *second* — the backup that
keeps a lost phone from locking WeCreate out of its own commerce data — needs
level 2 first, so a stolen password cannot add an authenticator nobody asked
for. Being fully authenticated is still not being allowed: a Content Editor at
level 2 is refused, because editorial and commerce are separate permissions even
when one person holds both (issue #1).

**A version is created once and never edited.** An upload becomes the next
numbered Paid Deliverable Version of one SKU, with its size, its file name and a
SHA-256 checksum computed here rather than taken from the browser. Its bytes are
stored under an address derived from that checksum, so a store that refuses to
write over an existing object is all it takes to make a version unwritable-over:
uploading the same file again resolves to the same address, is refused, and is
told it is already a version. A replacement is a different file, and becomes the
next version.

**Uploading is not selling.** Activation is a separate, deliberate action, which
is what lets WeCreate replace a deliverable, check it, and only then put it on
sale. Activating changes one row — which version future purchases receive — and
touches no version at all, so an Order Snapshot keeps exactly the file it
recorded. Both actions write an audit entry naming the individual, the moment,
the product and the safe half of what changed on either side: version numbers,
file names, checksums, and never a secret, a token or a storage address.

**Supabase stays off the public browsing path** (ADR-0003). The one thing the
Boutique needs — which SKUs have an activated version — is read through
`readActivePaidDeliverableSkus()`, cached under the `paid-deliverables` tag, and
activating a version expires that tag, so a product goes on sale on the next
request rather than whenever a cache happened to turn over. A visit to
`/boutique` reaches no database. If the data plane is unreachable, the answer is
that nothing may be sold: a product WeCreate cannot confirm a file for reads
*bientôt disponible* rather than taking money for something it may not be able
to deliver.

**Orders live here too, and are the one thing a guest may write.** The order
functions carry no session, because a buyer has none — and neither has a payment
provider posting a webhook. Same posture as the public read above, and bounded
the same way: an order is addressed by a reference with fifty bits of randomness
in it, and reading one returns no contact details beyond a masked address. The
one function that can approve a payment is the exception to the whole posture —
it is addressed by the provider's transaction id, which is a small integer — so
it is the only one that is not granted on the strength of the anonymous key
alone: it demands `WECREATE_PAYMENT_EVENT_SECRET` before it reads a row.
Triggers make the lines, the accepted
revisions and the payment events unwritable, refuse any update that would change
what an order contains or who it is for, and close the one direction a Payment
State may never move in: nothing may leave `approved`, and a refusal may be
replaced by an approval and by nothing else — so no application bug and no
support action can unsay that a buyer paid (ADR-0005, ADR-0009), while the retry
issue #13 asks for is still a payment that can succeed.

**Postgres enforces the same rules, against requests that never render a page.**
`supabase/migrations/` is the record. The tables live in a `commerce` schema that
is not exposed to the data API at all; the functions in `public` are the whole
surface, and each staff-facing one refuses a caller who has not reached assurance
level 2 with the Commerce Operator role. Triggers make the versions and the audit
trail append-only, so no application bug and no operator can rewrite either. The
private bucket has an insert policy and deliberately no select, update or delete
policy: nothing may overwrite a stored version, and nothing reads a Paid
Deliverable with a staff session — a buyer receives one through Order Access,
which signs a fifteen-minute address against the anonymous key after Postgres
has checked their token, their grant and their allowance.

**There is no service role key.** The back office signs in as the individual
doing the work and every statement runs under their identity, which is what makes
`auth.uid()` in an audit entry mean something and what stops those policies from
being decorative. Nothing Supabase reaches the browser either: no
`NEXT_PUBLIC_SUPABASE_*` exists, because there is no browser-side Supabase call
to configure.

**A session lasts as long as its credentials.** An operator signs in for an
hour, which is what Supabase's access token is good for. Holding one longer
means persisting a rotated refresh token on every action — a page cannot write
a cookie in Next.js — and that is work worth doing when the back office grows
the daily use issue #15 brings it, not for a surface someone opens to upload a
file. A session that claimed to last a working day and quietly stopped working
after an hour would be worse than one that ends when it ends.

One limit worth knowing before real deliverables arrive: an upload travels
through the application rather than straight to storage, so it is bounded by the
request body the deployment will carry — 25 MB here, and `serverActions
.bodySizeLimit` in `next.config.ts` is kept a megabyte above it for multipart
overhead — and note that limit is global, because Next.js has no per-route one:
it is also the ceiling on the Digital Cart's own Server Functions, which carry a
handful of identifiers and come nowhere near it, so what actually bounds an
upload is `MAX_DELIVERABLE_BYTES`. A platform with a
smaller request limit of its own (Vercel's serverless functions cap request
bodies well below this) needs the upload to go directly to storage against a
signed upload URL before a large ebook can be uploaded there. Final Paid Deliverables are an external launch input in any case
(issue #1), so this is a Commerce Launch Gate item rather than a live problem.

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

## Setting up Supabase

Until this is done the site runs, the Boutique reports that no product has an
activated file, and `/commerce` says it is not configured. That is a correct
state, not a broken one — and it is the state a fresh checkout should be in.

1. Create a project at [supabase.com](https://supabase.com) in the **Paris**
   region (ADR-0003), plus a separate project per non-production environment.
   Staging and production never share a project, a bucket or a key.
2. Apply [`supabase/migrations/`](./supabase/migrations) in filename order —
   `supabase db push`, or the SQL editor for a one-off. They create the
   `commerce` schema, the private `paid-deliverables` bucket, the policies and
   the functions the application calls. Leave `commerce` out of the project's
   exposed schemas: the functions in `public` are the whole surface, on purpose.
3. Put the project URL and the **anon** key in `.env.local` (`SUPABASE_URL`,
   `SUPABASE_ANON_KEY`). Both are server-only. Do not add the service role key
   to this application — nothing here uses one, and adding it would let a leaked
   environment read every order WeCreate will ever take.
4. Generate a secret of WeCreate's own for this environment, put it in
   `WECREATE_PAYMENT_EVENT_SECRET`, and store its digest:

   ```sql
   insert into commerce.payment_event_authorisation (secret_digest)
   values (encode(sha256(convert_to('<the secret>', 'UTF8')), 'hex'))
   on conflict (id) do update
      set secret_digest = excluded.secret_digest, updated_at = now();
   ```

   This is what stands between a leaked anonymous key and an approved order.
   Every other function granted to `anon` either writes something nobody has
   paid for or is addressed by a fifty-bit reference;
   `commerce_record_payment_event` can approve a payment and is addressed by
   FedaPay's transaction id, which is a small integer a caller could walk. With
   this in place, calling it directly is no easier than forging a signed webhook.
   Until it is in place, every payment stays pending — which is the safe failure,
   and one to notice before real buyers arrive.
5. In *Authentication → Providers*, leave email sign-up **disabled**: WeCreate
   creates staff accounts itself, one per person, and there is no self-service
   registration for a commerce back office.
6. Create one account per member of staff, and give the ones who administer
   commerce the role the policies ask for:

   ```sql
   update auth.users
      set raw_app_meta_data =
            coalesce(raw_app_meta_data, '{}'::jsonb)
            || jsonb_build_object('roles', jsonb_build_array('commerce_operator'))
    where email = 'prenom.nom@wecreate.bj';
   ```

   A Content Editor does not get it, even when the same person also edits
   content. Roles live in `app_metadata` rather than `user_metadata` because a
   signed-in user can edit the latter.
7. Each staff member signs in at `/commerce`, is sent to `/commerce/securite`,
   and enrols their authenticator. Ask everyone to enrol a **second** one on
   another device straight away: without a backup factor, a lost phone locks
   that person out, and the answer to that must never be a shared account.

Nothing about production purchasing follows from this setup. Uploading and
activating a Paid Deliverable Version is one of the Commerce Launch Gate's
prerequisites, not a way past it — see *Before this goes live*.

## The acceptance seam

```bash
pnpm test:e2e                      # everything
pnpm test:e2e --project=desktop    # one viewport
pnpm test:e2e homepage             # one spec
```

One harness. It builds the application exactly as it ships, starts it against
the fixture content provider and the fixture commerce data plane, and drives it
through Chromium at a desktop and a Pixel 7 viewport. No component tests, no
mocked internals, no production credentials.

```
tests/e2e/
├── homepage.spec.ts                  the approved design and its content
├── portfolio.spec.ts                 filters, counts, the project dialog and its
│                                     keyboard, playback fallback, publication
├── boutique.spec.ts                  family filters, crawlable product pages,
│                                     draft exclusion, forthcoming and archived
│                                     states, published price changes, redirects
├── digital-cart.spec.ts              adding, removing, one copy each, the cookie
│                                     and its thirty days, tampered identifiers,
│                                     withdrawn products, accepted price changes,
│                                     the drawer on a phone, no service offers
├── checkout.spec.ts                  guest validation, legal consent, prices and
│                                     products resolved again, the hosted
│                                     redirect, the secret that stays server-side,
│                                     an immutable snapshot, a provider that
│                                     cannot be reached, a return that approves
│                                     nothing
├── payment-webhook.spec.ts           signed events approving, refusing and
│                                     cancelling; forged, unsigned, malformed,
│                                     oversized and unknown deliveries; retries
│                                     and out-of-order events; the order-state
│                                     boundary and what it will not say; polling,
│                                     going offline, and closing the page
├── payment-retry.spec.ts             the same Order Snapshot paid again after a
│                                     refusal, prices that moved, several
│                                     attempts, what a payment in flight and an
│                                     approval suppress, the twenty-four hour
│                                     boundary, and a retry the provider refused
├── order-access.spec.ts              one delivery per approval, the receipt and
│                                     its idempotency, a failed delivery that
│                                     keeps the payment approved, the emailed
│                                     address, expiry, allowance, temporary
│                                     private links, exhaustion, a product the
│                                     order never bought, and an archived one
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
├── commerce.spec.ts                  staff sign-in and MFA, backup factors,
│                                     role separation, upload, activation,
│                                     the audit trail, private deliverables
├── site-shell.spec.ts                header, navigation, cart, footer, fonts
├── managed-content-publishing.spec.ts draft, preview, publish, revalidate
├── resilience.spec.ts                reduced motion, no JS, nothing published
└── support/
    ├── managed-content.ts            editorial actions, over HTTP
    ├── commerce.ts                   staff, their authenticators, their actions
    ├── digital-cart.ts               arriving with a cart, and reading it back
    ├── checkout.ts                   filling the guest form, and answering the
    │                                 payment provider's hosted page
    ├── payment-events.ts             signing and delivering provider events,
    │                                 and asking where an order stands
    ├── order-access.ts               the buyer's inbox, the emailed address,
    │                                 and what a temporary private link must be
    └── sample-content.ts             stand-in projects and products
```

Tests act as a Content Editor would, through `/api/test/managed-content`, and as
a Commerce Operator would, through the back office itself — signing in with a
password and a code their authenticator really produces, uploading through the
real form. `/api/test/commerce` exists only to return the data plane to its
seeded state between scenarios, which is the one thing no operator can do.

The Digital Cart is the one place a test writes state directly, and both reasons
are themselves under test: a cart that survives a closed browser for thirty days
cannot be demonstrated by clicking, and a cookie a visitor has edited is exactly
the input reconciliation has to be safe against. `support/digital-cart.ts` spells
the stored format out by hand rather than importing it, so changing how a cart is
kept has to be a deliberate change to that file too.

Payment events arrive the way issue #1 asks for — through Playwright's HTTP
request context, as real signed POSTs to the real endpoint of the real build.
The fixture payment provider signs them with its own scheme rather than an
imitation of FedaPay's, so a wrong reading of FedaPay's cannot pass the suite by
agreeing with itself; `support/payment-events.ts` spells that scheme out by hand
for the same reason `support/digital-cart.ts` spells out the cart cookie. Bodies
are sent as bytes, because a signature is over bytes and Playwright re-serialises
a string that is not already valid JSON — which would quietly turn every
malformed-delivery scenario into a test of nothing.

Two things the suite reaches for that no actor can. **The outbox**, through
`/api/test/email`: a receipt goes to an address there is no mailbox for on this
machine, so the fixture email provider keeps what it was asked to send and a
scenario reads it and follows the Order Access address in it — which is exactly
the position a buyer is in. **A clock**, through `/api/test/commerce`'s `age`
action: three of the rules issue #1 asks for are measured in time nobody can
wait out — a twenty-four-hour Order Snapshot window, thirty days of access and a
fifteen-minute file address. Ageing what is stored keeps every assertion about
what the *application* concludes from a moment.

One thing the suite fakes that is not a provider: a browser following an address
to `stockage.wecreate.test`. Chromium resolves the host of a redirected form
submission before Playwright is offered the chance to answer for it, so
`support/order-access.ts` intercepts the submission itself, reads the address
WeCreate really answered with, and hands the browser back to the access page.
The `POST` is real, the route is real, the cookie is this browser's own.

Each hook responds 404 unless `WECREATE_TEST_HOOKS=1` **and** its own provider is
the fixture, so none can be reached on a deployment backed by a real Sanity
project, a real Supabase project or a real mail account. The fixture data plane
ships published staff credentials, which is safe only because it is never
selected by inference: an unconfigured deployment has no data plane at all
rather than falling back to this one.

Content and commerce are each a single shared dataset, so the suite runs
serially. Later tickets that bring per-worker persistence can lift that.

Browsers are installed once with `pnpm exec playwright install chromium`.

**One suite is deliberately not part of it.** `pnpm test:contract` runs
`tests/contract/` against a real vendor sandbox, with its own configuration, no
browser and no server. It checks what a fake cannot: that the request the
FedaPay adapter sends is one FedaPay accepts, that the answer still has a payment
page in it, and that a delivery FedaPay really signed verifies and parses. Its
two halves are gated separately, because they need different things —
`FEDAPAY_SECRET_KEY` for the first, `FEDAPAY_WEBHOOK_SECRET` and a captured
`FEDAPAY_WEBHOOK_DELIVERY` for the second — and each skips itself when its own
is absent, which is every run that has not deliberately been given them. It
refuses to run at all against the live API. It supplements the acceptance suite
and never replaces it (issue #1).

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

## Security headers

Every response carries `X-Content-Type-Options`, `Referrer-Policy`,
`Strict-Transport-Security`, a `Permissions-Policy` and a
Content-Security-Policy. They are set in one place, `headers()` in
`next.config.ts`, and asserted from the outside in
`tests/e2e/security-headers.spec.ts`.

There are two policies, not one. The public site gets the narrow one; `/studio`
overrides it with a wider one, because Sanity's Studio is a vendor
single-page application that evaluates code at runtime and holds a websocket
open to the content API — needs no marketing page has. Both keep
`frame-ancestors 'self'`, which is what lets the Presentation tool preview the
real pages in an iframe and stops anyone else framing them.

**The public policy has no nonce, on purpose.** The strict form of a CSP names a
fresh random nonce per request; Next.js requires dynamic rendering to generate
one, and dynamic rendering is what ADR-0003 spends `cacheComponents` to avoid.
Rather than make every marketing page render per request, `script-src` admits
the inline bootstrap Next.js emits and pins the origin — an injected
`<script src>` pointing anywhere else is still refused, as are `object-src`,
`base-uri` and `form-action`.

**Adding an external service means adding its origin.** The policy names only
what the site genuinely reaches: `cdn.sanity.io` for editorial images,
`*.mux.com` for video, `*.litix.io` for Mux's playback telemetry, and two
origins in `form-action` — `*.fedapay.com`, because a checkout submission
redirects out to FedaPay's hosted page, and the commerce data plane's own
storage host, because pressing *Télécharger* redirects out to a temporary
private address there. Both are there for the same reason: browsers have never
agreed on whether `form-action` follows a redirect. The storage origin is
derived from the data plane's own configuration — `SUPABASE_URL` on a real
deployment, and the fixture's own host when `WECREATE_COMMERCE_PROVIDER` asks
for it — rather than written out, so a project moved to another host cannot
leave it behind. Neither FedaPay nor Resend is in any fetch
directive: both are reached by the server, and no browser here talks to either.
A new embed,
font host, analytics script or payment widget will be blocked until its origin
is added to the right directive — which is the point, but it means the failure
looks like "the thing silently does not load". Check the browser console for a
CSP violation before looking anywhere else.

**Why Mux is a wildcard and Sanity is not.** A playback URL starts at
`stream.mux.com`, but the manifest and segments are then served from whichever
CDN edge Mux picked for that request — `manifest-…-vop1.fastly.mux.com` and its
siblings, which are not knowable in advance. Naming only `stream.mux.com` leaves
the poster frame showing and playback failing with a status-0 network error. The
acceptance suite cannot catch this: it runs on fixture content whose videos are
plain files, so the adaptive path is only exercised against a real Mux asset.
Load a portfolio project in a browser after changing anything under `media-src`,
`img-src` or `connect-src`.

Editors are constrained at the other end: `callToAction.href`,
`navigationLink.href` and `universeCard.href` accept only a site-relative path,
an `https://` address or a `mailto:`, and the Studio says so when they type
something else. This is a usability guard, not an XSS control — React refuses to
render a `javascript:` href at all.

`.github/workflows/audit.yml` runs `pnpm audit` on every pull request, on pushes
to `main`, and weekly, failing on a high or critical advisory. The weekly run is
what catches an advisory published against a dependency nobody has touched.

## Before this goes live

Production purchasing stays disabled until the Commerce Launch Gate is signed
off — see issue #1. Nothing in this repository may switch FedaPay to live; that
is a deliberate, named decision by WeCreate. The switch itself is one
environment variable, `FEDAPAY_ENVIRONMENT=live`, set once, in the deployment
platform's own configuration, by the people whose money it is. Every default in
source is the sandbox, and no code path selects the live API by inference.

Four parts of that gate are already enforced in code, and they reinforce each
other. Every legal document ships as provisional text, so
`readEffectiveLegalTerms().checkout` reports `blocked` and names what is still
waiting for WeCreate's own text until an editor publishes an approved revision of
each — and the checkout answers that gate before it looks at the cart at all, so
`/commande` says it is not open whatever is in one. Every Digital Product
ships without purchase enabled, without a cover, without its inclusions and
without an activated Paid Deliverable Version, so `purchaseRequirements()`
refuses all six — including on the strength of that same unapproved licence. A
checkout with no Supabase project has no commerce data plane at all, so no
version can be activated and no staff account exists to activate one. And a
deployment with no `FEDAPAY_SECRET_KEY` has no payment provider, which is its
own refusal: there is no fallback, and no fake that could stand in for one. See
*Legal documents*, *The Boutique and Digital Products*, *Guest checkout* and
*The commerce data plane* above.

**The two webhook secrets fail quietly, so check them by hand.** Every other gap
above stops a purchase before it starts. A missing `FEDAPAY_WEBHOOK_SECRET` or a
missing `commerce.payment_event_authorisation` row does not: the checkout works,
the buyer pays on FedaPay's page, and the confirmation is then refused — by the
endpoint in the first case, by Postgres in the second — leaving a real payment
sitting at *Vérification du paiement* for ever. That is the safe failure and it
is still a failure. Send a test delivery from FedaPay's webhook tooling and
confirm the endpoint answers `200`, then run one sandbox payment end to end,
before the first real buyer, on every environment, and again each time the
endpoint's URL or either secret changes.

**The sender is the third quiet one.** A deployment with no `RESEND_API_KEY`
takes payment, grants access and then cannot tell the buyer about it: the
Fulfillment State reads *Livraison à reprendre* and the buyer's page says so and
offers a way to be helped, which is the safe failure and still a failure. An
unverified sender domain is worse, because it fails silently in somebody else's
spam folder. Send one receipt to a real mailbox on every environment before the
first real buyer.

Staff MFA is one of the gate's own prerequisites, and it is enforced rather than
documented: there is no path into `/commerce` that does not pass through an
individual account and a second factor. What the gate still asks of WeCreate is
the rest — approved legal text, validated prices, the real Paid Deliverables and
covers, a verified sender domain, client-owned production accounts, sandbox
end-to-end tests, backup and restore checks, monitoring alerts, and MTN/Moov
field tests.
