"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  acknowledgeCartPricesAction,
  addProductToCartAction,
  readDigitalCartAction,
  removeProductFromCartAction,
} from "./actions";
import {
  cartEntriesFromDocumentCookie,
  EMPTY_DIGITAL_CART,
  type DigitalCartView,
} from "./cart";

/**
 * The Digital Cart as the browser holds it: what is in it, and the four things
 * a shopper can do about it.
 *
 * The state is the shop's answer, not the browser's opinion. Every action here
 * is a round trip that returns the whole reconciled cart, so nothing on this
 * side ever adds up a total, decides that a product is still on sale, or
 * remembers a price — which is what keeps a cookie a visitor can edit from
 * being able to change what anything costs (issue #1).
 *
 * The one thing it does read locally is *how many* products the cookie names,
 * so the header can show a count the instant the page hydrates. Everything
 * beyond that number waits until the drawer is opened, and a visitor whose cart
 * is empty — which is every visitor before the Commerce Launch Gate — never
 * causes a request at all.
 */

export interface DigitalCart {
  /** The reconciled cart, or an empty one until the shop has answered. */
  view: DigitalCartView;
  /** Whether the shop has answered at all yet. An unread cart is not an empty one. */
  isLoaded: boolean;
  /** How many products the cart holds, known before the shop has answered. */
  itemCount: number;
  /** Whether a product is already in the cart, cookie or shop, whichever is known. */
  contains: (productId: string) => boolean;
  /** A request is in flight; the drawer says so rather than looking finished. */
  isBusy: boolean;
  /** The last action did not reach the shop. */
  hasFailed: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Add one copy of a product and show the shopper their cart. */
  add: (productId: string) => void;
  remove: (productId: string) => void;
  /** Accept today's prices for every line, after a published change. */
  acknowledgePrices: () => void;
}

const DigitalCartContext = createContext<DigitalCart | null>(null);

/**
 * The cart cookie, read as the external store it is.
 *
 * There is nothing to subscribe to: this application is the only writer, and it
 * writes through the Server Functions below, after which the shop's own answer
 * is what the provider holds. The server snapshot is an empty string, so the
 * prerendered HTML says nothing about any particular browser's cart and the
 * real count appears when React hydrates.
 */
const NO_COOKIE = "";
const subscribeToCartCookie = () => () => {};
const readDocumentCookie = () => document.cookie;
const readServerCookie = () => NO_COOKIE;

export function DigitalCartProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<DigitalCartView | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const documentCookie = useSyncExternalStore(
    subscribeToCartCookie,
    readDocumentCookie,
    readServerCookie,
  );
  const storedIds = useMemo(
    () => cartEntriesFromDocumentCookie(documentCookie).map((entry) => entry.id),
    [documentCookie],
  );

  // One at a time, in the order the shopper pressed them. Each action reads the
  // cart cookie, changes it and writes it back, so two in flight together would
  // both start from the state before either — and removing two products in
  // quick succession would put one of them back.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);

  const run = useCallback((action: () => Promise<DigitalCartView>) => {
    inFlight.current += 1;
    setIsBusy(true);

    queue.current = queue.current.then(async () => {
      try {
        setView(await action());
        setHasFailed(false);
      } catch {
        // Nothing about why: a shopper can act on "it did not go through" and
        // on nothing else this side knows (issue #1).
        setHasFailed(true);
      } finally {
        inFlight.current -= 1;
        if (inFlight.current === 0) {
          setIsBusy(false);
        }
      }
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    if (view !== null) {
      return;
    }
    // An empty cookie is already the whole answer, so opening an empty cart
    // costs nothing.
    if (storedIds.length === 0) {
      setView(EMPTY_DIGITAL_CART);
    } else {
      run(readDigitalCartAction);
    }
  }, [run, storedIds, view]);

  const close = useCallback(() => {
    setIsOpen(false);
    // A failure belongs to the visit that caused it, not to the cart.
    setHasFailed(false);
  }, []);

  const add = useCallback(
    (productId: string) => {
      // Opened first either way, so the confirmation is immediate and the
      // shopper watches the line arrive rather than waiting on a button.
      setIsOpen(true);
      // A product already in the cart has nothing to add, so the control that
      // now says *Voir dans le panier* does what it says instead of spending a
      // round trip on a request that would change nothing.
      if (!view?.lines.some((line) => line.id === productId)) {
        run(() => addProductToCartAction(productId));
      }
    },
    [run, view],
  );

  const remove = useCallback(
    (productId: string) => run(() => removeProductFromCartAction(productId)),
    [run],
  );

  const acknowledgePrices = useCallback(() => {
    // The amounts on screen travel with the request, so a price published
    // between this drawer being drawn and the button being pressed is refused
    // rather than accepted unseen.
    const presented = (view?.lines ?? []).map(
      (line) => [line.id, line.priceXof] as const,
    );
    run(() => acknowledgeCartPricesAction(presented));
  }, [run, view]);

  const value = useMemo<DigitalCart>(
    () => ({
      view: view ?? EMPTY_DIGITAL_CART,
      isLoaded: view !== null,
      itemCount: view ? view.itemCount : storedIds.length,
      contains: (productId: string) =>
        view
          ? view.lines.some((line) => line.id === productId)
          : storedIds.includes(productId),
      isBusy,
      hasFailed,
      isOpen,
      open,
      close,
      add,
      remove,
      acknowledgePrices,
    }),
    [
      acknowledgePrices,
      add,
      close,
      hasFailed,
      isBusy,
      isOpen,
      open,
      remove,
      storedIds,
      view,
    ],
  );

  return (
    <DigitalCartContext value={value}>{children}</DigitalCartContext>
  );
}

export function useDigitalCart(): DigitalCart {
  const cart = useContext(DigitalCartContext);
  if (!cart) {
    throw new Error(
      "useDigitalCart was used outside DigitalCartProvider. The provider wraps the public site in src/app/(site)/layout.tsx.",
    );
  }
  return cart;
}
