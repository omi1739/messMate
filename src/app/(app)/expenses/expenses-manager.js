"use client";

import { useState } from "react";
import { Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from "@/app/actions/expenses";
import { useActionForm, SubmitButton, ActionMessage } from "@/components/ui/form";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, NON_SHARED_EQUALLY } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDateLong } from "@/lib/date";

export function ExpensesManager({ expenses, currency, defaultDate, initialCategory, query }) {
  const [editing, setEditing] = useState(null); // expense | "new" | null

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form method="get" className="relative">
          {initialCategory !== "ALL" ? <input type="hidden" name="category" value={initialCategory} /> : null}
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Search spending"
            aria-label="Search spending"
            className="h-9 w-full rounded-[var(--radius-field)] border border-input bg-background pl-8 pr-2.5 text-[13.5px] placeholder:text-muted-foreground sm:w-56"
          />
        </form>

        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          Add expense
        </Button>
      </div>

      {editing !== null ? (
        <ExpenseDialog
          expense={editing === "new" ? null : editing}
          currency={currency}
          defaultDate={defaultDate}
          defaultCategory={initialCategory === "ALL" ? "BAZAR" : initialCategory}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={query ? "Nothing matched that search" : "No spending recorded yet"}
          description={
            query
              ? "Try a different word, or clear the search to see everything."
              : "Bazar runs set the meal rate. Everything else is shared evenly between active members."
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{expense.description}</p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {formatDateLong(expense.date)}
                  {expense.notes ? ` · ${expense.notes}` : ""}
                </p>
              </div>

              <Badge tone={expense.category === NON_SHARED_EQUALLY ? "primary" : "neutral"}>
                {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
              </Badge>

              <span className="nums w-24 shrink-0 text-right text-[13.5px] font-semibold">
                {formatMoney(expense.amount, { currency })}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditing(expense)}
                  aria-label={`Edit ${expense.description}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <DeleteConfirm
                  title="Delete this expense?"
                  description={`${expense.description} will be removed and the monthly totals recalculated. This cannot be undone.`}
                  confirmLabel="Delete"
                  onConfirm={async () => {
                    const formData = new FormData();
                    formData.set("expenseId", expense.id);
                    return deleteExpenseAction({ ok: false }, formData);
                  }}
                  trigger={(open) => (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={open}
                      aria-label={`Delete ${expense.description}`}
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

function ExpenseDialog({ expense, currency, defaultDate, defaultCategory, onClose }) {
  const isNew = !expense;
  const { state, formAction, pending } = useActionForm(
    isNew ? createExpenseAction : updateExpenseAction,
  );

  async function handleSubmit(formData) {
    const result = await formAction(formData);
    if (result?.ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} label={isNew ? "Add expense" : "Edit expense"}>
      <form action={handleSubmit} noValidate>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add expense" : "Edit expense"}</DialogTitle>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            {!isNew ? <input type="hidden" name="expenseId" value={expense.id} /> : null}

            <Field label="What was it" htmlFor="description" error={state.errors?.description} required>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  name="description"
                  defaultValue={expense?.description ?? ""}
                  placeholder="Weekly bazar — chicken and vegetables"
                  invalid={invalid}
                  maxLength={120}
                  required
                  autoFocus
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="amount" error={state.errors?.amount} hint={currency} required>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={expense?.amount ?? ""}
                    placeholder="0.00"
                    invalid={invalid}
                    required
                  />
                )}
              </Field>

              <Field label="Date" htmlFor="date" error={state.errors?.date} required>
                {({ id, invalid }) => (
                  <Input
                    id={id}
                    name="date"
                    type="date"
                    defaultValue={expense ? toDateInput(expense.date) : defaultDate}
                    invalid={invalid}
                    required
                  />
                )}
              </Field>
            </div>

            <Field
              label="Category"
              htmlFor="category"
              error={state.errors?.category}
              hint={
                defaultCategory === "BAZAR"
                  ? "Bazar sets the meal rate. Other categories are split evenly between active members."
                  : "Split evenly between active members."
              }
              required
            >
              {({ id, invalid }) => (
                <Select
                  id={id}
                  name="category"
                  defaultValue={expense?.category ?? defaultCategory}
                  invalid={invalid}
                >
                  {EXPENSE_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {EXPENSE_CATEGORY_LABELS[value]}
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
                  defaultValue={expense?.notes ?? ""}
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
          <SubmitButton pending={pending}>{isNew ? "Add expense" : "Save changes"}</SubmitButton>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function toDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}
