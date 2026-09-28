"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal toast system.
 *
 * Deliberately hand-rolled rather than pulled from a library: this is the only
 * feedback mechanism the app needs, and a save confirmation that disappears on
 * its own is not something a mess manager should have to think about.
 */

const ToastContext = createContext(null);

const VARIANTS = {
  success: { icon: CheckCircle2, className: "border-success/30 bg-success-subtle text-success" },
  error: { icon: XCircle, className: "border-danger/30 bg-danger-subtle text-danger" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning-subtle text-warning" },
  info: { icon: Info, className: "border-info/30 bg-info-subtle text-info" },
};

const DURATION = 4500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "info", duration = DURATION }) => {
      const id = ++counterRef.current;
      setToasts((current) => [...current.slice(-3), { id, title, description, variant }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return id;
    },
    [dismiss],
  );

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body)
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

function ToastViewport({ toasts, onDismiss }) {
  // The container is created together with its first toast rather than being kept
  // mounted and empty. A permanently mounted live region is the textbook fix for
  // a missed announcement, but this viewport is portaled, so the server never
  // renders it at all — keeping it mounted on the client makes it disagree with
  // the server's output and every page fails hydration (caught by
  // check:meals-ui). Reinstating it belongs with moving the live region out of
  // the portal, not as a one-line change.
  if (toasts.length === 0) return null;

  return (
    <div
      // aria-live so a screen reader announces the result of a save.
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {toasts.map((item) => {
        const variant = VARIANTS[item.variant] ?? VARIANTS.info;
        const Icon = variant.icon;
        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface-raised p-3.5 shadow-overlay",
              "animate-slide-up",
              variant.className,
            )}
          >
            <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
              className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
