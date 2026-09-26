import { cache } from "react";
import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";
import { currentMonthKey, isMonthKey, monthDateRange, monthKeyFromDate, todayUtcMidnight } from "@/lib/date";
import { sumBy } from "@/lib/money";

/**
 * Expenses for a month with per-category breakdown. `query` and `category` are
 * optional filters applied in the database.
 */
export const listExpenses = cache(async ({ month, category, query } = {}) => {
  const messId = await requireMessId();
  const monthKey = isMonthKey(month) ? month : currentMonthKey();
  const range = monthDateRange(monthKey);

  const where = {
    messId,
    date: { gte: range.gte, lt: range.lt },
    ...(category && category !== "ALL" ? { category } : {}),
    ...(query
      ? {
          OR: [
            { description: { contains: query, mode: "insensitive" } },
            { notes: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [expenses, allForTotals] = await Promise.all([
    db.expense.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    db.expense.findMany({
      where: { messId, date: { gte: range.gte, lt: range.lt } },
      select: { amount: true, category: true },
    }),
  ]);

  const byCategory = {};
  for (const expense of allForTotals) {
    byCategory[expense.category] = (byCategory[expense.category] ?? 0) + expense.amount;
  }

  return {
    month: monthKey,
    expenses,
    summary: {
      count: allForTotals.length,
      total: sumBy(allForTotals, (expense) => expense.amount),
      bazar: sumBy(
        allForTotals.filter((expense) => expense.category === "BAZAR"),
        (expense) => expense.amount,
      ),
      other: sumBy(
        allForTotals.filter((expense) => expense.category !== "BAZAR"),
        (expense) => expense.amount,
      ),
      byCategory: Object.entries(byCategory).map(([key, amount]) => ({
        category: key,
        amount,
        share: sumBy(allForTotals, (e) => e.amount) > 0
          ? (amount / sumBy(allForTotals, (e) => e.amount)) * 100
          : 0,
      })),
    },
  };
});

/** Most recent expenses across all months, for the dashboard feed. */
export const listRecentExpenses = cache(async (limit = 6) => {
  const messId = await requireMessId();
  return db.expense.findMany({
    where: { messId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
});

/** Highest single-day bazar spend in the current month, for the dashboard. */
export const getTopBazarDay = cache(async (month) => {
  const messId = await requireMessId();
  const monthKey = isMonthKey(month) ? month : currentMonthKey();
  const range = monthDateRange(monthKey);

  const expenses = await db.expense.findMany({
    where: { messId, category: "BAZAR", date: { gte: range.gte, lt: range.lt } },
    select: { amount: true, date: true },
  });

  const byDay = new Map();
  for (const expense of expenses) {
    const key = monthKeyFromDate(expense.date);
    byDay.set(key, (byDay.get(key) ?? 0) + expense.amount);
  }

  let top = null;
  for (const [day, amount] of byDay) {
    if (!top || amount > top.amount) top = { day, amount };
  }
  return top;
});

/** Expense totals for the current month, ignoring the month picker. */
export const getMonthExpenseTotal = cache(async (month) => {
  const messId = await requireMessId();
  const monthKey = isMonthKey(month) ? month : currentMonthKey();
  const range = monthDateRange(monthKey);

  const expenses = await db.expense.findMany({
    where: { messId, date: { gte: range.gte, lt: range.lt } },
    select: { amount: true, category: true },
  });

  return {
    total: sumBy(expenses, (expense) => expense.amount),
    bazar: sumBy(
      expenses.filter((expense) => expense.category === "BAZAR"),
      (expense) => expense.amount,
    ),
    other: sumBy(
      expenses.filter((expense) => expense.category !== "BAZAR"),
      (expense) => expense.amount,
    ),
  };
});

export { todayUtcMidnight };
