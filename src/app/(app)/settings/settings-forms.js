"use client";

import { useActionForm, SubmitButton, ActionMessage } from "@/components/ui/form";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfileAction, changePasswordAction, logoutAction } from "@/app/actions/auth";
import { updateMessSettingsAction } from "@/app/actions/mess";
import { CURRENCIES } from "@/lib/constants";

/** Your own name and email. */
export function ProfileForm({ user }) {
  const { state, formAction, pending, formRef } = useActionForm(updateProfileAction);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <Field label="Your name" htmlFor="name" error={state.errors?.name} required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            name="name"
            defaultValue={user.name}
            invalid={invalid}
            aria-describedby={describedBy}
            maxLength={60}
            required
          />
        )}
      </Field>

      <Field
        label="Email"
        htmlFor="email"
        hint="Your sign-in address. Contact the platform owner to change it."
      >
        {({ id, describedBy }) => (
          <Input id={id} value={user.email} readOnly disabled aria-describedby={describedBy} />
        )}
      </Field>

      <ActionMessage state={state} />

      <div className="flex justify-end">
        <SubmitButton pending={pending}>Save profile</SubmitButton>
      </div>
    </form>
  );
}

/** Mess name and currency. */
export function MessForm({ mess }) {
  const { state, formAction, pending, formRef } = useActionForm(updateMessSettingsAction);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <Field label="Mess name" htmlFor="name" error={state.errors?.name} required>
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            name="name"
            defaultValue={mess?.name ?? ""}
            invalid={invalid}
            aria-describedby={describedBy}
            maxLength={60}
            required
          />
        )}
      </Field>

      <Field
        label="Currency"
        htmlFor="currency"
        error={state.errors?.currency}
        hint="Used for every amount in the app and on printed reports."
      >
        {({ id, invalid, describedBy }) => (
          <Select
            id={id}
            name="currency"
            defaultValue={mess?.currency ?? "BDT"}
            invalid={invalid}
            aria-describedby={describedBy}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <ActionMessage state={state} />

      <div className="flex justify-end">
        <SubmitButton pending={pending}>Save mess settings</SubmitButton>
      </div>
    </form>
  );
}

/** Password change, requiring the current one. */
export function PasswordForm() {
  const { state, formAction, pending, formRef } = useActionForm(changePasswordAction);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <Field
        label="Current password"
        htmlFor="currentPassword"
        error={state.errors?.currentPassword}
        required
      >
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            invalid={invalid}
            aria-describedby={describedBy}
            required
          />
        )}
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        error={state.errors?.newPassword}
        hint="At least 8 characters, with a letter and a number"
        required
      >
        {({ id, invalid, describedBy }) => (
          <Input
            id={id}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            invalid={invalid}
            aria-describedby={describedBy}
            required
          />
        )}
      </Field>

      <ActionMessage state={state} />

      <div className="flex justify-end">
        <SubmitButton pending={pending}>Change password</SubmitButton>
      </div>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" className="text-danger hover:bg-danger-subtle">
        Sign out
      </Button>
    </form>
  );
}
