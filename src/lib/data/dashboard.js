import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";
import { getSettlement, getSettlementTrend } from "@/lib/data/settlement";
import { listRecentExpenses } from "@/lib/data/expenses";
import { currentMonthKey, isMonthKey, todayUtcMidnight, toDateInputValue } from "@/lib/date";
import { round2 } from "@/lib/money";

/**
 * Everything the dashboard needs, gathered in parallel.
 *
 * Onboarding state is derived from what the mess already has, so a brand new
 * account gets a "here's how to get started" checklist instead of a wall of
 * zeroes.
 */
export async function getDashboardStats(requestedMonth) {
  const messId = await requireMessId();
  const month = isMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();
  const todayKey = toDateInputValue(todayUtcMidnight());

  const [settlement, trend, recentExpenses, todaysMeals, memberCount] = await Promise.all([
    getSettlement(month),
    getSettlementTrend(month),
    listRecentExpenses(5),
    db.meal.findMany({
      where: { messId, date: todayUtcMidnight() },
      select: { memberId: true, breakfast: true, lunch: true, dinner: true },
    }),
    db.member.count({ where: { messId } }),
  ]);

  const { totals } = settlement;

  const todays = {
    breakfast: round2(todaysMeals.reduce((sum, meal) => sum + (meal.breakfast ?? 0), 0)),
    lunch: round2(todaysMeals.reduce((sum, meal) => sum + (meal.lunch ?? 0), 0)),
    dinner: round2(todaysMeals.reduce((sum, meal) => sum + (meal.dinner ?? 0), 0)),
    eaters: todaysMeals.filter(
      (meal) => (meal.breakfast ?? 0) + (meal.lunch ?? 0) + (meal.dinner ?? 0) > 0,
    ).length,
  };
  todays.total = round2(todays.breakfast + todays.lunch + todays.dinner);

  const collectionRate =
    totals.grandTotal > 0
      ? Math.min(100, Math.round((totals.paidTotal / totals.grandTotal) * 100))
      : 0;

  return {
    month,
    todayKey,
    settlement,
    trend,
    recentExpenses,
    today: todays,
    collectionRate,
    memberCount,
    setup: {
      hasMess: true,
      hasMembers: memberCount > 0,
      hasExpenses: totals.expenseTotal > 0,
      hasBills: totals.utilityTotal > 0,
      hasMeals: totals.totalMeals > 0,
    },
  };
}
