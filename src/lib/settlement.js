import { round2, sumBy } from "@/lib/money";

/**
 * Settlement engine (pure — no database access, so it is easy to reason about
 * and to test).
 *
 * The costing model, in the order a mess manager thinks about it:
 *
 *   1. Meal rate  = total BAZAR spending / total meals eaten.
 *      Everyone is charged at this one rate: mealsEaten x rate. Charged to
 *      everyone, because you pay for the food you ate.
 *   2. Seat rent  = each active member's own rent. Never charged to
 *      non-active members.
 *   3. Utilities  = (water + electricity + gas + wifi + other + custom bills)
 *      split evenly across active members.
 *   4. Other shared costs = every non-BAZAR expense split evenly across active
 *      members.
 *
 * A member's bill is the sum of those four heads; their balance is the bill
 * minus what they have paid. Positive balance = they owe you.
 *
 * Money is held at full precision while calculating and rounded only when a
 * value is presented. Because rounding each row independently can leave a few
 * paisa unaccounted for, `roundingAdjustment` reports the exact difference so
 * the report footer always reconciles with the headline total.
 */

export const EMPTY_BILL = {
  water: 0,
  electricity: 0,
  gas: 0,
  wifi: 0,
  other: 0,
};

function mealUnits(meal) {
  return (meal?.breakfast ?? 0) + (meal?.lunch ?? 0) + (meal?.dinner ?? 0);
}

function breakdownOf(meal) {
  if (!meal) return { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
  return {
    breakfast: round2(meal.breakfast ?? 0),
    lunch: round2(meal.lunch ?? 0),
    dinner: round2(meal.dinner ?? 0),
    total: round2(mealUnits(meal)),
  };
}

export function computeSettlement({
  month,
  members = [],
  meals = [],
  expenses = [],
  bill = EMPTY_BILL,
  customBills = [],
  payments = [],
}) {
  const activeMembers = members.filter((member) => member.status === "ACTIVE");
  const activeCount = activeMembers.length;

  // --- Shared totals ------------------------------------------------------
  const totalMeals = sumBy(meals, mealUnits);

  const bazarExpenses = expenses.filter((expense) => expense.category === "BAZAR");
  const otherExpenses = expenses.filter((expense) => expense.category !== "BAZAR");
  const bazarTotal = sumBy(bazarExpenses, (expense) => expense.amount);
  const otherSharedTotal = sumBy(otherExpenses, (expense) => expense.amount);

  // One shared rate for everyone, rounded once so the number a member sees on
  // the report is the number their own cost was computed from.
  const mealRate = totalMeals > 0 ? round2(bazarTotal / totalMeals) : 0;

  const seatRentTotal = sumBy(activeMembers, (member) => member.rent ?? 0);

  const utilityItems = [
    { key: "water", label: "Water", amount: bill.water ?? 0 },
    { key: "electricity", label: "Electricity", amount: bill.electricity ?? 0 },
    { key: "gas", label: "Gas", amount: bill.gas ?? 0 },
    { key: "wifi", label: "Internet", amount: bill.wifi ?? 0 },
    { key: "other", label: "Other utilities", amount: bill.other ?? 0 },
    ...customBills.map((item) => ({
      key: item.id,
      label: item.title,
      amount: item.amount ?? 0,
    })),
  ];
  const utilityTotal = sumBy(utilityItems, (item) => item.amount);

  // Split evenly; no active members means nobody pays these heads.
  const utilityShare = activeCount > 0 ? round2(utilityTotal / activeCount) : 0;
  const otherSharedShare = activeCount > 0 ? round2(otherSharedTotal / activeCount) : 0;

  // --- Per-member rows ----------------------------------------------------
  const mealsByMember = new Map();
  for (const meal of meals) {
    const existing = mealsByMember.get(meal.memberId);
    mealsByMember.set(
      meal.memberId,
      existing
        ? {
            breakfast: existing.breakfast + meal.breakfast,
            lunch: existing.lunch + meal.lunch,
            dinner: existing.dinner + meal.dinner,
          }
        : { breakfast: meal.breakfast, lunch: meal.lunch, dinner: meal.dinner },
    );
  }

  const paymentsByMember = new Map(
    payments.map((payment) => [payment.memberId, payment]),
  );

  const rows = members.map((member) => {
    const breakdown = breakdownOf(mealsByMember.get(member.id));
    const isActive = member.status === "ACTIVE";

    const mealCost = round2(breakdown.total * mealRate);
    const rent = isActive ? round2(member.rent ?? 0) : 0;
    const utilities = isActive ? utilityShare : 0;
    const otherShare = isActive ? otherSharedShare : 0;

    const totalBill = round2(mealCost + rent + utilities + otherShare);

    const payment = paymentsByMember.get(member.id);
    const paid = {
      rent: round2(payment?.rentPaid ?? 0),
      meals: round2(payment?.mealPaid ?? 0),
      utilities: round2(payment?.utilityPaid ?? 0),
    };
    const paidTotal = round2(paid.rent + paid.meals + paid.utilities);

    return {
      member,
      isActive,
      meals: breakdown,
      mealCost,
      rent,
      utilities,
      otherShare,
      totalBill,
      paid,
      paidTotal,
      // Positive => member owes the mess. Negative => the mess owes them.
      balance: round2(totalBill - paidTotal),
    };
  });

  // --- Totals + reconciliation -------------------------------------------
  const rowsTotalBill = sumBy(rows, (row) => row.totalBill);
  const rowsPaidTotal = sumBy(rows, (row) => row.paidTotal);

  const expenseTotal = round2(bazarTotal + otherSharedTotal);
  const grandTotal = round2(mealRate * totalMeals + seatRentTotal + utilityTotal + otherSharedTotal);

  const totalCollected = round2(utilityTotal + bazarTotal + seatRentTotal + otherSharedTotal);

  return {
    month,
    hasData: members.length > 0 || expenses.length > 0 || utilityTotal > 0,

    totals: {
      members: members.length,
      activeMembers: activeCount,
      inactiveMembers: members.length - activeCount,

      totalMeals,
      mealRate,
      bazarTotal,
      otherSharedTotal,
      expenseTotal,
      utilityTotal,
      seatRentTotal,
      utilityItems: utilityItems.map((item) => ({ ...item, amount: round2(item.amount) })),

      /** Everything the mess is owed for the month. */
      grandTotal,
      /** Everything actually collected (sum of recorded payments). */
      totalCollected: rowsPaidTotal,
      /** Alias kept explicit so the dashboard reads clearly. */
      paidTotal: rowsPaidTotal,
      /** Owed by members whose balance is positive. */
      outstanding: round2(sumBy(rows.filter((r) => r.balance > 0), (r) => r.balance)),
      /** Owed back to members who overpaid. */
      change: round2(sumBy(rows.filter((r) => r.balance < 0), (r) => Math.abs(r.balance))),
    },

    rows,

    /** Per-column drift caused by rounding each row independently. */
    roundingAdjustment: round2(grandTotal - rowsTotalBill),
  };
}

/** Members ordered for the report: active first, then by name. */
export function sortRowsForReport(rows) {
  return [...rows].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.member.name.localeCompare(b.member.name);
  });
}
