"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Check, Users } from "lucide-react";
import { setMealAction, fillDayForAllAction } from "@/app/actions/meals";
import { useActionForm, SubmitButton, ActionMessage } from "@/components/ui/form";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseIcon,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { MEMBER_STATUS_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/money";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

const total = (cell) => (cell?.b ?? 0) + (cell?.l ?? 0) + (cell?.d ?? 0);

/**
 * Member x day grid. Cells are read-only on the server-rendered table; clicking
 * one opens a dialog that posts a single (member, day) row.
 *
 * Values are held in halves, so a cell of 0.5 is legitimate and is rendered as
 * such rather than rounded away.
 */
export function MealGrid({ members, days, cells }) {
  const [editing, setEditing] = useState(null); // { member, dayKey }
  const [filling, setFilling] = useState(null); // dayKey

  const dayTotals = useMemo(() => {
    const out = {};
    for (const day of days) {
      let sum = 0;
      for (const member of members) {
        sum += total(cells[member.id]?.[day.key]);
      }
      out[day.key] = sum;
    }
    return out;
  }, [days, members, cells]);

  const memberTotals = useMemo(() => {
    const out = {};
    for (const member of members) {
      const row = cells[member.id] ?? {};
      out[member.id] = days.reduce((sum, day) => sum + total(row[day.key]), 0);
    }
    return out;
  }, [members, days, cells]);

  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No members to log meals for"
        description="Add your members first, then come back and mark who ate what each day."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">
              Meal counts for each member, by day. Values are in meals and may be halves.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-[9.5rem] border-b border-r border-border bg-surface px-3 py-2 text-left font-semibold"
                >
                  Member
                </th>
                {days.map((day) => (
                  <th
                    key={day.key}
                    scope="col"
                    className={cn(
                      "min-w-[2.1rem] border-b border-border px-1 py-2 text-center font-semibold",
                      day.isToday && "bg-primary-subtle text-primary",
                      day.isFuture && "text-muted-foreground/50",
                    )}
                  >
                    <span className="nums block leading-none">{day.day}</span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="sticky right-0 z-10 min-w-[3.5rem] border-b border-l border-border bg-surface px-2 py-2 text-right font-semibold"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const row = cells[member.id] ?? {};
                return (
                  <tr key={member.id} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-1.5 text-left font-medium"
                    >
                      <span className="block max-w-[9rem] truncate">{member.name}</span>
                      {member.status !== "ACTIVE" ? (
                        <span className="text-[11.5px] font-normal text-muted-foreground">
                          {MEMBER_STATUS_LABELS[member.status]}
                        </span>
                      ) : null}
                    </th>

                    {days.map((day) => {
                      const value = total(row[day.key]);
                      return (
                        <td key={day.key} className="border-b border-border p-0 text-center">
                          <button
                            type="button"
                            onClick={() => setEditing({ member, dayKey: day.key })}
                            className={cn(
                              "nums grid h-7 w-full place-items-center text-[12px] transition-colors",
                              value > 0
                                ? "font-semibold text-foreground hover:bg-primary-subtle"
                                : "text-muted-foreground/35 hover:bg-surface-muted",
                              day.isToday && "bg-primary-subtle/40",
                              day.isFuture && "opacity-40",
                            )}
                            aria-label={`${member.name}, ${day.key}: ${formatNumber(value, 1)} meals. Edit.`}
                          >
                            {value > 0 ? formatNumber(value, 1) : "·"}
                          </button>
                        </td>
                      );
                    })}

                    <td className="nums sticky right-0 z-10 border-b border-l border-border bg-surface px-2 py-1.5 text-right font-semibold">
                      {formatNumber(memberTotals[member.id], 1)}
                    </td>
                  </tr>
                );
              })}

              <tr>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-border bg-surface-muted px-3 py-1.5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Day total
                </th>
                {days.map((day) => (
                  <td
                    key={day.key}
                    className={cn(
                      "nums bg-surface-muted px-1 py-1.5 text-center text-[11.5px]",
                      dayTotals[day.key] > 0 ? "font-semibold" : "text-muted-foreground/40",
                      day.isToday && "bg-primary-subtle/40",
                    )}
                  >
                    {dayTotals[day.key] > 0 ? formatNumber(dayTotals[day.key], 1) : "·"}
                  </td>
                ))}
                <td className="sticky right-0 z-10 border-l border-border bg-surface-muted px-2 py-1.5" />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <p>
            Tap any cell to set breakfast, lunch and dinner. Use halves for part-meals — 0.5 is
            valid.
          </p>
          <Button variant="outline" size="sm" onClick={() => setFilling(days[0]?.key ?? null)}>
            <CalendarCheck className="size-4" aria-hidden />
            Fill a whole day
          </Button>
        </div>
      </div>

      {editing ? (
        <MealCellDialog
          member={editing.member}
          dayKey={editing.dayKey}
          cell={cells[editing.member.id]?.[editing.dayKey]}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {filling ? (
        <FillDayDialog
          dayKey={filling}
          days={days}
          memberCount={members.filter((m) => m.status === "ACTIVE").length}
          onClose={() => setFilling(null)}
        />
      ) : null}
    </>
  );
}

function MealCellDialog({ member, dayKey, cell, onClose }) {
  const { state, formAction, pending, formRef } = useActionForm(setMealAction, { onSuccess: onClose });

  return (
    <Dialog open onClose={onClose} label={`Meals for ${member.name}`}>
      <form ref={formRef} action={formAction} noValidate>
        <DialogHeader>
          <div>
            <DialogTitle>{member.name}</DialogTitle>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{prettyDate(dayKey)}</p>
          </div>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <input type="hidden" name="date" value={dayKey} />
            <input type="hidden" name="memberId" value={member.id} />

            <div className="grid grid-cols-3 gap-3">
              {MEALS.map((meal) => (
                <Field
                  key={meal.key}
                  label={meal.label}
                  htmlFor={meal.key}
                  error={state.errors?.[meal.key]}
                >
                  {({ id, invalid, describedBy }) => (
                    <Input
                      id={id}
                      name={meal.key}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="3"
                      step="0.5"
                      defaultValue={cell?.[meal.key[0]] ?? 0}
                      className="text-center"
                      invalid={invalid}
                      aria-describedby={describedBy}
                    />
                  )}
                </Field>
              ))}
            </div>

            <p className="text-[12px] text-muted-foreground">
              Enter 0, 0.5, 1, 1.5 and so on. Leave a meal at 0 if they did not eat it.
            </p>

            <ActionMessage state={state} />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const formData = new FormData();
              formData.set("date", dayKey);
              formData.set("memberId", member.id);
              formData.set("breakfast", "0");
              formData.set("lunch", "0");
              formData.set("dinner", "0");
              formAction(formData).then((result) => {
                if (result?.ok) onClose();
              });
            }}
            className="mr-auto text-muted-foreground"
          >
            <Check className="size-4" aria-hidden />
            Clear this day
          </Button>

          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <SubmitButton pending={pending}>Save</SubmitButton>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function FillDayDialog({ dayKey, days, memberCount, onClose }) {
  const { state, formAction, pending, formRef } = useActionForm(fillDayForAllAction, { onSuccess: onClose });
  const [selected, setSelected] = useState(dayKey);

  return (
    <Dialog open onClose={onClose} label="Fill a whole day" className="sm:max-w-md">
      <form ref={formRef} action={formAction} noValidate>
        <DialogHeader>
          <div>
            <DialogTitle>Fill a whole day</DialogTitle>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Sets the same value for every active member. Handy for an ordinary day where
              everyone ate.
            </p>
          </div>
          <DialogCloseIcon onClick={onClose} />
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <Field label="Day" htmlFor="date" required>
              {({ id }) => (
                <Select id={id} name="date" value={selected} onChange={(event) => setSelected(event.target.value)}>
                  {days.map((day) => (
                    <option key={day.key} value={day.key}>
                      {prettyDate(day.key)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="grid grid-cols-3 gap-3">
              {MEALS.map((meal) => (
                <Field key={meal.key} label={meal.label} htmlFor={`all-${meal.key}`}>
                  {({ id }) => (
                    <Input
                      id={id}
                      name={meal.key}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="3"
                      step="0.5"
                      defaultValue="1"
                      className="text-center"
                    />
                  )}
                </Field>
              ))}
            </div>

            <p className="text-[12px] text-muted-foreground">
              Applies to {memberCount} active {memberCount === 1 ? "member" : "members"}. It
              overwrites whatever is already recorded for that day.
            </p>

            <ActionMessage state={state} />
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogClose onClick={onClose}>Cancel</DialogClose>
          <SubmitButton pending={pending}>Fill {memberCount} members</SubmitButton>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function prettyDate(dayKey) {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
