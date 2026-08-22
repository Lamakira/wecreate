# Operating WeCreate

The walkthrough a Commerce Operator or Content Editor follows, and the script
for the recording the Commerce Launch Gate asks for. Each step is a thing
done on the running site. The reference for *why*, and for first-time
setup, is [`README.md`](../README.md). The gate itself is
[`docs/commerce-launch-gate.md`](./commerce-launch-gate.md).

Record this on staging. Production is the same sequence after the gate is
signed.

## 1. Sanity: preview and publish

1. Open `/studio` while signed in as yourself. There is no shared Studio
   account.
2. Edit a document. Open *Presentation* and confirm the change on the real
   page, behind the draft banner at the bottom. An ordinary visitor must not
   see it yet.
3. Publish. Reload the public page without the banner. The change is live on
   the next request: the webhook expires the `managed-content` cache tag
   (`README.md`, *Publishing and the cache*).
4. Leave preview through the banner, or `/api/draft/disable`.

Unpublished content has no path to an ordinary visitor. A Portfolio Project
that still lacks a required field is absent from `/portfolio` for a visitor
and listed, with what it still needs, only in preview.

## 2. Mux: upload a Playback Asset

1. In the Studio, open a Portfolio Project.
2. Drop the film on *Vidéo*. Mux ingests and transcodes. Nobody types a
   playback id.
3. Wait until the poster and the player resolve. A film still transcoding
   shows the poster and the project's words, which is also what a visitor
   sees if playback fails.
4. Publish only when `publicationRequirements()` is empty in preview —
   client, description, role, deliverables, poster, alternative text, video,
   the client's permission, and captions or a transcript when speech carries
   meaning.

Uploads use Mux's `basic` quality, capped at 1080p, with no downloadable
rendition (`README.md`, *Setting up Sanity*).

## 3. Product activation

Selling is three decisions in two systems. Do them in this order. A sandbox
purchase (step 6) also needs every Legal Document approved and in force —
otherwise `/commande` stays closed, which is the legal half of the gate.

1. In the Studio, finish the product page: SKU (immutable once published),
   family, whole-XOF price, summary, inclusions, cover. Leave *En vente*
   off until the file is checked.
2. Sign in at `/commerce` with your own password and authenticator. Enrol a
   backup factor on a second device the first time (`/commerce/securite`).
3. On `/commerce`, *Téléverser une version* for that SKU. The bytes are
   checksummed here; the name the browser used is not consulted.
4. *Activer la version n*. Activation is what the Boutique reads. It does
   not change any Order Snapshot.
5. Back in the Studio, turn on *En vente* and publish. The Boutique reads
   *Disponible* on the next request — provided the licence in force is
   approved text. Until then it stays *Bientôt disponible*.
6. Make one sandbox purchase and open the file as the buyer would. Confirm
   it is the Paid Deliverable they should receive. The private bucket has
   no select policy: there is no staff download of the bytes, on purpose.
   If it is the wrong file, turn *En vente* off, upload a new version, and
   start again from step 4. Record the passing purchase on
   [`docs/commerce-launch-gate.md`](./commerce-launch-gate.md).

## 4. Replacing a Paid Deliverable Version

1. Upload the new file. It becomes the next numbered version. The previous
   one is unchanged: versions are append-only.
2. Activate it, then make one sandbox purchase of a *new* order (an old
   Order Snapshot keeps the version it recorded). Confirm the file.
3. Orders that already bought the earlier one keep that file. A later grant
   is a Deliverable Upgrade on the dossier (*Accorder cette version*), not
   a silent rewrite.

## 5. Order support

1. `/commerce/commandes`. Search by reference or by a fragment of the
   address.
2. Open the dossier (`/commerce/commande?reference=…`). This is the only
   page that shows a buyer's contact in full.
3. Read the Payment State and the Fulfillment State as two facts. An
   approved payment whose delivery failed is not a refused payment.
4. Do only what the dossier offers. There is no control that issues a
   refund or a second payment: money is returned in FedaPay's dashboard, and
   a retry is the buyer's to make from their own order page.

Every action asks for a motive and writes an append-only Commerce Audit
Entry in your name.

## 6. Fulfillment retry

When the Fulfillment State reads *Livraison à reprendre*:

1. Open the dossier.
2. *Reprendre la livraison*. The application sends the receipt again to
   where the order goes now (the Contact Correction if there is one).
3. Confirm the buyer received it. The Payment State does not move: the
   money was already approved.

## 7. Access reissue and contact correction

- **Wrong address.** *Enregistrer la correction* on the dossier. The Order
  Snapshot keeps what the buyer typed. Deliveries read the correction.
- **Lost Order Access.** *Renvoyer les accès*, with a motive. The previous
  address stops working. The grants and the remaining allowance do not
  reset; the thirty days still run from the approval.
- **Later file.** *Accorder cette version* on a line that has a newer Paid
  Deliverable Version than the order bought.

## 8. Analytics

Cloudflare Web Analytics (page views, field Core Web Vitals) and Zaraz
(Service Enquiry destination, product addition, checkout start). Neither
attaches a name, an email, a telephone, or a cart. Mux's environment key
measures aggregate playback the same way.

Staging has no CDN, so Zaraz events queue until the production zone is
proxied (`README.md`, *Measurement*). A blocked beacon must not take a page
down; it does not.

## 9. Monitoring

Failures leave through `src/monitoring/`, scrubbed. Sentry is a server-only
envelope POST. Alerts belong on `signature-failure`, `token-guessing`,
`unusual-payment-retries`, and `fulfillment-backlog`.

```bash
journalctl -u wecreate -f
```

A forged webhook or a guessed Order Access token is a captured event, not a
page that explains what to try next.

## 10. Backups

Application state lives in Supabase, Sanity, and Mux. The VPS snapshot is
not a data backup. A rebuild from this repository plus
`/srv/wecreate/shared/env` restores the deployment.

The restore drill is: restore into a **new** project, apply migrations that
landed after the backup, confirm `commerce` is still unlisted in exposed
schemas, walk one sandbox purchase through to Order Access, and record the
date on [`docs/commerce-launch-gate.md`](./commerce-launch-gate.md). Do not
restore over the live project.

## 11. Sandbox to live

Do not start here. The gate document is the order: products, legal,
portfolio, ownership, production verification, sandbox journey, field
checks, this walkthrough, then the sign-off.

1. Every row on [`docs/commerce-launch-gate.md`](./commerce-launch-gate.md)
   has evidence.
2. A named WeCreate owner writes their name and the date on that file and
   comments on issue #18.
3. On the production machine, as root:

   ```bash
   # in /srv/wecreate/shared/env
   FEDAPAY_ENVIRONMENT=live
   WECREATE_LIVE_PAYMENTS_APPROVED_BY=<the name on the gate>
   ```

   Leave them unset, or set only one, and the application stays in the
   sandbox.
4. `deploy/bin/check-env.sh` — it will say out loud that this takes real
   money.
5. `systemctl restart wecreate`.
6. One more sandbox-shaped purchase is not available: the live API collects
   live money. The first real buyer is the proof. Watch Sentry and the
   journal.

There is no code path that infers live from a secret key, a hostname, or a
successful deploy.
