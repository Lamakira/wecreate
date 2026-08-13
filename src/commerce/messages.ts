import { UPLOAD_REFUSAL_LABELS, type UploadRefusal } from "./paid-deliverables";

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
  | "signInRefused"
  | "codeRefused"
  | "sessionExpired"
  | "signedOut"
  | "versionCreated"
  | "versionActivated"
  | "activationRefused"
  | "factorAdded"
  | "factorRefused";

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
};

/** The message named in a URL, or `undefined` if it names nothing we know. */
export function commerceMessage(
  key: string | undefined,
): CommerceMessage | undefined {
  if (!key) return undefined;
  return COMMERCE_MESSAGES[key as CommerceMessageKey];
}
