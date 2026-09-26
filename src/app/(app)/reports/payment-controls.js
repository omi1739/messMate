"use client";

import { useState } from "react";
import { CheckCheck, Printer } from "lucide-react";
import { recordPaymentAction, markFullyPaidAction } from "@/app/actions/payments";
import { useActionForm, SubmitButton, ActionMessage } from "@/components/ui/form";
import { Field, Input } from "@/components/ui/input";
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
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Print / save-as-PDF button. Printing is a browser capability, not a library. */
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()} className="no-print">
      <Printer className="size-4" aria-hidden />
      Print / save as PDF
    </Button>
  );
}

/** "Settle up" per member, plus manual payment entry for partial payments. */
export function PaymentControls({ month, rows, currency }) {
  const [editing, setEditing] = useState(null); // row | null

  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.member.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium">{row.member.name}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {row.paidTotal > 0
                  ? `${formatMoney(row.paidTotal, { currency })} paid of ${formatMoney(row.totalBill, { currency })}`
                  : `Nothing paid of ${formatMoney(row.totalBill, { currency })}`}
              </p>
            </div>

            <span
              className={cn(
                "nums w-24 shrink-0 text-right text-[13.5px] font-semibold",
                row.balance > 0 && "text-danger",
                row.balance < 0 && "text-success",
                row.balance === 0 && "text-muted-foreground",
              )}
            >
              {row.balance === 0 ? "settled" : formatMoney(Math.abs(row.balance), { currency })}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              {row.balance === 0 ? (
                <Badge tone="success" className="mr-1">
                  <CheckCheck className="size-3" aria-hidden />
                  paid
                </Badge>
              ) : (
                <MarkPaid month={month} row={row} currency={currency} />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(row)}
                aria-label={`Record a payment from ${row.member.name}`}
              >
                Record
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <PaymentDialog
          month={month}
          row={editing}
          currency={currency}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function MarkPaid({ month, row, currency }) {
  const { state, formAction, pending } = useActionForm(markFullyPaidAction, {
    successToast: true,
  });

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="memberId" value={row.member.id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        loading={pending}
        title={`Record ${formatMoney(row.totalBill, { currency })} for ${row.member.name}`}
      >
        {pending ? "Saving" : "Mark paid"}
      </Button>
      {state?.error ? (
        <span role="alert" className="w-full text-[11.5px] text-danger">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function PaymentDialog({ month, row, currency, onClose }) {
  const { state, formAction, pending } = useActionForm(recordPaymentAction);

  async function handleSubmit(formData) {
    const result = await formAction(formData);
    if (result?.ok) onClose();
  }

  return (
    <Dialog open onClose={onClose} label={`Payment from ${row.member.name}`}>
      <form action={handleSubmit} noValidate>
        <DialogHeader>
          <div>
            <DialogTitle>Payment from {row.member.name}</DialogTitle>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Billed {formatMoney(row.totalBill, { currency })} ·{" "}
              {row.balance > 0
                ? `owes ${formatMoney(row.balance, { currency })}`
                : row.balance < 0
                  ? `overpaid by ${formatMoney(Math.abs(row.balance), { currency })}`
                  : "fully settled"}
            </p>
          </div>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="memberId" value={row.member.id} />

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Rent paid" htmlFor="rentPaid" error={state.errors?.rentPaid} hint={currency}>
                {({ id }) => (
                  <Input
                    id={id}
                    name="rentPaid"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={row.paid.rent}
                  />
                )}
              </Field>
              <Field label="Meals paid" htmlFor="mealPaid" error={state.errors?.mealPaid} hint={currency}>
                {({ id }) => (
                  <Input
                    id={id}
                    name="mealPaid"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={row.paid.meals}
                  />
                )}
              </Field>
              <Field
                label="Utilities paid"
                htmlFor="utilityPaid"
                error={state.errors?.utilityPaid}
                hint={currency}
              >
                {({ id }) => (
                  <Input
                    id={id}
                    name="utilityPaid"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue={row.paid.utilities}
                  />
                )}
              </Field>
            </div>

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              These replace whatever was recorded before, so edit the figures rather than adding to
              them. Overpayment is allowed — paying next month&rsquo;s rent early is normal.
            </p>

            <ActionMessage state={state} />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <SubmitButton pending={pending}>Save payment</SubmitButton>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
