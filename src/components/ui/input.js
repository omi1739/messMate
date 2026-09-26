"use client";

import { forwardRef, useId } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTROL_BASE =
  "w-full rounded-[var(--radius-field)] border bg-surface text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-150 " +
  "focus:outline-none focus:ring-[3px] focus:ring-primary/18 focus:border-primary " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70";

export const Input = forwardRef(function Input(
  { className, invalid, prefix, suffix, ...props },
  ref,
) {
  if (prefix || suffix) {
    return (
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            CONTROL_BASE,
            "h-9.5 px-3",
            prefix && "pl-8",
            suffix && "pr-14",
            invalid ? "border-danger focus:border-danger focus:ring-danger/18" : "border-border",
            className,
          )}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "h-9.5 px-3",
        invalid ? "border-danger focus:border-danger focus:ring-danger/18" : "border-border",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, invalid, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "resize-y px-3 py-2 leading-relaxed",
        invalid ? "border-danger focus:border-danger focus:ring-danger/18" : "border-border",
        className,
      )}
      {...props}
    />
  );
});

/**
 * Native <select> styled to match. A native control is the right call here: it
 * gets the OS picker, keyboard support, and correct behaviour on mobile for
 * free — all of which a custom listbox has to re-implement badly.
 */
export const Select = forwardRef(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          "h-9.5 cursor-pointer appearance-none py-0 pl-3 pr-9",
          invalid ? "border-danger focus:border-danger focus:ring-danger/18" : "border-border",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 8 4 4 4-4" />
      </svg>
    </div>
  );
});

export function Label({ className, required, children, ...props }) {
  return (
    <label className={cn("text-[13px] font-medium text-foreground", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </label>
  );
}

/** Label + control + inline error, wired together with matching ids. */
export function Field({ label, htmlFor, error, hint, required, children, className }) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
      ) : null}
      {typeof children === "function" ? children({ id, invalid: Boolean(error) }) : children}
      {error ? <FieldError>{error}</FieldError> : null}
      {!error && hint ? <p className="text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FieldError({ children, className }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-[12px] font-medium text-danger", className)}>
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
