"use client";

import Link from "next/link";
import { signupAction } from "@/app/actions/auth";
import { ActionMessage, SubmitButton, useActionForm } from "@/components/ui/form";
import { Field, Input } from "@/components/ui/input";

/*
 * Uses `useActionForm` rather than raw `useActionState`. React empties a
 * `<form action={...}>` once the action settles, success or failure, so a bare
 * `useActionState` wiped every field whenever validation rejected the submit —
 * one mistyped character in an already-registered email cost the whole form. The
 * hook hands the typed values back on failure and focuses the first field the
 * server complained about.
 */
export function SignupForm() {
  const { state, formAction, pending, formRef } = useActionForm(signupAction, { successToast: true });
  const kept = state?.values ?? {};

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your mess</h1>
        <p className="text-[13.5px] text-muted-foreground">
          One account for you. Your members are just records — they never need to sign in.
        </p>
      </header>

      <form ref={formRef} action={formAction} className="space-y-4" noValidate>
        <Field
          label="Mess name"
          htmlFor="messName"
          error={state.errors?.messName}
          hint="What your household calls itself, e.g. “Green House”"
          required
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="messName"
              placeholder="Green House Mess"
              invalid={invalid}
              aria-describedby={describedBy}
              defaultValue={kept.messName ?? ""}
              maxLength={60}
              required
              autoFocus
            />
          )}
        </Field>

        <Field label="Your name" htmlFor="name" error={state.errors?.name} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="name"
              placeholder="Your name"
              autoComplete="name"
              invalid={invalid}
              aria-describedby={describedBy}
              defaultValue={kept.name ?? ""}
              maxLength={60}
              required
            />
          )}
        </Field>

        <Field label="Email" htmlFor="email" error={state.errors?.email} required>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="email"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              autoComplete="email"
              invalid={invalid}
              aria-describedby={describedBy}
              defaultValue={kept.email ?? ""}
              required
            />
          )}
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={state.errors?.password}
          hint="At least 8 characters, including a letter and a number"
          required
        >
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={invalid}
              aria-describedby={describedBy}
              required
            />
          )}
        </Field>

        <ActionMessage state={state} />

        <SubmitButton pending={pending} className="w-full" size="lg">
          Create my mess
        </SubmitButton>
      </form>

      <p className="text-center text-[13.5px] text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
