"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, type ReactNode } from "react";

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  /** Accessible name for the close button, written out rather than derived
   *  from `label` — French needs its article. */
  closeLabel: string;
  /** Identifies the panel in acceptance tests. */
  testId: string;
  /** Top-left content beside the close button. */
  heading?: ReactNode;
  /** Scrollable body. */
  children: ReactNode;
  /** Pinned to the bottom of the panel. */
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A panel that slides in from the right, with the behaviour a modal dialog owes
 * a keyboard or screen-reader user: focus moved in on open, kept inside while
 * open, returned to the opening control on close, Escape to dismiss, and the
 * page behind held still.
 *
 * Both the Digital Cart and the mobile navigation are this. Extracted so that
 * behaviour is written and tested once — a second hand-rolled copy is how one of
 * them ends up missing a focus trap.
 */
export function SideDrawer({
  isOpen,
  onClose,
  label,
  closeLabel,
  testId,
  heading,
  children,
  footer,
}: SideDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Remember where focus came from, so closing returns the visitor to the
    // control they opened the panel with rather than the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    // Hold the page behind still. The scrollbar's width is handed back as
    // padding so the layout underneath does not jump as it disappears.
    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const restore = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      // Keep Tab inside the dialog: a modal that lets focus wander onto the
      // page behind it is not modal to a keyboard or screen-reader user.
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = restore.overflow;
      body.style.paddingRight = restore.paddingRight;
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-1000 flex justify-end">
      <button
        type="button"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-wc-pure/70 backdrop-blur-[3px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        className="relative flex h-full w-[min(430px,100%)] animate-wc-fade-fast flex-col border-l border-wc-line-dark bg-wc-black"
      >
        <div className="flex items-center justify-between border-b border-wc-line-dark px-[26px] pt-[26px] pb-5">
          <div className="text-micro tracking-28 uppercase text-wc-muted-2">
            {heading}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-1 grid h-8 w-8 place-items-center text-wc-white transition-opacity duration-300 hover:opacity-70"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[26px] py-2">{children}</div>

        {footer ? (
          <div className="border-t border-wc-line-dark px-[26px] pt-6 pb-[30px]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
