"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import {
  createMemberAction,
  updateMemberAction,
  deleteMemberAction,
  setMemberStatusAction,
} from "@/app/actions/members";
import { useActionForm, SubmitButton, ActionMessage } from "@/components/ui/form";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseIcon,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirm } from "@/components/ui/delete-confirm";
import {
  MEMBER_STATUSES,
  MEMBER_STATUS_LABELS,
  MEMBER_STATUS_HINTS,
  MEMBER_STATUS_TONE,
} from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateLong } from "@/lib/date";

/** Add / edit / status-cycle / delete, all re-scoped to the mess server-side. */
export function MembersManager({ members, currency, defaultJoiningDate }) {
  const [editing, setEditing] = useState(null); // member | "new" | null

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          Add member
        </Button>
      </div>

      {editing !== null ? (
        <MemberDialog
          member={editing === "new" ? null : editing}
          currency={currency}
          defaultJoiningDate={defaultJoiningDate}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {members.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-muted-foreground">
          No members yet. Add the people you cook for to get started.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-muted-foreground">
                <UserRound className="size-4" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{member.name}</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {member.phone} · joined {formatDateLong(member.joiningDate)}
                </p>
              </div>

              <span className="nums shrink-0 text-[13.5px] font-semibold">
                {member.status === "ARCHIVED" ? "—" : formatMoney(member.rent, { currency })}
              </span>

              <Badge tone={MEMBER_STATUS_TONE[member.status] ?? "neutral"} className="shrink-0">
                {MEMBER_STATUS_LABELS[member.status] ?? member.status}
              </Badge>

              <div className="flex shrink-0 items-center gap-1">
                <StatusCycle member={member} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditing(member)}
                  aria-label={`Edit ${member.name}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** ACTIVE -> INACTIVE -> ARCHIVED -> ACTIVE in a single button. */
function StatusCycle({ member }) {
  const order = MEMBER_STATUSES;
  const next = order[(order.indexOf(member.status) + 1) % order.length];
  const label = MEMBER_STATUS_LABELS[next] ?? next;

  // The action takes (prevState, formData), so it cannot be handed straight to
  // <form action> — that would pass the FormData as prevState. Going through
  // useActionForm keeps the argument order and gives us the pending state.
  const { state, formAction, pending } = useActionForm(setMemberStatusAction, {
    successToast: true,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="memberId" value={member.id} />
      <input type="hidden" name="status" value={next} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        loading={pending}
        className="text-[12px] text-muted-foreground"
        title={`Mark ${member.name} as ${label.toLowerCase()}`}
      >
        {label}
      </Button>
      {state?.error ? (
        <span role="alert" className="sr-only">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function MemberDialog({ member, currency, defaultJoiningDate, onClose }) {
  const isNew = !member;
  const { state, formAction, pending } = useActionForm(
    isNew ? createMemberAction : updateMemberAction,
  );

  // Close only when the action actually succeeded, so validation errors stay
  // on screen next to the fields that caused them.
  async function handleSubmit(formData) {
    const result = await formAction(formData);
    if (result?.ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} label={isNew ? "Add member" : `Edit ${member.name}`}>
      <form action={handleSubmit} noValidate>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add member" : `Edit ${member.name}`}</DialogTitle>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {!isNew ? <input type="hidden" name="memberId" value={member.id} /> : null}

            <Field label="Name" htmlFor="name" error={state.errors?.name} required>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  name="name"
                  defaultValue={member?.name ?? ""}
                  placeholder="Asha Rahman"
                  invalid={invalid}
                  maxLength={60}
                  required
                  autoFocus
                />
              )}
            </Field>

            <Field label="Phone" htmlFor="phone" error={state.errors?.phone} required>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={member?.phone ?? ""}
                  placeholder="01712-345678"
                  invalid={invalid}
                  maxLength={20}
                  required
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Monthly seat rent"
                htmlFor="rent"
                error={state.errors?.rent}
                hint={`Charged while the member is active (${currency})`}
              >
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    name="rent"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={member?.rent ?? 0}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field
                label="Joining date"
                htmlFor="joiningDate"
                error={state.errors?.joiningDate}
                required
              >
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    name="joiningDate"
                    type="date"
                    defaultValue={member ? toDateInput(member.joiningDate) : defaultJoiningDate}
                    invalid={invalid}
                    required
                  />
                )}
              </Field>
            </div>

            <Field
              label="Status"
              htmlFor="status"
              error={state.errors?.status}
              hint={MEMBER_STATUS_HINTS[member?.status ?? "ACTIVE"]}
            >
              {({ id }) => (
                <Select id={id} name="status" defaultValue={member?.status ?? "ACTIVE"}>
                  {MEMBER_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {MEMBER_STATUS_LABELS[value]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Notes" htmlFor="notes" error={state.errors?.notes}>
              {({ id }) => (
                <Textarea
                  id={id}
                  name="notes"
                  rows={2}
                  defaultValue={member?.notes ?? ""}
                  placeholder="Optional — anything worth remembering"
                  maxLength={280}
                />
              )}
            </Field>

            <ActionMessage state={state} />
          </div>
        </DialogBody>

        <DialogFooter>
          {!isNew ? (
            <DeleteConfirm
              className="mr-auto"
              title={`Delete ${member.name}?`}
              description="This removes the member along with their meal history and payments. Archiving keeps the history and stops the charges — prefer that unless you are clearing out a test mess."
              confirmLabel="Delete permanently"
              hidden={{ memberId: member.id }}
              onConfirm={async () => {
                const formData = new FormData();
                formData.set("memberId", member.id);
                const result = await deleteMemberAction({ ok: false }, formData);
                if (result?.ok) onClose();
              }}
              trigger={(open) => (
                <Button type="button" variant="ghost" size="sm" onClick={open} className="text-danger hover:bg-danger-subtle">
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </Button>
              )}
            />
          ) : null}

          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <SubmitButton pending={pending}>
            {isNew ? "Add member" : "Save changes"}
          </SubmitButton>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function toDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}
