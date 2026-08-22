# Commerce Launch Gate

The approval boundary that keeps production purchasing disabled until
commercial terms, legal text, real Paid Deliverables, and production
integrations are ready (`CONTEXT.md`). This file is the record. Code
enforces what it can check; WeCreate records the rest here, then a named
owner signs the live switch.

Issue #18 is the ticket. Issue #1 is the specification. Nothing in this
repository selects FedaPay's live API: a process talks to the sandbox until
`FEDAPAY_ENVIRONMENT=live` **and** `WECREATE_LIVE_PAYMENTS_APPROVED_BY`
names the owner who signed below. Setting either one alone, shipping a
release, or copying an environment file, leaves the sandbox in force.

The operator walkthrough is [`docs/operating.md`](./operating.md). The
reference for how each system is set up remains [`README.md`](../README.md).

## What the application already refuses

These hold on every deployment, including one that has just been provisioned.
They are the reason a missing gate item cannot become a live charge.

| Gate item | What the application does | Where it is proved |
| --- | --- | --- |
| Unapproved Legal Documents | Checkout is closed. `/commande` says the shop is not open yet, whatever is in the cart. | `tests/e2e/checkout.spec.ts`, `tests/e2e/legal.spec.ts` |
| Placeholder legal text | Readable, previewable, out of the sitemap and out of search. `readEffectiveLegalTerms().checkout` is `blocked` until every kind has an approved revision in force, mentions légales included. | `tests/e2e/legal.spec.ts` |
| Digital Product not purchase-enabled | *Bientôt disponible*. No *Ajouter au panier*. `purchaseRequirements()` also demands a whole-XOF price, a cover, a summary, inclusions, an approved licence, and an activated Paid Deliverable Version. | `tests/e2e/boutique.spec.ts` |
| No Paid Deliverable Version | Same as above. Neither Managed Content nor commerce can sell on its own. | `tests/e2e/commerce.spec.ts` |
| No payment provider | Checkout closed: *Le paiement en ligne n'est pas encore activé.* | `src/checkout/checkout.ts` |
| No named owner for live payments | `fedaPayEnvironment()` stays `sandbox` even if `FEDAPAY_ENVIRONMENT=live`. | `src/payments/fedapay/provider.ts`, `deploy/bin/check-env.sh` |
| Empty portfolio universe | The filter for that universe is not offered. An empty portfolio offers no filter and ships no project. | `tests/e2e/portfolio.spec.ts` |
| Fabricated client work | No Portfolio Project ships in `src/`. À propos quotes nobody. | `tests/e2e/resilience.spec.ts`, `tests/e2e/about.spec.ts` |
| Staff without MFA | There is no path into `/commerce` that skips an individual account and a second factor. | `tests/e2e/commerce.spec.ts` |
| Personal-data retention without approved privacy terms | Nothing is forgotten. A placeholder revision is not a period anybody agreed to. | `tests/e2e/security-regression.spec.ts` |

The three quiet failures — a missing webhook secret, a missing payment-event
authorisation row, an unverified sender — still take a sandbox payment and
then fail to confirm or to tell the buyer. They are on the sandbox journey
below, not on this table, because they do not block the checkout.

## Checklist

Each row is either already proved by the application, or is WeCreate's to
record before the sign-off. A blank *Recorded* cell is an open gate item.

### Digital Products

