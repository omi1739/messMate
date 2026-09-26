import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, children }) {
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={() => onOpenChange(false)}
      />
      {/* Content Container */}
      <div className="relative z-10 w-full max-w-lg scale-100 transform overflow-y-auto max-h-[calc(100vh-2rem)] rounded-xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-350 dark:border-slate-800 dark:bg-slate-950">
        {children}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <X className="h-4.5 w-4.5" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </div>
  );
}

export function DialogContent({ children, className }) {
  return <div className={cn("grid gap-4", className)}>{children}</div>;
}

export function DialogHeader({ children, className }) {
  return (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className }) {
  return (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className }) {
  return (
    <p className={cn("text-sm text-slate-500 dark:text-slate-400", className)}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className }) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-4", className)}>
      {children}
    </div>
  );
}
