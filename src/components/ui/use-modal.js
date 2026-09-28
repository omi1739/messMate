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

/**
 * Elements that have held focus, most recent last.
 *
 * `document.activeElement` is useless for remembering who opened a modal. The
 * browser applies `autoFocus` to the newly mounted panel during the very commit
 * that opened it, so by the time an effect runs, the element focused beforehand
 * is already off the record: the hook was capturing the dialog's own first
 * field, then restoring focus to it on close — to a node it had just unmounted.
 * The call silently did nothing, focus fell back to `<body>`, and a keyboard
 * user was dropped at the top of the page with no idea which field they were in.
 * Every form dialog in the app has an `autoFocus` field, so this was every one
 * of them.
 *
 * Recording focus as it happens avoids the race entirely. Nothing is read after
 * the fact, so nothing depends on when the effect happened to run.
 */
const focusHistory = [];

/**
 * Registered at module load rather than when a dialog opens, which is the whole
 * point: the focus events worth remembering have already happened by the time an
 * effect runs. The click that opens a dialog focuses its trigger, and the browser
 * focuses the panel's autoFocus field during the same commit, so a listener
 * installed on open hears neither and the history stays empty.
 */
if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const node = event.target;
      if (!(node instanceof HTMLElement)) return;
      const at = focusHistory.indexOf(node);
      if (at >= 0) focusHistory.splice(at, 1);
      focusHistory.push(node);
      // Bounded, and stale entries are skipped on the way out anyway.
      if (focusHistory.length > 20) focusHistory.shift();
    },
    true,
  );
}

/**
 * The element to hand focus back to: the most recent one that is still on the
 * page and is not inside the panel being closed.
 *
 * Skipping the panel is what makes nesting work. Closing the delete
 * confirmation hands focus back to the Delete button in the edit form behind
 * it, and closing that form hands it back to the row that opened it, instead of
 * dropping to the body twice.
 */
function focusTargetFor(panel) {
  for (let i = focusHistory.length - 1; i >= 0; i -= 1) {
    const node = focusHistory[i];
    if (!node.isConnected) continue;
    if (panel?.contains(node)) continue;
    return node;
  }
  return null;
}

export function useModalBehaviour(open, onClose, panelRef) {
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

    // Read once, here, while the panel is mounted. React detaches refs before it
    // runs passive cleanups, so by the time the dialog closes `panelRef.current`
    // is already null and there is nothing left to tell the panel's own contents
    // apart from the page behind it.
    const panelNode = panelRef.current;

    // Compensate for the removed scrollbar so the page behind does not shift.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    const focusTimer = window.setTimeout(() => {
      if (!isTopmost()) return;
      const panel = panelRef.current;
      if (!panel) return;
      // Never pull focus back out of a field the user is already in, which is
      // what happens when the effect re-runs under StrictMode.
      if (document.activeElement && panel.contains(document.activeElement)) return;
      // A dialog with a form opens with the caret in its first field. React
      // applies autoFocus during the commit but does not leave the attribute in
      // the DOM, so the field cannot be found by name afterwards and the
      // previous behaviour landed on the close button instead, every time.
      const field = Array.from(
        panel.querySelectorAll('input:not([type="hidden"]), textarea, select'),
      ).find((element) => element.offsetParent !== null);
      const target = field ?? panel.querySelector(FOCUSABLE) ?? panel;
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
      // Resolved against the panel captured above, and only ever to something
      // still on the page.
      focusTargetFor(panelNode)?.focus();
    };
  }, [open, panelRef]);
}
