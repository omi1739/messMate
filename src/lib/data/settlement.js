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
import { round2 } from "@/lib/money";

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

  const [bills, expenses, payments] = await Promise.all([
    db.bill.findMany({
      where: { messId, month: { in: months } },
      select: { month: true, water: true, electricity: true, gas: true, wifi: true, other: true },
    }),
    db.expense.findMany({
      where: { messId, date: { gte: monthDateRange(months[0]).gte } },
      select: { amount: true, date: true },
    }),
    db.payment.findMany({
      where: { messId, month: { in: months } },
      select: { month: true, rentPaid: true, mealPaid: true, utilityPaid: true },
    }),
  ]);

  return months.map((key) => {
    const bill = bills.find((b) => b.month === key);

    const spent = round2(
      expenses
        .filter((expense) => monthKeyFromDate(expense.date) === key)
        .reduce((total, expense) => total + expense.amount, 0) +
        (bill ? bill.water + bill.electricity + bill.gas + bill.wifi + bill.other : 0),
    );

    const collected = round2(
      payments
        .filter((payment) => payment.month === key)
        .reduce((total, payment) => total + payment.rentPaid + payment.mealPaid + payment.utilityPaid, 0),
    );

    return { month: key, collected, spent };
  });
});
