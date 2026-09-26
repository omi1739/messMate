"use client";

import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { setUserSuspendedAction, deleteUserAction } from "@/app/actions/admin";
import { useActionForm, SubmitButton } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { DeleteConfirm } from "@/components/ui/delete-confirm";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * One row of the accounts table: the account's mess, its member count, and the
 * suspend / reinstate / delete controls. Destructive actions are deliberately
 * un-styled until you hover or open them, so the table does not read as a wall
 * of red.
 */
export function AccountRow({ user, isSelf }) {
  const suspend = useActionForm(setUserSuspendedAction, { successToast: true });
  const detail = user.mess;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-3 align-top">
        <p className="text-[13.5px] font-medium">
          {user.name}
          {isSelf ? <Tag tone="primary">you</Tag> : null}
        </p>
        <p className="text-[12px] text-muted-foreground">{user.email}</p>
      </td>

      <td className="py-3 pr-3 align-top text-[13px]">
        {detail ? (
          <>
            <span className="block font-medium">{detail.name}</span>
            <span className="nums block text-[11.5px] text-muted-foreground">
              {detail.currency} · {detail._count.members}{" "}
              {detail._count.members === 1 ? "member" : "members"}
            </span>
          </>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">no mess</span>
        )}
      </td>

      <td className="py-3 pr-3 align-top text-[12px] text-muted-foreground">
        <span className="nums">{formatDate(user.createdAt)}</span>
        {user.lastLoginAt ? (
          <span className="block">last seen {formatDate(user.lastLoginAt)}</span>
        ) : (
          <span className="block">never signed in</span>
        )}
      </td>

      <td className="py-3 align-top">
        {user.suspended ? (
          <Tag tone="warning">suspended</Tag>
        ) : (
          <Tag tone="success">active</Tag>
        )}
      </td>

      <td className="py-3 pl-3 text-right align-top">
        <div className="flex items-center justify-end gap-1">
          {isSelf ? (
            <span className="text-[11.5px] text-muted-foreground">—</span>
          ) : (
            <>
              <form action={suspend.formAction}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="suspended" value={String(!user.suspended)} />
                <SubmitButton
                  pending={suspend.pending}
                  variant="ghost"
                  size="icon-sm"
                  title={user.suspended ? "Reinstate account" : "Suspend account"}
                  aria-label={
                    user.suspended
                      ? `Reinstate ${user.name}`
                      : `Suspend ${user.name}`
                  }
                >
                  {user.suspended ? (
                    <CheckCircle2 className="size-4" aria-hidden />
                  ) : (
                    <Ban className="size-4" aria-hidden />
                  )}
                </SubmitButton>
              </form>

              <DeleteConfirm
                title={`Delete ${user.name}?`}
                description={
                  detail
                    ? `This permanently removes the account, "${detail.name}", and every member, meal, expense, bill and payment inside it. This cannot be undone.`
                    : "This permanently removes the account. This cannot be undone."
                }
                confirmLabel="Delete everything"
                onConfirm={async () => {
                  const formData = new FormData();
                  formData.set("userId", user.id);
                  return deleteUserAction({ ok: false }, formData);
                }}
                trigger={(open) => (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={open}
                    title="Delete account"
                    aria-label={`Delete ${user.name}`}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              />
            </>
          )}
        </div>
        {suspend.state?.error ? (
          <p role="alert" className="mt-1 text-[11px] text-danger">
            {suspend.state.error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

function Tag({ tone = "default", children }) {
  const tones = {
    default: "bg-surface-muted text-muted-foreground",
    primary: "bg-primary-subtle text-primary",
    success: "bg-success-subtle text-success",
    warning: "bg-warning-subtle text-warning",
  };

  return (
    <span
      className={cn(
        "ml-1.5 inline-block rounded-full px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
