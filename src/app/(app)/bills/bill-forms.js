"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  saveBillAction,
  createCustomBillAction,
  updateCustomBillAction,
  deleteCustomBillAction,
} from "@/app/actions/bills";
import { useActionForm, SubmitButton, ActionMessage } from "@/components/ui/form";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

/** The five fixed utility heads for one month. */
export function UtilityBillForm({ month, bill, currency }) {
  const { state, formAction, pending } = useActionForm(saveBillAction);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="month" value={month} />

      <div className="grid gap-3 sm:grid-cols-2">
        {UTILITY_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={field.key}
            error={state.errors?.[field.key]}
            hint={currency}
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                name={field.key}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={bill?.[field.key] ?? 0}
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
          Save utility bill
        </SubmitButton>
      </div>
    </form>
  );
}

/** Ad-hoc extra charges, e.g. "Cook salary" or "Waste collection". */
export function CustomBills({ month, customBills, currency }) {
  const [editing, setEditing] = useState(null); // item | "new" | null

  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          Add extra charge
        </Button>
      </div>

      {editing !== null ? (
        <CustomBillDialog
          item={editing === "new" ? null : editing}
          month={month}
          currency={currency}
          onClose={() => setEditing(null)}
        />
      ) : null}

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
    </>
  );
}

function CustomBillDialog({ item, month, currency, onClose }) {
  const isNew = !item;
  const { state, formAction, pending } = useActionForm(
    isNew ? createCustomBillAction : updateCustomBillAction,
  );

  async function handleSubmit(formData) {
    const result = await formAction(formData);
    if (result?.ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} label={isNew ? "Add extra charge" : "Edit extra charge"}>
      <form action={handleSubmit} noValidate>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add extra charge" : "Edit extra charge"}</DialogTitle>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <input type="hidden" name="month" value={month} />
            {!isNew ? <input type="hidden" name="billId" value={item.id} /> : null}

            <Field label="Title" htmlFor="title" error={state.errors?.title} required>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  name="title"
                  defaultValue={item?.title ?? ""}
                  placeholder="Cook salary"
                  invalid={invalid}
                  maxLength={80}
                  required
                  autoFocus
                />
              )}
            </Field>

            <Field label="Amount" htmlFor="amount" error={state.errors?.amount} hint={currency} required>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  defaultValue={item?.amount ?? ""}
                  placeholder="0.00"
                  invalid={invalid}
                  required
                />
              )}
            </Field>

            <Field label="Notes" htmlFor="notes" error={state.errors?.notes}>
              {({ id }) => (
                <Textarea
                  id={id}
                  name="notes"
                  rows={2}
                  defaultValue={item?.notes ?? ""}
                  placeholder="Optional"
                  maxLength={280}
                />
              )}
            </Field>

            <ActionMessage state={state} />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <SubmitButton pending={pending}>{isNew ? "Add charge" : "Save changes"}</SubmitButton>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
