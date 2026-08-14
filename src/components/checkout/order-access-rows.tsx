import { allowanceLabel, expiryLabel } from "@/commerce/order-access";
import type { OrderAccess } from "@/commerce/types";
import { ACTION_SIZES } from "@/components/primitives/action";

/**
 * What a buyer owns, one row per Digital Product.
 *
 * The same rows on both surfaces that show them, because they are the same
 * facts: what was bought, until when it can be opened, and how much of the
 * allowance is left (issue #1). What differs is whether a row can be acted on —
 * the paid checkout view shows them and the Order Access page opens them — and
 * that is `downloadable`, not a second component.
 *
 * **Nothing here names a mechanism.** No bucket, no token, no signature, no
 * file size, no expiry in minutes: a row says a title, a date and a count, and
 * the one sentence about temporary links is said once under the list rather
 * than beside each button.
 *
 * The download is a real form submission to a route that answers with a
 * redirect, so it works with scripting disabled — and it is a `POST`, because
 * pressing it spends something. A `GET` that could be prefetched, retried by a
 * scanner or replayed from history would spend it for the buyer.
 */
export function OrderAccessRows({
  access,
  downloadable,
}: {
  access: OrderAccess;
  downloadable: boolean;
}) {
  return (
    <ul data-testid="access-rows" className="m-0 mt-8 list-none p-0">
      {access.grants.map((grant) => (
        <li
          key={grant.sku}
          data-testid="access-row"
          data-sku={grant.sku}
          className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-wc-line-light py-5 last:border-b"
        >
          <div className="min-w-0">
            <p
              data-testid="access-title"
              className="m-0 text-body font-semibold"
            >
              {grant.title}
            </p>
            <p
              data-testid="access-allowance"
              className="m-0 mt-2 text-body-sm font-light text-wc-ink"
            >
              {allowanceLabel(grant)}
            </p>
            <p
              data-testid="access-expiry"
              className="m-0 mt-1 text-body-sm font-light text-wc-muted-on-light"
            >
              {expiryLabel(access)}
            </p>
          </div>

          {downloadable ? (
            <form method="POST" action="/commande/acces/telechargement">
              <input type="hidden" name="sku" value={grant.sku} />
              <button
                type="submit"
                data-testid="access-download"
                className={`${ACTION_SIZES.default} bg-wc-pure text-wc-white transition-opacity duration-300 hover:opacity-80`}
              >
                Télécharger
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
