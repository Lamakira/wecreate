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
 * Plain text, for the reason `TransactionalEmail` has no HTML half: it is read
 * on a phone on a Benin mobile connection, and nothing in it needs a layout.
 *
 * **The access rules are in it, in words.** How long, how many times, and that
 * the address is personal — a buyer should not have to open the page to learn
 * what they have. Nothing about buckets, tokens, signatures or expiry in
 * minutes appears anywhere: the address is described as personal and temporary,
 * and the mechanism behind it is not the buyer's problem (issue #1).
 */

/** What the buyer's mail client shows in the list. */
function subject(order: OrderSnapshot): string {
  return `Reçu de paiement — commande ${order.reference}`;
}

/**
 * The key the email provider recognises a repeat by.
 *
 * Derived from a stable fulfillment event rather than from the moment of
 * sending (issue #1), and the stable event here is the one delivery an order
 * gets: a webhook redelivered three times asks for one message three times and
 * the buyer receives one.
 */
function idempotencyKey(order: OrderSnapshot): string {
  return `receipt-${order.reference}`;
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
}

export function composeReceipt({
  order,
  access,
  deliverTo,
  accessUrl,
  supportEmail,
}: ReceiptInput): TransactionalEmail {
  const lines = order.lines
    .map((line) => `- ${line.title} — ${formatXof(line.unitPriceXof)}`)
    .join("\n");

  const allowances = access.grants
    .map((grant) => `- ${grant.title} : ${allowanceLabel(grant)}`)
    .join("\n");

  const body = [
    "Bonjour,",
    "",
    `Nous avons bien reçu votre paiement de ${formatXof(order.totalXof)} pour la commande ${order.reference}.`,
    "Ce message est votre reçu de paiement et la confirmation de votre commande. Ce n'est pas une facture fiscale.",
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
    "WeCreate — Calavi Tankpè, Bénin",
  ].join("\n");

  return {
    to: deliverTo,
    subject: subject(order),
    body,
    idempotencyKey: idempotencyKey(order),
  };
}
