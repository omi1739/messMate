"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

/**
 * Thin wrapper over `useActionState` so every form behaves the same way: a
 * spinner on the submit button, a field-error map, and a toast on success.
 */
export function useActionForm(action, { successToast = true } = {}) {
  const { toast } = useToast();
  const lastMessageRef = useRef(null);

  const [state, formAction, pending] = useActionState(
    async (prevState, formData) => {
      const result = await action(prevState, formData);

      // Only announce a *new* message, so a re-render does not repeat it.
      if (result?.ok && result.message && lastMessageRef.current !== result.message) {
        lastMessageRef.current = result.message;
        if (successToast) toast({ title: result.message, variant: "success" });
      }

      return result;
    },
    { ok: false, error: null, errors: null, message: null },
  );

  return { state, formAction, pending };
}

/** Submit button that shows a spinner while its form is submitting. */
export function SubmitButton({ pending, children, className, variant = "primary", size, ...props }) {
  return (
    <Button type="submit" loading={pending} variant={variant} size={size} className={className} {...props}>
      {children}
    </Button>
  );
}

/** Inline, non-blocking feedback for a form. */
export function ActionMessage({ state, className }) {
  if (!state?.error && !state?.message) return null;

  const ok = Boolean(state.ok);
  const Icon = ok ? CheckCircle2 : AlertCircle;

  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius-field)] border px-3 py-2.5 text-[13px] font-medium text-foreground",
        ok ? "border-success/25 bg-success-subtle" : "border-danger/25 bg-danger-subtle",
        className,
      )}
    >
      <Icon className={cn("mt-px size-4 shrink-0", ok ? "text-success" : "text-danger")} aria-hidden />
      {ok ? state.message : state.error}
    </p>
  );
}

/** Two-step confirmation for destructive actions. */
export function ConfirmButton({
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  trigger,
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      {trigger({ open: () => setOpen(true) })}

      <Dialog open={open} onClose={() => setOpen(false)} label={title} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
        </DialogBody>
        <DialogFooter>
          <DialogClose onClick={() => setOpen(false)}>Cancel</DialogClose>
          <SubmitButton
            pending={pending}
            variant="danger"
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {confirmLabel}
          </SubmitButton>
        </DialogFooter>
      </Dialog>
    </>
  );
}
