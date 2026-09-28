"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Users } from "lucide-react";
import { setMealAction, fillMissingMealsAction } from "@/app/actions/meals";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { MEMBER_STATUS_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/money";

/*
 * Day-first meal entry.
 *
 * The old flow was a member x day matrix where tapping a cell opened a dialog
 * asking for three numbers. An ordinary day where seven people ate everything
 * meant seven dialogs and twenty-one typed values, and finding the right column
 * in a 31-column table was the hard part.
 *
 * Here a day is the unit of work. Pick the day, then tap. A tap cycles
 * breakfast/lunch/dinner through off -> full -> half -> off, which covers
 * essentially every real entry, and the row total updates as you go. Saving is
 * optimistic and per member, so the screen never waits on the network.
 */

/*
 * `key` is the property on a cell and `field` is the form field the action
 * expects. They are not the same string, and conflating them writes nothing:
 * the draft gained a `breakfast` key while the action kept reading `b`.
 */
const MEALS = [
  { field: "breakfast", key: "b", short: "B", label: "Breakfast" },
  { field: "lunch", key: "l", short: "L", label: "Lunch" },
  { field: "dinner", key: "d", short: "D", label: "Dinner" },
];

/** off -> full -> half -> off. */
function nextValue(value) {
  if (value === 0) return 1;
  if (value === 1) return 0.5;
  return 0;
}

const valueLabel = (value) => (value === 1 ? "full" : value === 0.5 ? "half" : "none");

export function QuickMealLog({ members, days, cells, todayKey }) {
  const { toast } = useToast();

  // Default to today when this month contains it, otherwise the first day that
  // has actually happened. Logging a month you are not living in is rare.
  const initialDay = useMemo(() => {
    if (todayKey) return todayKey;
    return days.find((day) => !day.isFuture)?.key ?? days[0]?.key ?? null;
  }, [todayKey, days]);

  const [picked, setPicked] = useState({ month: initialDay, dayKey: initialDay });
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(() => new Set());
  const [filling, setFilling] = useState(false);
  const chains = useRef(new Map());

  /*
   * setState is async, so two taps in one tick both read the same rendered row
   * and the second overwrites the first. This holds the row instead.
   */
  const cache = useRef({ rows: {} });

  // When the server sends a different default day (a new month, or a day rolling
  // over) the stored pick no longer applies, so it is ignored rather than
  // corrected in an effect. Deriving it here keeps the render pass pure.
  const dayKey = picked.month === initialDay ? picked.dayKey : initialDay;
  const setDayKey = useCallback(
    (next) => {
      setPicked({ month: initialDay, dayKey: next });
      cache.current = { rows: {} };
    },
    [initialDay],
  );

  const index = days.findIndex((day) => day.key === dayKey);
  const day = index >= 0 ? days[index] : null;

  // Seed the draft from the server data for whichever day is showing.
  const dayDraft = useMemo(() => {
    if (!dayKey) return {};
    const out = {};
    for (const member of members) {
      const cell = cells[member.id]?.[dayKey];
      out[member.id] = {
        b: cell?.b ?? 0,
        l: cell?.l ?? 0,
        d: cell?.d ?? 0,
      };
    }
    return out;
  }, [dayKey, members, cells]);

  const shown = draft[dayKey] ?? dayDraft;

  function rowFor(memberId) {
    const existing = cache.current.rows[memberId];
    if (existing) return existing;
    const seeded = { ...(dayDraft[memberId] ?? { b: 0, l: 0, d: 0 }) };
    cache.current = { rows: { ...cache.current.rows, [memberId]: seeded } };
    return seeded;
  }

  function setCell(memberId, mealKey, value) {
    const next = { ...rowFor(memberId), [mealKey]: value };
    cache.current = { rows: { ...cache.current.rows, [memberId]: next } };
    const rows = cache.current.rows;
    setDraft((current) => ({ ...current, [dayKey]: { ...(current[dayKey] ?? {}), ...rows } }));
    enqueue(memberId, next);
  }

  const dayTotalFor = (mealKey) =>
    members.reduce((sum, member) => sum + (shown[member.id]?.[mealKey] ?? 0), 0);

  /**
   * Writes for one member are chained so two quick taps cannot land out of
   * order, which would leave the server holding the older value.
   */
  function enqueue(memberId, values) {
    const previous = chains.current.get(memberId) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        setSaving((current) => new Set(current).add(memberId));
        const formData = new FormData();
        formData.set("date", dayKey);
        formData.set("memberId", memberId);
        for (const meal of MEALS) {
          formData.set(meal.field, String(values[meal.key] ?? 0));
        }
        try {
          const result = await setMealAction({ ok: false }, formData);
          if (result && !result.ok) {
            toast({ title: result.error ?? "Could not save that meal.", variant: "error" });
          }
        } finally {
          setSaving((current) => {
            const copy = new Set(current);
            copy.delete(memberId);
            return copy;
          });
        }
      });
    chains.current.set(memberId, next);
  }

  async function fillEveryone() {
    setFilling(true);
    try {
      const formData = new FormData();
      formData.set("date", dayKey);
      const result = await fillMissingMealsAction({ ok: false }, formData);
      toast({
        title: result?.message ?? (result?.ok ? "Done." : "Could not fill that day."),
        variant: result?.ok ? "success" : "error",
      });
      cache.current = { rows: {} };
      setDraft((current) => {
        const copy = { ...current };
        delete copy[dayKey];
        return copy;
      });
    } finally {
      setFilling(false);
    }
  }

  function clearMember(memberId) {
    const next = { b: 0, l: 0, d: 0 };
    cache.current = { rows: { ...cache.current.rows, [memberId]: next } };
    const rows = cache.current.rows;
    setDraft((current) => ({ ...current, [dayKey]: { ...(current[dayKey] ?? {}), ...rows } }));
    enqueue(memberId, next);
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No members to log meals for"
        description="Add your members first, then come back and mark who ate what each day."
      />
    );
  }

  const dayTotal = members.reduce(
    (sum, member) => {
      const row = shown[member.id];
      return sum + (row?.b ?? 0) + (row?.l ?? 0) + (row?.d ?? 0);
    },
    0,
  );
  const pendingCount = [...saving].length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setDayKey(days[Math.max(0, index - 1)]?.key ?? dayKey)}
            disabled={index <= 0}
            aria-label="Previous day"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>

          <div className="min-w-[10.5rem] text-center">
            <p className="text-[14px] font-semibold leading-tight">{day ? longDate(day.key) : "—"}</p>
            <p className="text-[11.5px] text-muted-foreground">{day?.isToday ? "Today" : day?.weekday}</p>
          </div>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setDayKey(days[Math.min(days.length - 1, index + 1)]?.key ?? dayKey)}
            disabled={index >= days.length - 1}
            aria-label="Next day"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {todayKey && dayKey !== todayKey ? (
            <Button variant="ghost" size="sm" onClick={() => setDayKey(todayKey)}>
              Jump to today
            </Button>
          ) : null}
          <Button onClick={fillEveryone} loading={filling}>
            <Check className="size-4" aria-hidden />
            Everyone ate
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
        <table className="w-full text-[13.5px]">
          <caption className="sr-only">
            Meals for {day ? longDate(day.key) : "the selected day"}. Tap a meal to cycle it between
            none, full and half.
          </caption>
          <thead>
            <tr className="bg-surface-muted text-[11.5px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Member</th>
              {MEALS.map((meal) => (
                <th key={meal.field} scope="col" className="px-1 py-2 text-center font-semibold">
                  {meal.short}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
              <th scope="col" className="w-9 px-1 py-2"><span className="sr-only">Clear</span></th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const row = shown[member.id] ?? { b: 0, l: 0, d: 0 };
              const sum = row.b + row.l + row.d;
              const busy = saving.has(member.id);
              return (
                <tr key={member.id} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    <span className="block max-w-[10rem] truncate">{member.name}</span>
                    {member.status !== "ACTIVE" ? (
                      <span className="text-[10.5px] font-normal text-muted-foreground">
                        {MEMBER_STATUS_LABELS[member.status]}
                      </span>
                    ) : null}
                  </th>

                  {MEALS.map((meal) => (
                    <td key={meal.field} className="p-0 text-center">
                      <MealChip
                        value={row[meal.key]}
                        label={`${member.name}, ${meal.label} on ${day ? longDate(day.key) : "this day"}`}
                        busy={busy}
                        onClick={() => setCell(member.id, meal.key, nextValue(row[meal.key]))}
                      />
                    </td>
                  ))}

                  <td className="nums px-3 py-1.5 text-right font-semibold">
                    {sum > 0 ? formatNumber(sum, 1) : <span className="text-muted-foreground/40">—</span>}
                  </td>

                  <td className="px-1 py-1.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => clearMember(member.id)}
                      disabled={sum === 0}
                      aria-label={`Clear ${member.name} for this day`}
                      className="text-muted-foreground hover:text-danger"
                    >
                      <Minus className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface-muted font-semibold">
              <th scope="row" className="px-3 py-2 text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                Day total
              </th>
              {MEALS.map((meal) => {
                const sum = dayTotalFor(meal.key);
                return (
                  <td key={meal.field} className="nums px-1 py-2 text-center text-[12px]">
                    {sum > 0 ? formatNumber(sum, 1) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                );
              })}
              <td className="nums px-3 py-2 text-right text-[12.5px]">
                {dayTotal > 0 ? formatNumber(dayTotal, 1) : "—"}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
        <span>Tap a meal to cycle it:</span>
        <span className="inline-flex items-center gap-1">
          <ChipSwatch value={0} /> none
        </span>
        <span className="inline-flex items-center gap-1">
          <ChipSwatch value={1} /> full
        </span>
        <span className="inline-flex items-center gap-1">
          <ChipSwatch value={0.5} /> half
        </span>
        {pendingCount > 0 ? (
          <span className="text-muted-foreground">· saving {pendingCount}…</span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * One meal cell. Drawn as a real button so it is reachable by keyboard and
 * announced properly; the fill level is the only thing that changes.
 */
function MealChip({ value, label, onClick, busy }) {
  const full = value === 1;
  const half = value === 0.5;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${valueLabel(value)}. Tap to change.`}
      aria-busy={busy || undefined}
      className={cn(
        "nums mx-auto grid size-8 place-items-center rounded-[var(--radius-field)] border text-[12.5px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        full && "border-primary bg-primary text-primary-foreground",
        half && "border-primary/55 bg-primary-subtle text-primary",
        value === 0 && "border-transparent bg-surface-muted text-muted-foreground/45 hover:border-border hover:text-foreground",
      )}
    >
      {full ? <Check className="size-4" aria-hidden /> : half ? "½" : ""}
    </button>
  );
}

function ChipSwatch({ value }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid size-4 place-items-center rounded-[4px] border text-[9px] font-semibold",
        value === 1 && "border-primary bg-primary text-primary-foreground",
        value === 0.5 && "border-primary/55 bg-primary-subtle text-primary",
        value === 0 && "border-border bg-surface-muted",
      )}
    >
      {value === 1 ? "✓" : value === 0.5 ? "½" : ""}
    </span>
  );
}

function longDate(dayKey) {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

