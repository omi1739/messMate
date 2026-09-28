import { cache } from "react";
import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";
import { currentMonthKey, isMonthKey, monthDateRange } from "@/lib/date";
import { sumBy } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

/**
 * Expenses for a month with per-category breakdown. `query` and `category` are
 * optional filters applied in the database.
 *
 * The `summary` is deliberately **month-wide, not filtered** — the three StatCards
 * answer "what did this month cost", which a category filter must not change. The
 * page therefore gets both counts and is expected to label them.
 */
export const listExpenses = cache(async ({ month, category, query } = {}) => {
  const messId = await requireMessId();
  const monthKey = isMonthKey(month) ? month : currentMonthKey();
  const range = monthDateRange(monthKey);

  // An unrecognised category would otherwise reach the database and return an
  // empty list with no error, while the filter control rendered blank because no
  // <option> matched.
  const categoryFilter =
    typeof category === "string" && EXPENSE_CATEGORIES.includes(category) ? category : "ALL";

  const where = {
    messId,
    date: { gte: range.gte, lt: range.lt },
    ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
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
      // Deterministic order, so categories with equal totals cannot swap places
      // between requests once the page sorts them by amount.
      orderBy: { category: "asc" },
    }),
  ]);

  const byCategory = {};
  for (const expense of allForTotals) {
    byCategory[expense.category] = (byCategory[expense.category] ?? 0) + expense.amount;
  }

  // Hoisted: this was being re-reduced twice per category inside the map below.
  const monthTotal = sumBy(allForTotals, (expense) => expense.amount);
  const hasFilter = categoryFilter !== "ALL" || Boolean(query);

  return {
    month: monthKey,
    category: categoryFilter,
    expenses,
    summary: {
      /** Rows in the (possibly filtered) list on screen. */
      count: expenses.length,
      /** Rows in the month, filters ignored. */
      monthCount: allForTotals.length,
      hasFilter,
      total: monthTotal,
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
        share: monthTotal > 0 ? (amount / monthTotal) * 100 : 0,
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
