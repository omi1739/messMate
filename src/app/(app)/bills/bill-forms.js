"use client";

import { useRef, useState } from "react";
import { Check, Plus, Save, Trash2 } from "lucide-react";
import {
  saveBillAction,
  createCustomBillAction,
  updateCustomBillAction,
  deleteCustomBillAction,
} from "@/app/actions/bills";
import { useActionForm, SubmitButton, ActionMessage } from "@/components/ui/form";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirm } from "@/components/ui/delete-confirm";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseIcon,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UTILITY_FIELDS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

/**
 * The five fixed utility heads for one month.
 *
 * A month either has these recorded or it does not, and the page looks the same
 * either way, so the only way to tell was to remember. The badge says which,
 * and saving reports the total that was written.
 */
export function UtilityBillForm({ month, bill, hasBill, currency }) {
  const { state, formAction, pending, formRef } = useActionForm(saveBillAction);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="month" value={month} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={hasBill ? "success" : "warning"}>
          {hasBill ? <Check className="size-3" aria-hidden /> : null}
          {hasBill ? "Recorded" : "Not recorded yet"}
        </Badge>
        <p className="text-[12.5px] text-muted-foreground">
          {hasBill
            ? `Saved for this month. Edit anything below and save again to update it.`
            : "Nothing saved for this month yet."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {UTILITY_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={field.key}
            error={state.errors?.[field.key]}
            hint={currency}
          >
            {({ id, invalid, describedBy }) => (
              <Input
                id={id}
                name={field.key}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={state.values?.[field.key] ?? bill?.[field.key] ?? 0}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
        ))}
      </div>

      <ActionMessage state={state} />

      <div className="flex justify-end">
        <SubmitButton pending={pending}>
          <Save className="size-4" aria-hidden />
          {hasBill ? "Update utility bill" : "Save utility bill"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Ad-hoc extra charges, e.g. "Cook salary" or "Waste collection". */
export function CustomBills({ month, customBills, currency }) {
  const [editing, setEditing] = useState(null); // item | null

  return (
    <>
      <AddChargeForm month={month} currency={currency} />

      {customBills.length === 0 ? (
        <p className="rounded-[var(--radius-field)] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          No extra charges this month. Add things like a cook&rsquo;s salary, deep cleaning or a
          replacement gas cylinder — they are split evenly like the utilities.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {customBills.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{item.title}</p>
                {item.notes ? (
                  <p className="truncate text-[11.5px] text-muted-foreground">{item.notes}</p>
                ) : null}
              </div>
              <span className="nums shrink-0 text-[13.5px] font-semibold">
                {formatMoney(item.amount, { currency })}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(item)}
                  aria-label={`Edit ${item.title}`}
                >
                  Edit
                </Button>
                <DeleteConfirm
                  title={`Delete ${item.title}?`}
                  description="This extra charge will be removed and the month recalculated."
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    const formData = new FormData();
                    formData.set("billId", item.id);
                    return deleteCustomBillAction({ ok: false }, formData);
                  }}
                  trigger={(open) => (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={open}
                      aria-label={`Delete ${item.title}`}
                      className="text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null ? (
        <CustomBillDialog
          item={editing}
          month={month}
          currency={currency}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

/** Two fields, so a dialog was three clicks for one row. It clears itself. */
function AddChargeForm({ month, currency }) {
  const titleRef = useRef(null);
  const { state, formAction, pending, formRef } = useActionForm(createCustomBillAction, {
    onSuccess: () => {
      formRef.current?.reset();
      titleRef.current?.focus();
    },
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-label="Add an extra charge"
      className="rounded-[var(--radius-card)] border border-border bg-surface-muted/60 p-3"
    >
      <input type="hidden" name="month" value={month} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-start">
        <Field label="What is it" htmlFor="charge-title" error={state.errors?.title}>
          {({ id, invalid, describedBy }) => (
            <Input
              ref={titleRef}
              id={id}
              name="title"
              placeholder="Cook salary"
              defaultValue={state.values?.title}
              aria-describedby={describedBy}
              invalid={invalid}
              maxLength={80}
            />
          )}
        </Field>

        <Field label="Amount" htmlFor="charge-amount" error={state.errors?.amount} hint={currency}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              defaultValue={state.values?.amount}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <div className="sm:pt-[22px]">
          <SubmitButton pending={pending}>
            <Plus className="size-4" aria-hidden />
            Add
          </SubmitButton>
        </div>
      </div>

      <ActionMessage state={state} className="mt-3" />
    </form>
  );
}

function CustomBillDialog({ item, month, currency, onClose }) {
  const { state, formAction, pending, formRef } = useActionForm(updateCustomBillAction, { onSuccess: onClose });

  return (
    <Dialog open onClose={onClose} label="Edit extra charge">
      <form ref={formRef} action={formAction} noValidate>
        <DialogHeader>
          <DialogTitle>Edit extra charge</DialogTitle>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="billId" value={item.id} />

            <Field label="Title" htmlFor="title" error={state.errors?.title} required>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  name="title"
                  defaultValue={state.values?.title ?? item.title}
                  aria-describedby={describedBy}
                  placeholder="Cook salary"
                  invalid={invalid}
                  maxLength={80}
                  required
                  autoFocus
                />
              )}
            </Field>

            <Field label="Amount" htmlFor="amount" error={state.errors?.amount} hint={currency} required>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  defaultValue={state.values?.amount ?? item.amount}
                  aria-describedby={describedBy}
                  placeholder="0.00"
                  invalid={invalid}
                  required
                />
              )}
            </Field>

            <Field label="Notes" htmlFor="notes" error={state.errors?.notes}>
              {({ id, invalid, describedBy }) => (
                <Textarea
                  id={id}
                  name="notes"
                  rows={2}
                  defaultValue={state.values?.notes ?? item?.notes ?? ""}
                  placeholder="Optional"
                  invalid={invalid}
                  aria-describedby={describedBy}
                  maxLength={280}
                />
              )}
            </Field>

            <ActionMessage state={state} />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <SubmitButton pending={pending}>Save changes</SubmitButton>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
