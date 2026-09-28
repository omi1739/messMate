"use client";

import { useEffect, useRef } from "react";

/**
 * Overlay behaviour shared by Dialog and Sheet: Escape to close, body scroll
 * lock with scrollbar-width compensation, a real focus trap, and focus
 * restoration to the element that opened it.
 *
 * A hand-rolled modal that skips any of these is a genuine accessibility
 * regression, so it lives in one place instead of being re-implemented.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Open overlays, innermost last. Dialog can be nested — an edit dialog hosting a
 * delete confirmation — and every one of them registers its own listener on
 * `document`. `stopPropagation()` cannot arbitrate between them: it stops the
 * event travelling to *other nodes*, not other listeners on the *same* node. So
 * Escape closed both, and the outer edit form was unmounted with every unsaved
 * change in it. Only the topmost overlay may react, which is what a stack is for.
 */
const openModals = [];

export function useModalBehaviour(open, onClose, panelRef) {
  const restoreFocusRef = useRef(null);

  // Read through a ref so an inline arrow from the owner does not become an
  // effect dependency. As a dependency it changed identity on every render of
  // the owner, which tore the effect down and re-ran it — restoring focus and
  // then stealing it back to the panel's first control mid-interaction.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const id = Symbol("modal");
    openModals.push(id);
    const isTopmost = () => openModals[openModals.length - 1] === id;

    restoreFocusRef.current = document.activeElement;

    // Compensate for the removed scrollbar so the page behind does not shift.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    const focusTimer = window.setTimeout(() => {
      if (!isTopmost()) return;
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector(FOCUSABLE) ?? panel;
      target.focus();
    }, 20);

    const onKeyDown = (event) => {
      if (!isTopmost()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null,
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      const at = openModals.indexOf(id);
      if (at >= 0) openModals.splice(at, 1);
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
      }
    };
  }, [open, panelRef]);
}
