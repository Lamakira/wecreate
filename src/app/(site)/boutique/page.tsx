import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { readPurchaseContext } from "@/commerce";
import { BoutiqueCatalogue } from "@/components/boutique/boutique-catalogue";
import { readBoutique } from "@/managed-content";
import { pageOpenGraph } from "@/seo/open-graph";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await readBoutique();

  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/boutique" },
    openGraph: await pageOpenGraph({
      title: seo.title,
      description: seo.description,
      imageUrl: seo.openGraphImageUrl,
    }),
  };
}

/**
 * The Boutique.
 *
 * Two families, Ebooks & Guides and LUTs & Presets, and nothing else: the design
 * prototype's *Packs Services* tab sold service packs through the same cart, and
 * issue #1 removed it — a service offer ends in a conversation, never in a
 * transaction (ADR-0006).
 *
 * Archived products are already gone from what `readBoutique()` returns, so this
 * page cannot advertise something WeCreate has withdrawn. In preview they are
 * present, and every product carries what it still needs before it may be sold.
 */
export default async function BoutiquePage() {
  const boutique = await readBoutique();
  const purchase = await readPurchaseContext();
  const { isEnabled: isPreview } = await draftMode();

  return (
    <BoutiqueCatalogue
      boutique={boutique}
      purchase={purchase}
      showRequirements={isPreview}
    />
  );
}
