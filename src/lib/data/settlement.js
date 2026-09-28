import { cache } from "react";
import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";
import { computeSettlement, EMPTY_BILL } from "@/lib/settlement";
import {
  currentMonthKey,
  isMonthKey,
  monthDateRange,
  monthKeyFromDate,
  shiftMonth,
} from "@/lib/date";
import { round2, sumBy } from "@/lib/money";

/**
 * Loads everything needed to settle a month in one round trip set, always
 * scoped to the signed-in user's mess.
 */
export const getSettlement = cache(async (requestedMonth) => {
  const messId = await requireMessId();
  const month = isMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();
  const range = monthDateRange(month);

  const [members, meals, expenses, bill, customBills, payments] = await Promise.all([
    db.member.findMany({
      where: { messId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    db.meal.findMany({
      where: { messId, date: { gte: range.gte, lt: range.lt } },
    }),
    db.expense.findMany({
      where: { messId, date: { gte: range.gte, lt: range.lt } },
      orderBy: { date: "desc" },
    }),
    db.bill.findUnique({ where: { messId_month: { messId, month } } }),
    db.customBill.findMany({ where: { messId, month }, orderBy: { createdAt: "asc" } }),
    db.payment.findMany({ where: { messId, month } }),
  ]);

  return computeSettlement({
    month,
    members,
    meals,
    expenses,
    bill: bill ?? EMPTY_BILL,
    customBills,
    payments,
  });
});

/** Collected vs spent for the last three months, for the dashboard trend. */
export const getSettlementTrend = cache(async (requestedMonth) => {
  const messId = await requireMessId();
  const month = isMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();
  const months = [shiftMonth(month, -2), shiftMonth(month, -1), month];

  // Bounded on both ends. An open-ended `gte` returned every expense the mess
  // had ever recorded, on every dashboard load, and threw the surplus away in
  // JavaScript — the numbers were right but the query grew without limit.
  const windowStart = monthDateRange(months[0]).gte;
  const windowEnd = monthDateRange(month).lt;

  const [bills, customBills, expenses, payments] = await Promise.all([
    db.bill.findMany({
      where: { messId, month: { in: months } },
      select: { month: true, water: true, electricity: true, gas: true, wifi: true, other: true },
    }),
    // Custom bills are part of "spent" in the settlement report, so leaving them
    // out here made the dashboard trend permanently disagree with the report for
    // any mess that uses them, always in the same direction.
    db.customBill.findMany({
      where: { messId, month: { in: months } },
      select: { month: true, amount: true },
    }),
    db.expense.findMany({
      where: { messId, date: { gte: windowStart, lt: windowEnd } },
      select: { amount: true, date: true },
    }),
    db.payment.findMany({
      where: { messId, month: { in: months } },
      select: { month: true, rentPaid: true, mealPaid: true, utilityPaid: true },
    }),
  ]);

  return months.map((key) => {
    const bill = bills.find((b) => b.month === key);
    const fixedUtilities = bill
      ? bill.water + bill.electricity + bill.gas + bill.wifi + bill.other
      : 0;
    const custom = sumBy(
      customBills.filter((item) => item.month === key),
      (item) => item.amount,
    );

    const spent = round2(
      sumBy(
        expenses.filter((expense) => monthKeyFromDate(expense.date) === key),
        (expense) => expense.amount,
      ) + fixedUtilities + custom,
    );

    const collected = round2(
      sumBy(
        payments.filter((payment) => payment.month === key),
        (payment) => payment.rentPaid + payment.mealPaid + payment.utilityPaid,
      ),
    );

    return { month: key, collected, spent };
  });
});
