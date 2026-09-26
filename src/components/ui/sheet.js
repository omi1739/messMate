"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useModalBehaviour } from "@/components/ui/use-modal";

/**
 * Slide-in panel. Used for the navigation drawer on small screens and for
 * detail views on desktop, so there is one overlay behaviour in the app rather
 * than a dialog variant per surface.
 */
export function Sheet({ open, onClose, side = "right", title, description, children, footer, className }) {
  const panelRef = useRef(null);
  useModalBehaviour(open, onClose, panelRef);

  if (!open || typeof document === "undefined") return null;

  const positions = {
    right: "inset-y-0 right-0 h-full w-[min(20rem,85vw)] border-l rounded-none",
    left: "inset-y-0 left-0 h-full w-[min(17rem,80vw)] border-r rounded-none",
    bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-2xl border-t",
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in cursor-default bg-slate-950/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col overflow-hidden border-border bg-surface-raised shadow-overlay outline-none",
          "animate-slide-in-right",
          positions[side] ?? positions.right,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            {title ? <p className="truncate text-sm font-semibold">{title}</p> : null}
            {description ? (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>

        {footer ? <div className="border-t border-border bg-surface-muted/50 p-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
