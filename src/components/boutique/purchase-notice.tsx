import {
  PURCHASE_REQUIREMENT_LABELS,
  purchaseRequirements,
  type PurchaseContext,
} from "@/managed-content/digital-products";
import type { DigitalProduct } from "@/managed-content/types";

interface PurchaseNoticeProps {
  product: DigitalProduct;
  purchase: PurchaseContext;
}

/**
 * What a Digital Product still needs before WeCreate may sell it.
 *
 * Only ever rendered in preview, and only for a product that is not ready. It is
 * the editor's half of the purchase rule, in the page they are already looking
 * at: the Boutique refuses to offer an unfinished product, and this is where it
 * says why — including the two things that are not theirs to fix, the approved
 * licence and the activated file, so they know who to ask rather than hunting
 * for a field that does not exist.
 */
export function PurchaseNotice({ product, purchase }: PurchaseNoticeProps) {
  const missing = purchaseRequirements(product, purchase);
  if (missing.length === 0) {
    return null;
  }

  return (
    <p
      data-testid="product-requirements"
      className="m-0 border border-wc-muted-on-light p-4 text-body-sm font-light text-wc-ink"
    >
      Pas encore en vente. Il manque&nbsp;:{" "}
      {missing
        .map((requirement) => PURCHASE_REQUIREMENT_LABELS[requirement])
        .join(", ")}
      .
    </p>
  );
}
