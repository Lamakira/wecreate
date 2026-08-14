import Link from "next/link";
import type { ReactNode } from "react";

import { ACTION_SIZES } from "@/components/primitives/action";

/**
 * The approved Variant C composition: a black order ticket beside a white
 * working surface.
 *
 * The ticket keeps the Order Snapshot's identity in view while the white half
 * holds whatever the buyer has to do — enter their details, resume a payment,
 * read where their payment stands. On a narrow screen the two stack with the
 * ticket first and compact, so the active state is reached without scrolling
 * past a full order recap (the prototype review's own finding).
 *
 * Nothing here moves. No reveal, no marquee, no video: a buyer on a Benin
 * mobile connection deciding whether to pay is the last person who should be
 * waiting on decoration (issue #1).
 */
export function CheckoutSplit({
  ticket,
  children,
}: {
  ticket: ReactNode;
  children: ReactNode;
}) {
  return (
    <CheckoutSurface>
      <div className="grid lg:min-h-[70vh] lg:grid-cols-[minmax(320px,32%)_1fr]">
        {ticket}
        {children}
      </div>
    </CheckoutSurface>
  );
}

/**
 * The white working surface on its own, for the states with no order to show.
 *
 * An empty cart and a checkout that is not open yet have no ticket, and a black
 * panel printing a nought would be a stage prop rather than information.
 */
export function CheckoutSurface({ children }: { children: ReactNode }) {
  return (
    <div data-surface="light" className="bg-wc-white text-wc-pure">
      {children}
    </div>
  );
}

interface CheckoutStageProps {
  /** The line above the heading: which order, and where in the journey. */
  kicker: string;
  heading: string;
  lede: string;
  children?: ReactNode;
}

/**
 * The white working surface.
 *
 * Every state of the checkout is this shape — a kicker, a heading, one
 * paragraph, a rule, then whatever the buyer can do — so a buyer moving between
 * them is reading the same page rather than arriving somewhere new. The states
 * are distinguished by those words and by what is under the rule, never by a
 * colour: issue #1 rules out status accents, and this identity has no colour to
 * spend on them anyway.
 */
export function CheckoutStage({
  kicker,
  heading,
  lede,
  children,
}: CheckoutStageProps) {
  return (
    <section
      data-testid="checkout-stage"
      className="px-gutter py-[clamp(36px,5vw,72px)]"
    >
      <div className="max-w-prose">
        <p className="m-0 text-micro tracking-28 uppercase text-wc-muted-on-light">
          {kicker}
        </p>
        <h1
          data-testid="checkout-heading"
          className="m-0 mt-5 font-display text-[clamp(30px,4.4vw,58px)] leading-[1.04] font-medium"
        >
          {heading}
        </h1>
        <p className="m-0 mt-5 text-body-lg font-light text-wc-ink">{lede}</p>
        <hr className="my-8 border-0 border-t border-wc-line-light" />
        {children}
      </div>
    </section>
  );
}

/** The way back to what WeCreate sells, from every surface that has no order. */
export function BoutiqueLink() {
  return (
    <p className="m-0 mt-7">
      <Link
        href="/boutique"
        className={`${ACTION_SIZES.default} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80`}
      >
        Aller à la boutique
      </Link>
    </p>
  );
}

/**
 * Where the payment details are actually collected, said once.
 *
 * Beside every control that leaves for the provider, because it is the thing a
 * buyer most needs to know before pressing one: WeCreate is not asking for a
 * card, and never sees one.
 */
export function HostedPaymentNote() {
  return (
    <p className="m-0 mt-4 text-body-sm font-light text-wc-muted-on-light">
      Le moyen de paiement est saisi sur la page sécurisée de FedaPay. WeCreate
      ne voit ni ne conserve vos informations de paiement.
    </p>
  );
}
