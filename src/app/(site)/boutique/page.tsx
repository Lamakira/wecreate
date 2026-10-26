import type { Metadata } from "next";
import { draftMode } from "next/headers";

import { readPurchaseContextFrom } from "@/commerce";
import { BoutiqueCatalogue } from "@/components/boutique/boutique-catalogue";
import { SitePage } from "@/components/shell/site-page";
import { gateBoutique, readBoutiquePage } from "@/managed-content";
import { pageMetadata } from "@/seo/page-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const content = await readBoutiquePage();
  const { seo } = content.boutique;

  return {
    ...pageMetadata(content.settings.seo, {
      title: seo.title,
      description: seo.description,
      imageUrl: seo.openGraphImageUrl,
    }),
    alternates: { canonical: "/boutique" },
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
 * Archived products are already gone from what a visitor is shown, so this
 * page cannot advertise something WeCreate has withdrawn. In preview they are
 * present, and every product carries what it still needs before it may be sold.
 */
export default async function BoutiquePage() {
  const content = await readBoutiquePage();
  const purchase = await readPurchaseContextFrom(content.legalDocuments);
  const { isEnabled: isPreview } = await draftMode();
  const boutique = gateBoutique(content.boutique, isPreview);

  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
      <BoutiqueCatalogue
        boutique={boutique}
        purchase={purchase}
        showRequirements={isPreview}
      />
    </SitePage>
  );
}
