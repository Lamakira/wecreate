import { allowanceLabel, expiryLabel } from "@/commerce/order-access";
import type { OrderAccess, OrderSnapshot } from "@/commerce/types";
import type { TransactionalEmail } from "@/email/types";
import { formatXof } from "@/lib/format";

/**
 * What WeCreate writes to a buyer whose payment was approved.
 *
 * A payment receipt and an order confirmation, and it says which it is not:
 * issue #1 keeps fiscal invoicing, VAT and accounting out of version one
 * entirely, so a message that let itself be read as an invoice would be
 * promising a document WeCreate does not issue.
 *
 * Sent as HTML with a plain-text half saying the same thing, both composed
 * here from the same facts so they cannot drift apart. The HTML carries the
 * identity — black and white, square corners, a serif name — with every style
 * inline and no image anywhere: a receipt is read on a phone on a Benin mobile
 * connection, and has to survive every mail client WeCreate's buyers use.
 *
 * **The access rules are in it, in words.** How long, how many times, and that
 * the address is personal — a buyer should not have to open the page to learn
 * what they have. Nothing about buckets, tokens, signatures or expiry in
 * minutes appears anywhere: the address is described as personal and temporary,
 * and the mechanism behind it is not the buyer's problem (issue #1).
 */

/** What the buyer's mail client shows in the list. */
function subject(order: OrderSnapshot, reissued: boolean): string {
  return reissued
    ? `Vos accès - commande ${order.reference}`
    : `Reçu de paiement - commande ${order.reference}`;
}

/**
 * The key the email provider recognises a repeat by.
 *
 * Derived from a stable fulfillment event rather than from the moment of
 * sending (issue #1), and the stable event here is the *issuance* of the access
 * this message carries: a webhook redelivered three times against one delivery
 * asks for one message three times and the buyer receives one.
 *
 * The order alone will not do, and the reason is the whole of ADR-0010. A
 * delivery that failed may be taken up again, and taking it up issues a fresh
 * token — so a second message is a different message, addressed to a buyer who
 * received nothing the first time. A key naming only the order would have the
 * provider swallow it as a repeat, and the buyer would be left holding an
 * address that no longer opens anything.
 */
function idempotencyKey(order: OrderSnapshot, access: OrderAccess): string {
  return `receipt-${order.reference}-${access.issuedAt}`;
}

export interface ReceiptInput {
  order: OrderSnapshot;
  access: OrderAccess;
  /** Where it goes. The buyer's real address, not the masked hint. */
  deliverTo: string;
  /** The absolute address that opens the files, carrying the emailed token. */
  accessUrl: string;
  /** WeCreate's own administrative address, from Managed Content. */
  supportEmail: string;
  /**
   * Whether a Commerce Operator asked for this to be sent again (issue #15).
   *
   * The same facts either way — this is the receipt, and re-sending it is the
   * whole point — but it opens by saying so. A buyer who lost their first
   * message and receives a second one headed *Reçu de paiement* has every
   * reason to think they have been charged twice, which is precisely the
   * telephone call this feature exists to end.
   */
  reissued?: boolean;
}

/** The opening paragraphs, which differ only by whether this is a re-send. */
function openingLines(
  order: OrderSnapshot,
  reissued: boolean,
): string[] {
  return reissued
    ? [
        `Voici de nouveau vos accès à la commande ${order.reference}, à votre demande.`,
        `Rien n'a été encaissé une seconde fois : votre paiement de ${formatXof(order.totalXof)} reste le seul.`,
        "Le lien envoyé précédemment ne fonctionne plus ; celui ci-dessous le remplace.",
      ]
    : [
        `Nous avons bien reçu votre paiement de ${formatXof(order.totalXof)} pour la commande ${order.reference}.`,
        "Ce message est votre reçu de paiement et la confirmation de votre commande. Ce n'est pas une facture fiscale.",
      ];
}

