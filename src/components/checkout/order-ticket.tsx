import type { OrderSnapshot } from "@/commerce/types";
import type { DigitalCartView } from "@/digital-cart/cart";
import { formatXof } from "@/lib/format";

/** One product on the ticket: what it is, and what it costs on this order. */
export interface TicketLine {
  id: string;
  title: string;
  priceXof: number;
}

/** A cart's lines: today's published prices, which may still move. */
export function cartTicketLines(cart: DigitalCartView): TicketLine[] {
  return cart.lines.map((line) => ({
    id: line.id,
    title: line.title,
    priceXof: line.priceXof,
  }));
}

/**
 * An order's lines: the prices it recorded, which nothing may move.
 *
 * The difference between this and the one above is the whole point of an Order
 * Snapshot, and it is why the ticket takes lines rather than either object: the
 * component shows what it is given, and what it is given is decided by whether
 * the sale has been committed to.
 */
export function orderTicketLines(order: OrderSnapshot): TicketLine[] {
  return order.lines.map((line) => ({
    id: line.sku,
    title: line.title,
    priceXof: line.unitPriceXof,
  }));
}

interface OrderTicketProps {
  /** WeCreate's own name for the order, once there is one. */
  reference?: string;
  lines: TicketLine[];
  totalXof: number;
  /** One sentence along the bottom, which differs by what is happening. */
  note: string;
}

/**
 * The black order ticket: what is being bought, and what it costs.
 *
 * The left half of the approved Variant C composition — a persistent black
 * ticket carrying the order's identity beside a white working surface that
 * holds whatever the buyer has to do next. It is the same component before and
 * after the Order Snapshot exists, because it is showing the same thing: before,
 * today's published prices; after, the prices the snapshot recorded, which no
 * later editorial change can move.
 *
 * **It stays compact on a phone.** The prototype review found the full ticket
 * too tall on a narrow viewport, and issue #1 settles what it compresses to:
 * "compress the black ticket to total and snapshot duration so active payment
 * truth appears in the first viewport". So below the wide breakpoint the list
 * itself is not rendered — a count and the total stand in for it, and the
 * products stay one tap away in the cart drawer the buyer arrived through.
 */
export function OrderTicket({
  reference,
  lines,
  totalXof,
  note,
}: OrderTicketProps) {
  return (
    <aside
      data-testid="checkout-ticket"
      aria-label="Ticket de commande"
      className="flex flex-col justify-between gap-8 bg-wc-pure px-gutter py-10 text-wc-white lg:py-[clamp(40px,5vw,72px)]"
    >
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="m-0 text-micro tracking-26 uppercase text-wc-soft">
            {reference ? (
              <>
                Ticket <span data-testid="ticket-reference">{reference}</span>
              </>
            ) : (
              "Panier numérique"
            )}
          </p>
          <span className="text-micro tracking-26 uppercase text-wc-muted-2">
            XOF
          </span>
        </div>

        <ul
          data-testid="ticket-lines"
          className="mt-12 hidden list-none p-0 lg:block"
        >
          {lines.map((line) => (
            <li
              key={line.id}
              data-testid="ticket-line"
              className="flex items-baseline justify-between gap-5 border-b border-wc-line-dark py-3.5 first:pt-0"
            >
              <span className="text-body font-light">{line.title}</span>
              <span
                data-testid="ticket-line-price"
                className="text-body font-semibold whitespace-nowrap"
              >
                {formatXof(line.priceXof)}
              </span>
            </li>
          ))}
        </ul>

        {/* What the list says on a phone, where the list is not shown. */}
        <p
          data-testid="ticket-count"
          className="m-0 mt-6 text-body font-light text-wc-soft lg:hidden"
        >
          {lines.length === 1 ? "1 produit numérique" : `${lines.length} produits numériques`}
        </p>

        <div className="mt-6 flex items-baseline justify-between gap-5">
          <span className="text-micro tracking-26 uppercase text-wc-muted-2">
            Total
          </span>
          <span
            data-testid="ticket-total"
            className="font-display text-[clamp(30px,5vw,44px)] leading-none"
          >
            {formatXof(totalXof)}
          </span>
        </div>
      </div>

      <p className="m-0 text-body-sm font-light text-wc-soft">{note}</p>
    </aside>
  );
}
