"use client";

import { useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useModalBehaviour } from "@/components/ui/use-modal";

/**
 * Accessible modal — focus trap, Escape, scroll lock and focus restoration all
 * come from the shared `useModalBehaviour` hook.
 */

export function Dialog({ open, onClose, children, className, label }) {
  const panelRef = useRef(null);
  const handleClose = useCallback(() => onClose?.(), [onClose]);

  useModalBehaviour(open, handleClose, panelRef);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={handleClose}
        className="absolute inset-0 animate-fade-in cursor-default bg-scrim backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-border bg-surface-raised shadow-overlay outline-none",
          "animate-slide-up rounded-t-2xl sm:max-w-lg sm:animate-scale-in sm:rounded-[var(--radius-card)]",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({ className, children }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, children }) {
  return <h2 className={cn("text-base font-semibold tracking-tight", className)}>{children}</h2>;
}

export function DialogBody({ className, children }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)}>{children}</div>;
}

export function DialogFooter({ className, children }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border bg-surface-muted/50 px-5 py-3.5 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DialogClose({ onClick, children, ...props }) {
  return (
    <Button variant="outline" onClick={onClick} {...props}>
      {children ?? "Cancel"}
    </Button>
  );
}

/** Small × in the top-right of a dialog header. */
export function DialogCloseIcon({ onClick }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label="Close" className="-mr-1 -mt-0.5">
      <X className="size-4" aria-hidden />
    </Button>
  );
}
