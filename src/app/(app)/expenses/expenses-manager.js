"use client";

import { useRef, useState } from "react";
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
import { currentMonthKey, formatDateLong } from "@/lib/date";

export function ExpensesManager({ expenses, currency, defaultDate, initialCategory, query, month }) {
  const [editing, setEditing] = useState(null); // expense | null
  const defaultCategory = initialCategory === "ALL" ? "BAZAR" : initialCategory;

  // Dropping the search must not also drop the month and the category the user
  // had narrowed to, so the link is rebuilt from what is on screen.
  const clearParams = new URLSearchParams();
  if (month !== currentMonthKey()) clearParams.set("month", month);
  if (initialCategory !== "ALL") clearParams.set("category", initialCategory);
  const clearSearch = clearParams.toString();
  const clearHref = clearSearch ? `/expenses?${clearSearch}` : "/expenses";

  return (
    <>
      <QuickAddExpense currency={currency} defaultDate={defaultDate} defaultCategory={defaultCategory} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form method="get" className="relative">
          {/* The month has to ride along: the form replaces the whole query
              string, so without this a search on a past month silently jumped
              the user back to the current one. */}
          {month !== currentMonthKey() ? <input type="hidden" name="month" value={month} /> : null}
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
            className="h-9 w-full rounded-[var(--radius-field)] border border-border bg-background pl-8 pr-2.5 text-[13.5px] placeholder:text-muted-foreground sm:w-56"
          />
        </form>

        {query ? (
          <a
            href={clearHref}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Clear search
          </a>
        ) : null}
      </div>

      {editing !== null ? (
        <ExpenseDialog
          expense={editing}
          currency={currency}
          defaultCategory={defaultCategory}
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
              : "Add the week's bazar above. Bazar sets the meal rate; everything else is shared evenly between active members."
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

/**
 * Adding an expense used to mean opening a dialog, filling four fields and
 * dismissing it, then opening it again for the next one. Spending gets recorded
 * a line at a time, often several lines in the same sitting, so the form stays
 * on the page and clears itself after a save.
 *
 * Notes are deliberately not here: they are rare, and the edit dialog already
 * has room for them.
 */
function QuickAddExpense({ currency, defaultDate, defaultCategory }) {
  const descriptionRef = useRef(null);
  const { state, formAction, pending, formRef } = useActionForm(createExpenseAction, {
    onSuccess: () => {
      formRef.current?.reset();
      descriptionRef.current?.focus();
    },
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-label="Add an expense"
      className="rounded-[var(--radius-card)] border border-border bg-surface-muted/60 p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_9rem_auto] sm:items-start">
        <Field label="What was it" htmlFor="quick-description" error={state.errors?.description}>
          {({ id, invalid, describedBy }) => (
            <Input
              ref={descriptionRef}
              id={id}
              name="description"
              placeholder="Weekly bazar — chicken and vegetables"
              defaultValue={state.values?.description}
              aria-describedby={describedBy}
              invalid={invalid}
              maxLength={120}
            />
          )}
        </Field>

        <Field label="Amount" htmlFor="quick-amount" error={state.errors?.amount} hint={currency}>
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

        <Field label="Category" htmlFor="quick-category" error={state.errors?.category}>
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              name="category"
              defaultValue={state.values?.category ?? defaultCategory}
              aria-describedby={describedBy}
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

        <Field label="Date" htmlFor="quick-date" error={state.errors?.date}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="date"
              type="date"
              defaultValue={state.values?.date ?? defaultDate}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ActionMessage state={state} className="min-w-0 flex-1" />
        <SubmitButton pending={pending} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Add
        </SubmitButton>
      </div>
    </form>
  );
}

/** Editing keeps the dialog: it is a deliberate, less frequent action. */
function ExpenseDialog({ expense, currency, defaultCategory, onClose }) {
  const { state, formAction, pending, formRef } = useActionForm(updateExpenseAction, { onSuccess: onClose });

  return (
    <Dialog open onClose={onClose} label="Edit expense">
      <form ref={formRef} action={formAction} noValidate>
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <input type="hidden" name="expenseId" value={expense.id} />

            <Field label="What was it" htmlFor="description" error={state.errors?.description} required>
              {({ id, invalid, describedBy }) => (
                <Input
                  id={id}
                  name="description"
                  defaultValue={state.values?.description ?? expense.description}
                  aria-describedby={describedBy}
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
                {({ id, invalid, describedBy }) => (
                  <Input
                    id={id}
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={state.values?.amount ?? expense.amount}
                    aria-describedby={describedBy}
                    placeholder="0.00"
                    invalid={invalid}
                    required
                  />
                )}
              </Field>

              <Field label="Date" htmlFor="date" error={state.errors?.date} required>
                {({ id, invalid, describedBy }) => (
                  <Input
                    id={id}
                    name="date"
                    type="date"
                    defaultValue={state.values?.date ?? toDateInput(expense.date)}
                    aria-describedby={describedBy}
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
              {({ id, invalid, describedBy }) => (
                <Select
                  id={id}
                  name="category"
                  defaultValue={state.values?.category ?? expense.category ?? defaultCategory}
                  aria-describedby={describedBy}
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
              {({ id, invalid, describedBy }) => (
                <Textarea
                  id={id}
                  name="notes"
                  rows={2}
                  defaultValue={state.values?.notes ?? expense.notes ?? ""}
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

function toDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}
