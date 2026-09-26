"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { ActionMessage, SubmitButton } from "@/components/ui/form";
import { Field, Input } from "@/components/ui/input";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, {
    ok: false,
    error: null,
    errors: null,
    message: null,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your mess</h1>
        <p className="text-[13.5px] text-muted-foreground">
          One account for you. Your members are just records — they never need to sign in.
        </p>
      </header>

      <form action={formAction} className="space-y-4" noValidate>
        <Field
          label="Mess name"
          htmlFor="messName"
          error={state.errors?.messName}
          hint="What your household calls itself, e.g. “Green House”"
          required
        >
          {({ id, invalid }) => (
            <Input
              id={id}
              name="messName"
              placeholder="Green House Mess"
              invalid={invalid}
              maxLength={60}
              required
              autoFocus
            />
          )}
        </Field>

        <Field label="Your name" htmlFor="name" error={state.errors?.name} required>
          {({ id, invalid }) => (
            <Input
              id={id}
              name="name"
              placeholder="Rakib Hasan"
              autoComplete="name"
              invalid={invalid}
              maxLength={60}
              required
            />
          )}
        </Field>

        <Field label="Email" htmlFor="email" error={state.errors?.email} required>
          {({ id, invalid }) => (
            <Input
              id={id}
              name="email"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              autoComplete="email"
              invalid={invalid}
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
          {({ id, invalid }) => (
            <Input
              id={id}
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={invalid}
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