A product becomes purchase-enabled only after its price, cover, description,
licence, Paid Deliverable Version, delivery test, and support path are
approved (issue #1). The first six of those are checkable in code; the last
two are this table.

| Product | Price | Cover | Description & inclusions | Licence in force | Active version | Delivery test | Support contact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

Tick a cell when that product's own evidence exists. Enabling *En vente* in
the Studio before this row is complete is what the Boutique then has to
refuse — and will, until the licence and the file are there too.

### Legal Documents

Approved CGV, privacy, refund/digital-delivery, licence, and mentions
légales, with effective revisions. Retention direction is the privacy
revision in force plus `WECREATE_PERSONAL_DATA_RETENTION_DAYS`. Receipt
wording is the branded HTML already sent; fiscal invoices are out of scope
(issue #1) and are not a gate item.

| Document | Approved revision id | Effective from | Recorded |
| --- | --- | --- | --- |
| CGV | | | |
| Livraison et remboursement | | | |
| Licence des produits numériques | | | |
| Politique de confidentialité | | | |
| Mentions légales | | | |
| Retention days (named in the privacy revision, set in `shared/env`) | | | |

### Portfolio

At least six approved real Portfolio Projects covering the advertised
universes, or empty universe filters hidden. Fabricated client work and
testimonials never reach production.

| Universe | Approved projects (count, titles) | Recorded |
| --- | --- | --- |
| Entreprises | | |
| Immobilier | | |
| Mariage | | |

Until a universe has published work, `/portfolio` does not offer it as a
filter. The shipped site has none.

### Ownership and collaborator access

WeCreate owns the domain, GitHub repository, hosting, Sanity, Supabase, Mux,
Resend, Calendly, FedaPay, analytics, and monitoring accounts and billing.
Developers receive revocable collaborator access.

| Account | Owner (WeCreate) | Billing | Collaborators | Recorded |
| --- | --- | --- | --- | --- |
| Domain | | | | |
| GitHub (`Lamakira/wecreate`) | | | | |
| Hosting (Paris VPS, ADR-0011) | | | | |
| Sanity | | | | |
| Supabase | | | | |
| Mux | | | | |
| Resend | | | | |
| Calendly | | | | |
| FedaPay | | | | |
| Cloudflare (analytics, Zaraz, CDN) | | | | |
| Sentry | | | | |

### Production verification

| Item | Where | Recorded |
| --- | --- | --- |
| Production sender domain verified in Resend | | |
| Staff individual accounts, MFA enrolled, backup factor on a second device | `/commerce/securite` | |
| Environment secrets complete (`deploy/bin/check-env.sh` as root) | `/srv/wecreate/shared/env` | |
| FedaPay webhook endpoint answers `200` to a test delivery | `POST {origin}/api/paiement/fedapay` | |
| Sanity revalidation webhook | `POST {origin}/api/revalidate` | |
| Private Paid Deliverable bucket: insert only, no select | Supabase | |
| Staging and production are separate Supabase projects | README, *Environments, backups and restore* | |
| Point-in-time recovery on the production project | | |
| Restore drill into a new project, date recorded | | |
| Sentry alerts on `signature-failure`, `token-guessing`, `unusual-payment-retries`, `fulfillment-backlog` | | |
| Support destinations: WhatsApp, Discovery Call, administrative email | Studio, `settings.contact` | |
| GitHub Environment `production` requires a reviewer | `.github/workflows/deploy.yml` | |

Staging currently shares the production Supabase project. That is safe only
while no real order exists and is the first thing to split before this gate
opens (README, *Environments, backups and restore*).

### FedaPay sandbox journey

A complete sandbox payment, no live charges. The acceptance suite already
walks the same path against the fixture
(`tests/e2e/checkout.spec.ts`, `payment-webhook.spec.ts`,
`payment-retry.spec.ts`, `order-access.spec.ts`, `exactly-once.spec.ts`,
`commerce-support.spec.ts`). This row is the same journey on the real
sandbox, on the deployment.

| Step | Recorded (date, order reference) |
| --- | --- |
| Checkout, hosted redirect | |
| Webhook confirmation, Payment State approved | |
| Receipt received (branded HTML and plain text) | |
| Order Access opens, download works | |
| Retry after a refused or cancelled payment | |
| Duplicate event does not deliver twice | |
| Fulfillment-failure recovery (*Reprendre la livraison*) | |

### Field checks

Manual. Issue #16 left them here on purpose: a lab run cannot speak for a
low-memory Android on MTN or Moov.

| Pass | Device / network | Accueil, Portfolio, Service Enquiry, checkout, verification, email, download | Recorded |
| --- | --- | --- | --- |
| Low-memory Android, MTN | | | |
| Low-memory Android, Moov | | | |
| Screen reader (TalkBack / VoiceOver) | | | |
| 200% zoom and 320 CSS-pixel reflow | | | |
| Real Mobile Safari | | | |

Field Core Web Vitals (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75) are read
from Cloudflare Web Analytics once real visits exist, against the Paris
origin behind the CDN (ADR-0011).

### Operator handoff

| Item | Recorded |
| --- | --- |
| Walkthrough in [`docs/operating.md`](./operating.md) followed on staging | |
| Recording of that walkthrough (link) | |

The walkthrough covers Sanity preview/publish, Mux uploads, product
activation, Paid Deliverable Version changes, order support, fulfillment
retry, access reissue, analytics, monitoring, backups, and the
sandbox-to-live transition.

### Prototype

The approved transaction design is Variant C, recorded in
[`docs/design_handoff_wecreate_site/README.md`](./design_handoff_wecreate_site/README.md).
The throwaway comparison and review live on branch
`prototype/digital-transactions`. Production recreates the selected
structure; it does not promote the prototype HTML.

### Completed tickets this gate sits on

| Ticket | What it closed |
| --- | --- |
| #16 | Public discovery quality bar. Manual screen-reader, zoom, field CWV, MTN/Moov, and real-device passes remain in *Field checks* above. |
| #17 | Commerce hardening and observation. The restore drill remains in *Production verification* above. |
| #42 | Deploy on WeCreate's own Node server. No CDN on staging (a DNS decision). Staging and production still share one Supabase project until this gate opens. |

### Deliberately deferred (issue #1 out of scope)

On-site Service Enquiry forms, customer accounts, coupons, automated refunds,
fiscal invoices, marketing automation, WhatsApp Business API, a page builder,
English locale switching, public 4K, the Three.js projection room, native
apps, and promoting the prototype HTML. None of these is a gate item.

## Sign-off

The irreversible sandbox-to-live switch. Fill this in, then set both
variables in `/srv/wecreate/shared/env` on production and restart
`wecreate`. `deploy/bin/check-env.sh` will refuse to be quiet about it.

```
Owner (name):
Date:
Issue comment (link to this file + the comment on #18):
FEDAPAY_ENVIRONMENT=live
WECREATE_LIVE_PAYMENTS_APPROVED_BY=<the name above>
```

Until both lines are in `shared/env`, the application stays in the sandbox.
