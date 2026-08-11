"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, video[controls], [tabindex]:not([tabindex="-1"])';

interface ModalDialog {
  /** Put this on the dialog panel. It bounds the focus trap. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** Put this on the close button. It receives focus when the dialog opens. */
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * What a modal dialog owes a keyboard or screen-reader user.
 *
 * Focus moves in when it opens, stays inside while it is open, and returns to
 * whatever opened it when it closes. Escape dismisses it, and the page behind
 * is held still so dismissing does not land the visitor somewhere else.
 *
 * It is a hook rather than a component because the two dialogs on this site do
 * not look alike at all — one slides in from the right, one is a lightbox in the
 * middle of the screen — while owing the visitor exactly the same behaviour. A
 * second hand-rolled copy is how one of them ends up without a focus trap.
 */
export function useModalDialog(
  isOpen: boolean,
  onClose: () => void,
): ModalDialog {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Remember where focus came from, so closing returns the visitor to the
    // control they opened the dialog with rather than the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    // Hold the page behind still. The scrollbar's width is handed back as
    // padding so the layout underneath does not jump as it disappears.
    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const restore = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
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

      if (
        event.shiftKey &&
        (active === first || !panelRef.current.contains(active))
      ) {
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

  return { panelRef, closeButtonRef };
}
