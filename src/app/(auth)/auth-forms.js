"use client";

import Link from "next/link";
import { useActionForm, ActionMessage, SubmitButton } from "@/components/ui/form";
import { Field, Input } from "@/components/ui/input";
import { loginAction, adminLoginAction } from "@/app/actions/auth";
import { safeNextPath } from "@/lib/action-state";
import { ShieldAlert } from "lucide-react";

/** Shared markup for the sign-in and admin sign-in forms. */
export function AuthForm({
  action,
  heading,
  subheading,
  submitLabel,
  next,
  footer,
  banner,
  children,
}) {
  const { state, formAction, pending } = useActionForm(action);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-[13.5px] text-muted-foreground">{subheading}</p>
      </header>

      {banner}

      <form action={formAction} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={safeNextPath(next)} /> : null}

        <Field label="Email" htmlFor="email" error={state.errors?.email} required>
          {({ id, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              invalid={invalid}
              required
              autoFocus
            />
          )}
        </Field>

        <Field label="Password" htmlFor="password" error={state.errors?.password} required>
          {({ id, invalid }) => (
            <Input
              id={id}
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              invalid={invalid}
              required
            />
          )}
        </Field>

        {children}

        <ActionMessage state={state} />

        <SubmitButton pending={pending} className="w-full" size="lg">
          {submitLabel}
        </SubmitButton>
      </form>

      {footer}
    </div>
  );
}

export function LoginForm({ next, banner }) {
  return (
    <AuthForm
      action={loginAction}
      heading="Welcome back"
      subheading="Sign in to manage your mess."
      submitLabel="Sign in"
      next={next}
      banner={banner}
      footer={
        <p className="text-center text-[13.5px] text-muted-foreground">
          Running a new mess?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      }
    />
  );
}

export function AdminLoginForm({ banner }) {
  return (
    <AuthForm
      action={adminLoginAction}
      heading="Super admin"
      subheading="Platform administration. Separate from any mess account."
      submitLabel="Sign in as admin"
      banner={banner}
      footer={
        <p className="flex items-start gap-2 rounded-[var(--radius-field)] border border-border bg-surface-muted px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          These credentials are configured by environment variables, not stored in the database.
          Change them in <code className="font-mono text-[11.5px]">.env</code> to rotate access.
        </p>
      }
    />
  );
}
