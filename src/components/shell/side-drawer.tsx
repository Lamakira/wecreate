"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

import { useModalDialog } from "@/lib/use-modal-dialog";

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
  /**
   * Whether what the panel shows is currently being fetched. Announced as
   * `aria-busy`, so assistive technology waits for the update rather than
   * reading a half-replaced list.
   */
  isBusy?: boolean;
  /** Top-left content beside the close button. */
  heading?: ReactNode;
  /** Scrollable body. */
  children: ReactNode;
  /** Pinned to the bottom of the panel. */
  footer?: ReactNode;
}

/**
 * A panel that slides in from the right.
 *
 * Both the Digital Cart and the mobile navigation are this. What it owes a
 * keyboard or screen-reader user is `useModalDialog`'s, and shared with the
 * portfolio's lightbox; what is here is the shape it takes on screen.
 */
export function SideDrawer({
  isOpen,
  onClose,
  label,
  closeLabel,
  testId,
  isBusy,
  heading,
  children,
  footer,
}: SideDrawerProps) {
  const { panelRef, closeButtonRef } = useModalDialog(isOpen, onClose);

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
        aria-busy={isBusy === undefined ? undefined : isBusy}
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

        {/* The one part of the panel that scrolls. On a phone this is what
            keeps a long list of products from pushing the action at the foot of
            the drawer off the screen. */}
        <div
          data-testid={`${testId}-body`}
          className="flex-1 overflow-y-auto px-[26px] py-2"
        >
          {children}
        </div>

        {footer ? (
          <div className="border-t border-wc-line-dark px-[26px] pt-6 pb-[30px]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
