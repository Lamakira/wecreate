import { UPLOAD_REFUSAL_LABELS, type UploadRefusal } from "./paid-deliverables";
import { SUPPORT_REFUSAL_LABELS, type SupportRefusal } from "./support";

/**
 * What the back office says after an action, and how it says it.
 *
 * Carried in the address rather than in component state, so every message
 * survives the redirect that follows a form submission and appears with no
 * JavaScript at all — the same posture the rest of the site takes.
 *
 * The words matter more here than anywhere else on the site: a Commerce
 * Operator is being told whether WeCreate can deliver what it sells, and every
 * refusal below names what to do next rather than what went wrong.
 */

export type CommerceMessageKey =
  | UploadRefusal
  | SupportRefusal
  | "signInRefused"
  | "codeRefused"
  | "sessionExpired"
  | "signedOut"
  | "versionCreated"
  | "versionActivated"
  | "activationRefused"
  | "factorAdded"
  | "factorRefused"
  | "contactCorrected"
  | "accessReissued"
  | "accessReissuedUnsent"
  | "grantUpgraded"
  | "orderAnnotated"
  | "deliveryRetried"
  | "deliveryStillFailing";

export interface CommerceMessage {
  tone: "error" | "success";
  text: string;
}

export const COMMERCE_MESSAGES: Record<CommerceMessageKey, CommerceMessage> = {
  ...(Object.fromEntries(
    Object.entries(UPLOAD_REFUSAL_LABELS).map(([key, text]) => [
      key,
      { tone: "error", text },
    ]),
  ) as Record<UploadRefusal, CommerceMessage>),

  // Every way a support action can be refused, in the words that live beside
  // the rule that refused it. They are errors to a person and not to a system:
  // each one names what to do next.
  ...(Object.fromEntries(
    Object.entries(SUPPORT_REFUSAL_LABELS).map(([key, text]) => [
      key,
      { tone: "error", text },
    ]),
  ) as Record<SupportRefusal, CommerceMessage>),

  signInRefused: {
    tone: "error",
    text: "Adresse e-mail ou mot de passe refusé.",
  },
  codeRefused: {
    tone: "error",
    text: "Code refusé. Vérifiez l'heure de votre téléphone, puis réessayez.",
  },
  sessionExpired: {
    tone: "error",
    text: "Votre session a expiré. Reconnectez-vous.",
  },
  signedOut: { tone: "success", text: "Vous êtes déconnectée." },
  versionCreated: {
    tone: "success",
    text: "Nouvelle version enregistrée. Elle n'est pas encore en vente : activez-la.",
  },
  versionActivated: {
    tone: "success",
    text: "Version activée. Les prochains achats reçoivent ce fichier.",
  },
  activationRefused: {
    tone: "error",
    text: "Cette version n'existe pas pour ce produit.",
  },
  factorAdded: {
    tone: "success",
    text: "Facteur enregistré. Conservez-le en lieu sûr : il ouvre l'espace commerce.",
  },
  factorRefused: {
    tone: "error",
    text: "Code refusé. Le facteur n'a pas été enregistré.",
  },

  contactCorrected: {
    tone: "success",
    text: "Correction enregistrée. Le bon de commande garde ce que l'acheteuse ou l'acheteur avait écrit ; les prochains envois partent vers les coordonnées corrigées.",
  },
  accessReissued: {
    tone: "success",
    text: "Nouveaux accès envoyés. L'adresse précédente ne fonctionne plus ; les téléchargements restants n'ont pas bougé.",
  },
  accessReissuedUnsent: {
    tone: "error",
    text: "Les accès ont été remplacés, mais l'e-mail n'est pas parti. L'adresse précédente ne fonctionne plus : renvoyez les accès.",
  },
  grantUpgraded: {
    tone: "success",
    text: "Version accordée. Le bon de commande garde la version achetée ; l'acheteuse ou l'acheteur peut désormais ouvrir la nouvelle.",
  },
  orderAnnotated: {
    tone: "success",
    text: "Note enregistrée au journal, à votre nom. Aucun remboursement n'est déclenché ici : il se fait chez le fournisseur de paiement.",
  },
  deliveryRetried: {
    tone: "success",
    text: "Livraison reprise. Le reçu est reparti vers l'adresse de livraison, avec de nouveaux accès.",
  },
  deliveryStillFailing: {
    tone: "error",
    text: "La livraison n'a toujours pas abouti. Le paiement reste approuvé et les accès sont intacts : réessayez, puis écrivez à l'acheteuse ou l'acheteur.",
  },
};

/** The message named in a URL, or `undefined` if it names nothing we know. */
export function commerceMessage(
  key: string | undefined,
): CommerceMessage | undefined {
  if (!key) return undefined;
  return COMMERCE_MESSAGES[key as CommerceMessageKey];
}
