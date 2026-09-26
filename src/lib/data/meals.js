import { cache } from "react";
import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";
import {
  currentMonthKey,
  isMonthKey,
  monthDateRange,
  monthDates,
  toDateInputValue,
  todayUtcMidnight,
} from "@/lib/date";

/**
 * Builds the member x day grid for the meals page.
 *
 * Returns rows keyed by member id, plus the day columns, so the table can be
 * rendered without any per-cell lookups.
 */
export const getMealGrid = cache(async (requestedMonth) => {
  const messId = await requireMessId();
  const month = isMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();
  const range = monthDateRange(month);

  const [members, meals] = await Promise.all([
    db.member.findMany({
      where: { messId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, name: true, status: true, phone: true },
    }),
    db.meal.findMany({
      where: { messId, date: { gte: range.gte, lt: range.lt } },
      select: { memberId: true, date: true, breakfast: true, lunch: true, dinner: true },
    }),
  ]);

  const grid = new Map();
  for (const meal of meals) {
    const key = toDateInputValue(meal.date);
    const existing = grid.get(meal.memberId) ?? new Map();
    existing.set(key, {
      breakfast: meal.breakfast ?? 0,
      lunch: meal.lunch ?? 0,
      dinner: meal.dinner ?? 0,
    });
    grid.set(meal.memberId, existing);
  }

  const today = todayUtcMidnight();
  const days = monthDates(month).map((date) => {
    const key = toDateInputValue(date);
    return {
      key,
      date,
      day: date.getUTCDate(),
      isToday: key === toDateInputValue(today),
      isFuture: date > today,
    };
  });

  return { month, members, days, grid, todayKey: toDateInputValue(today) };
});

/** Meals for one member across a month — used by the member detail view. */
export const getMemberMeals = cache(async (memberId, requestedMonth) => {
  const messId = await requireMessId();
  const month = isMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();
  const range = monthDateRange(month);

  return db.meal.findMany({
    where: { messId, memberId, date: { gte: range.gte, lt: range.lt } },
    orderBy: { date: "asc" },
  });
});
