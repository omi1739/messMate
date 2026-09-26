import { cache } from "react";
import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";
import { currentMonthKey, isMonthKey, shiftMonth } from "@/lib/date";
import { EMPTY_BILL } from "@/lib/settlement";
import { sumBy } from "@/lib/money";

/** Utility bill + custom charges for a month. */
export const getBills = cache(async (requestedMonth) => {
  const messId = await requireMessId();
  const month = isMonthKey(requestedMonth) ? requestedMonth : currentMonthKey();

  const [bill, customBills, previous] = await Promise.all([
    db.bill.findUnique({ where: { messId_month: { messId, month } } }),
    db.customBill.findMany({ where: { messId, month }, orderBy: { createdAt: "asc" } }),
    db.bill.findUnique({ where: { messId_month: { messId, month: shiftMonth(month, -1) } } }),
  ]);

  const current = bill ?? EMPTY_BILL;
  const previousBill = previous ?? EMPTY_BILL;

  const fixedTotal = sumBy(
    [
      current.water,
      current.electricity,
      current.gas,
      current.wifi,
      current.other,
    ],
    (value) => value,
  );
  const customTotal = sumBy(customBills, (item) => item.amount);
  const previousTotal = sumBy(
    [
      previousBill.water,
      previousBill.electricity,
      previousBill.gas,
      previousBill.wifi,
      previousBill.other,
    ],
    (value) => value,
  );

  return {
    month,
    bill: current,
    customBills,
    hasBill: Boolean(bill),
    fixedTotal,
    customTotal,
    grandTotal: fixedTotal + customTotal,
    previousTotal,
    delta: fixedTotal - previousTotal,
  };
});