/** The plain-text half: what a client that renders no HTML shows. */
function composeText(
  order: OrderSnapshot,
  access: OrderAccess,
  accessUrl: string,
  supportEmail: string,
  reissued: boolean,
): string {
  const lines = order.lines
    .map((line) => `- ${line.title} - ${formatXof(line.unitPriceXof)}`)
    .join("\n");

  const allowances = access.grants
    .map((grant) => `- ${grant.title} : ${allowanceLabel(grant)}`)
    .join("\n");

  return [
    "Bonjour,",
    "",
    ...openingLines(order, reissued),
    "",
    "Vos produits numériques",
    lines,
    "",
    "Vos accès",
    "Ouvrez vos fichiers ici :",
    accessUrl,
    "",
    `Cette adresse est personnelle : elle ouvre votre commande, gardez-la pour vous. Vos accès restent ouverts 30 jours. ${expiryLabel(access)}.`,
    "Chaque produit vous donne droit à 5 téléchargements réussis :",
    allowances,
    "Le lien de téléchargement est temporaire ; tant que vos accès sont ouverts, vous pouvez en redemander un sur la page ci-dessus.",
    "",
    "Une question ?",
    `Écrivez-nous à ${supportEmail} en indiquant la référence ${order.reference}.`,
    "",
    "WeCreate - Calavi Tankpè, Bénin",
  ].join("\n");
}

/** A value Managed Content wrote, made safe to place inside HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * The HTML half. Tables and inline styles rather than a stylesheet, because
 * that is what mail clients render; no image, because there is nothing an
 * image would say that the typography does not.
 */
function composeHtml(
  order: OrderSnapshot,
  access: OrderAccess,
  accessUrl: string,
  supportEmail: string,
  reissued: boolean,
): string {
  const productRows = order.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:300;color:#000000;">${escapeHtml(line.title)}</td>
          <td align="right" style="padding:12px 0;border-bottom:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#000000;white-space:nowrap;">${escapeHtml(formatXof(line.unitPriceXof))}</td>
        </tr>`,
    )
    .join("");

  const allowanceItems = access.grants
    .map(
      (grant) =>
        `<li style="margin:4px 0;">${escapeHtml(grant.title)} : ${escapeHtml(allowanceLabel(grant))}</li>`,
    )
    .join("");

  const opening = openingLines(order, reissued)
    .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#f4f4f4;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;">
            <tr>
              <td style="background-color:#000000;padding:28px 40px;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#ffffff;">WeCreate</span>
              </td>
            </tr>
            <tr>
              <td style="padding:40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;font-weight:300;color:#333333;">
                <p style="margin:0 0 16px;">Bonjour,</p>
                ${opening}

                <h2 style="margin:32px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;">Vos produits numériques</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  ${productRows}
                  <tr>
                    <td style="padding:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;">Total</td>
                    <td align="right" style="padding:16px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#000000;">${escapeHtml(formatXof(order.totalXof))}</td>
                  </tr>
                </table>

                <h2 style="margin:40px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;">Vos accès</h2>
                <p style="margin:0 0 20px;">Ouvrez vos fichiers ici :</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="#000000" style="background-color:#000000;">
                      <a href="${escapeHtml(accessUrl)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Ouvrir mes fichiers</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;font-size:13px;color:#6a6a6a;word-break:break-all;">${escapeHtml(accessUrl)}</p>

                <p style="margin:24px 0 12px;">Cette adresse est personnelle : elle ouvre votre commande, gardez-la pour vous. Vos accès restent ouverts 30 jours. ${escapeHtml(expiryLabel(access))}.</p>
                <p style="margin:0 0 4px;">Chaque produit vous donne droit à 5 téléchargements réussis :</p>
                <ul style="margin:0;padding-left:20px;">${allowanceItems}</ul>
                <p style="margin:12px 0 0;">Le lien de téléchargement est temporaire ; tant que vos accès sont ouverts, vous pouvez en redemander un sur la page ci-dessus.</p>

                <h2 style="margin:40px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;">Une question ?</h2>
                <p style="margin:0;">Écrivez-nous à <a href="mailto:${escapeHtml(supportEmail)}" style="color:#000000;">${escapeHtml(supportEmail)}</a> en indiquant la référence ${escapeHtml(order.reference)}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid #eeeeee;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:300;color:#6a6a6a;">
                WeCreate - Calavi Tankpè, Bénin
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function composeReceipt({
  order,
  access,
  deliverTo,
  accessUrl,
  supportEmail,
  reissued = false,
}: ReceiptInput): TransactionalEmail {
  return {
    to: deliverTo,
    subject: subject(order, reissued),
    body: composeText(order, access, accessUrl, supportEmail, reissued),
    html: composeHtml(order, access, accessUrl, supportEmail, reissued),
    idempotencyKey: idempotencyKey(order, access),
  };
}
