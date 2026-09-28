"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const INITIAL_ACTION_STATE = { ok: false, error: null, errors: null, message: null, values: null };

/**
 * Thin wrapper over `useActionState` so every form behaves the same way: a
 * spinner on the submit button, a field-error map, and a toast on success.
 *
 * The forms opt out of native validation (`noValidate`) so the server stays the
 * single source of truth for what is valid, which left them with no focus
 * handling at all: a rejected submit painted red text and left the caret in
 * place. The first field the server complained about is focused instead.
 */
export function useActionForm(action, { successToast = true, onSuccess } = {}) {
  const { toast } = useToast();
  const lastMessageRef = useRef(null);
  const formRef = useRef(null);

  const [state, formAction, pending] = useActionState(
    async (prevState, formData) => {
      const result = await action(prevState, formData);

      // Only announce a *new* message, so a re-render does not repeat it.
      if (result?.ok && result.message && lastMessageRef.current !== result.message) {
        lastMessageRef.current = result.message;
        if (successToast) toast({ title: result.message, variant: "success" });
      }

      // Lets a form clear itself and take the next entry without a dialog round
      // trip, which is what makes adding several expenses in a row bearable.
      if (result?.ok) onSuccess?.(result);

      /*
       * React resets a `<form action={...}>` once the action settles, whether it
       * succeeded or not. That is right for a success, and wrong for a failure:
       * a rejected expense used to come back with every field emptied, so fixing
       * one validation message threw away the whole line. Handing back what was
       * typed lets a form put it in `defaultValue` and get the form reset for
       * free, so the values come back without a controlled-value rewrite.
       */
      return result?.ok ? result : { ...result, values: collectValues(formData) };
    },
    INITIAL_ACTION_STATE,
  );

  useFocusFirstInvalid(state.errors, formRef);

  return { state, formAction, pending, formRef };
}

/** Text values of every named field, and the first selected option of each list. */
function collectValues(formData) {
  const values = {};
  for (const [name, raw] of formData) {
    // A multi-select or repeated field arrives more than once; one value is
    // enough to restore, and the last one wins the way a browser would submit.
    values[name] = typeof raw === "string" ? raw : "";
  }
  return values;
}

/**
 * Focus the first control the server rejected, so the fix is typed where the
 * problem is instead of hunted for.
 *
 * The form is found through the ref the hook hands back, not through
 * `document.activeElement`. Guessing from the active element only works when
 * something inside the form already has focus, which is true right after a
 * successful save and false on a freshly loaded page, so a rejected first
 * submission painted its errors and quietly focused nothing.
 *
 * The field order comes from the DOM rather than from the error map, so the
 * focus lands where the user was looking rather than on whichever key happened
 * to be enumerated first.
 */
function useFocusFirstInvalid(errors, formRef) {
  const attempted = useRef(null);

  useEffect(() => {
    const names = errors ? Object.keys(errors) : [];
    if (names.length === 0) {
      attempted.current = null;
      return;
    }

    const signature = names.join(",");
    if (attempted.current === signature) return;
    attempted.current = signature;

    const form = formRef?.current;
    if (!form) return;

    for (const control of form.elements) {
      if (control.name && names.includes(control.name) && typeof control.focus === "function") {
        control.focus();
        return;
      }
    }
  }, [errors, formRef]);
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
