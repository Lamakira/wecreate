import type { Metadata } from "next";

import { readAccessInProgress } from "@/fulfillment";
import {
  ACCESS_COPY,
  ACCESS_UNAVAILABLE_COPY,
  DOWNLOAD_REFUSAL_MESSAGES,
  downloadRefusal,
} from "@/fulfillment/messages";
import {
  BoutiqueLink,
  CheckoutStage,
  CheckoutSurface,
} from "@/components/checkout/checkout-layout";
import { OrderAccessRows } from "@/components/checkout/order-access-rows";
import { keepOutOfSearchResults } from "@/site-config";

export const metadata: Metadata = {
  title: "Vos accès",
  ...keepOutOfSearchResults(),
};

/**
 * Nothing here can be prerendered: what it shows belongs to whoever is holding
 * the token in this browser's cookie, and to nobody else.
 */
export const instant = false;

/**
 * Order Access: the files a buyer paid for, for thirty days, without an
 * account.
 *
 * **The token is not in this address.** It arrived in the buyer's mail, was
 * exchanged for an http-only cookie by `acces/[jeton]`, and this page is where
 * they were sent afterwards — so what they are now reading, reloading,
 * bookmarking or showing somebody carries no credential, and neither does any
 * referrer it sends.
 *
 * **Access it cannot open and access that never existed look identical.** An
 * expired token, a replaced one, a cookie somebody edited and a browser that
 * simply arrived here all produce the surface below, which names no product and
 * no order. Working through guesses therefore never reveals that an order
 * exists — and rate limiting on the way in, at `[jeton]`, is what makes a
 * spray noticeable without ever saying that one did.
 *
 * Out of search results whatever the deployment, as every transaction surface
 * on this site is.
 */
export default async function OrderAccessRoute({
  searchParams,
}: {
  searchParams: Promise<{ probleme?: string }>;
}) {
  const [access, { probleme }] = await Promise.all([
    readAccessInProgress(),
    searchParams,
  ]);

  if (!access) {
    return (
      <CheckoutSurface>
        <CheckoutStage
          kicker={ACCESS_UNAVAILABLE_COPY.kicker}
          heading={ACCESS_UNAVAILABLE_COPY.heading}
          lede={ACCESS_UNAVAILABLE_COPY.lede}
        >
          <BoutiqueLink />
        </CheckoutStage>
      </CheckoutSurface>
    );
  }

  // Only a value this application wrote into the address itself, mapped to a
  // sentence: nothing from the query is ever printed.
  const refusal = downloadRefusal(probleme);

  return (
    <CheckoutSurface>
      <CheckoutStage
        kicker={`Commande ${access.reference} · ${ACCESS_COPY.kicker}`}
        heading={ACCESS_COPY.heading}
        lede={ACCESS_COPY.lede}
      >
        {refusal ? (
          <p
            data-testid="access-problem"
            role="status"
            className="m-0 border border-wc-line-light px-5 py-4 text-body font-light text-wc-ink"
          >
            {DOWNLOAD_REFUSAL_MESSAGES[refusal]}
          </p>
        ) : null}

        <OrderAccessRows access={access} downloadable />

        <p className="m-0 mt-6 text-body-sm font-light text-wc-muted-on-light">
          {ACCESS_COPY.note}
        </p>
      </CheckoutStage>
    </CheckoutSurface>
  );
}
