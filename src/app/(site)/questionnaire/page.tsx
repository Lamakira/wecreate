import { createHash } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";

import { openInvitation } from "@/brand-questionnaire/invitation";
import { readInvitationToken } from "@/brand-questionnaire/session";
import { BrandQuestionnaire } from "@/components/brand-questionnaire/brand-questionnaire";
import {
  CheckoutStage,
  CheckoutSurface,
} from "@/components/checkout/checkout-layout";
import { ACTION_SIZES } from "@/components/primitives/action";
import { SiteChrome } from "@/components/shell/site-page";
import { readChrome } from "@/managed-content";
import { pageMetadata } from "@/seo/page-metadata";
import { keepOutOfSearchResults } from "@/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readChrome();

  return {
    ...pageMetadata(content.settings.seo, { title: "Questionnaire de marque" }),
    ...keepOutOfSearchResults(),
  };
}

/**
 * Nothing here can be prerendered: what it shows belongs to whoever holds the
 * invitation in this browser's cookie, and to nobody else.
 */
export const instant = false;

const UNAVAILABLE_KICKER = "Questionnaire de marque";

const UNAVAILABLE_COPY = {
  expired: {
    heading: "Ce lien a expiré.",
    lede: "Les liens personnels restent ouverts 30 jours. Écrivez-nous et nous vous en enverrons un nouveau : vos réponses ne sont pas perdues si vous les aviez commencées sur cet appareil.",
  },
  invalid: {
    heading: "Ce lien ne s'ouvre pas.",
    lede: "Il est incomplet ou a été modifié. Le questionnaire de marque s'ouvre uniquement depuis le lien personnel envoyé par WeCreate. Écrivez-nous et nous vous le renverrons.",
  },
} as const;

/**
 * The Brand Questionnaire, for the client whose personal link this browser
 * carries.
 *
 * **The form is only ever rendered for a valid invitation.** A missing cookie,
 * a tampered token, one made under another secret and an expired one all show
 * the calm explanation below and none of the questions; the two that can be
 * told apart differ only in what the client can do about them.
 *
 * `draftKey` is a digest of the token, so the draft kept in the client's own
 * browser belongs to this link and is neither readable from nor guessable
 * without it.
 */
export default async function BrandQuestionnaireRoute() {
  const [token, content] = await Promise.all([
    readInvitationToken(),
    readChrome(),
  ]);
  const whatsappUrl = content.settings.contact.whatsappUrl;
  const outcome = token ? openInvitation(token) : { status: "invalid" as const };

  if (!token || outcome.status !== "valid") {
    const copy =
      outcome.status === "expired"
        ? UNAVAILABLE_COPY.expired
        : UNAVAILABLE_COPY.invalid;

    return (
      <SiteChrome>
        <CheckoutSurface>
          <div data-testid="questionnaire-unavailable">
            <CheckoutStage
              kicker={UNAVAILABLE_KICKER}
              heading={copy.heading}
              lede={copy.lede}
            >
              <p className="m-0 flex flex-wrap gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ACTION_SIZES.default} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80`}
                >
                  Écrire sur WhatsApp
                  <span className="sr-only"> - nouvel onglet</span>
                </a>
                <Link
                  href="/contact"
                  className={`${ACTION_SIZES.default} border border-wc-pure text-wc-pure transition-opacity duration-300 hover:opacity-80`}
                >
                  Page contact
                </Link>
              </p>
            </CheckoutStage>
          </div>
        </CheckoutSurface>
      </SiteChrome>
    );
  }

  const { invitation } = outcome;
  const draftKey = createHash("sha256").update(token).digest("hex").slice(0, 32);

  return (
    <SiteChrome>
      <BrandQuestionnaire
        client={invitation.client}
        brand={invitation.brand}
        pack={invitation.pack}
        reference={invitation.reference}
        draftKey={draftKey}
        whatsappUrl={whatsappUrl}
      />
    </SiteChrome>
  );
}
