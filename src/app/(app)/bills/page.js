import { currentMonthKey, isMonthKey, monthLabel, shiftMonth, monthLabelWithYear } from "@/lib/date";
import { getBills } from "@/lib/data/bills";
import { getSettlement } from "@/lib/data/settlement";
import { getCurrency } from "@/lib/data/mess";
import { formatMoney, round2 } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MonthNav } from "../month-nav";
import { CustomBills, UtilityBillForm } from "./bill-forms";

export const metadata = { title: "Bills" };

export default async function BillsPage({ searchParams }) {
  const params = await searchParams;
  const month = isMonthKey(params?.month) ? params.month : currentMonthKey();

  const [bills, settlement, currency] = await Promise.all([
    getBills(month),
    getSettlement(month),
    getCurrency(),
  ]);

  const activeMembers = settlement.totals.activeMembers;
  const perMember = activeMembers > 0 ? round2(bills.grandTotal / activeMembers) : 0;
  const previousMonth = shiftMonth(month, -1);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bills</h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {monthLabel(month, { short: false })} · fixed charges, split evenly between active
            members
          </p>
        </div>
        <MonthNav month={month} basePath="/bills" />
      </header>

      <section aria-label="Bill summary" className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Utilities" value={formatMoney(bills.fixedTotal, { currency })} hint="water, power, gas, internet" />
        <StatCard label="Extra charges" value={formatMoney(bills.customTotal, { currency })} hint={`${bills.customBills.length} added`} />
        <StatCard
          label="Per active member"
          value={formatMoney(perMember, { currency })}
          hint={
            activeMembers > 0
              ? `${activeMembers} active ${activeMembers === 1 ? "member" : "members"}`
              : "Add active members to split this"
          }
          tone="primary"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Utility bill</CardTitle>
          <CardDescription>
            The regular monthly charges. Enter 0 for anything that did not apply this month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UtilityBillForm month={month} bill={bills.bill} currency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extra charges</CardTitle>
          <CardDescription>
            Anything one-off that should still be shared evenly — a cook&rsquo;s salary, deep
            cleaning, a replacement cylinder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomBills month={month} customBills={bills.customBills} currency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How this month compares</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
            <div>
              <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
                {monthLabelWithYear(previousMonth)}
              </p>
              <p className="nums mt-0.5 text-lg font-semibold">
                {formatMoney(bills.previousTotal, { currency })}
              </p>
            </div>

            <div>
              <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">
                {monthLabelWithYear(month)}
              </p>
              <p className="nums mt-0.5 text-lg font-semibold">
                {formatMoney(bills.fixedTotal, { currency })}
              </p>
            </div>

            {bills.previousTotal > 0 ? (
              <Badge tone={bills.delta > 0 ? "warning" : "success"} className="mt-3">
                {bills.delta > 0 ? "up" : "down"}{" "}
                {formatMoney(Math.abs(round2((bills.delta / bills.previousTotal) * 100)), {
                  currency,
                  withSymbol: false,
                })}
                % vs last month
              </Badge>
            ) : (
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                No figure recorded for {monthLabelWithYear(previousMonth)} to compare against.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className={cn("text-[12.5px] text-muted-foreground")}>
        Bills are charged to active members only. Archived members keep their history but are not
        billed.
      </p>
    </div>
  );
}
