import {
  currentMonthKey,
  isMonthKey,
  monthLabelWithYear,
} from "@/lib/date";
import { getSettlement } from "@/lib/data/settlement";
import { getMessProfile } from "@/lib/data/mess";
import { getCurrentUser } from "@/lib/dal";
import { sortRowsForReport } from "@/lib/settlement";
import { formatMoney, formatNumber, sumBy } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button-classes";
import { cn } from "@/lib/utils";
import { MonthNav } from "../month-nav";
import { PaymentControls, PrintButton } from "./payment-controls";
import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = { title: "Monthly report" };

export default async function ReportsPage({ searchParams }) {
  const params = await searchParams;
  const month = isMonthKey(params?.month) ? params.month : currentMonthKey();

  const [settlement, mess, user] = await Promise.all([
    getSettlement(month),
    getMessProfile(),
    getCurrentUser(),
  ]);

  const currency = mess?.currency ?? "BDT";
  const { totals } = settlement;
  const rows = sortRowsForReport(settlement.rows);
  const money = (value) => formatMoney(value, { currency });

  // Every footer cell is summed from the printed rows, not recomputed from the
  // inputs. The inputs are rounded per row, so a derived footer can end up a
  // cent away from the column it is supposed to total.
  const columnTotals = {
    meals: sumBy(rows, (row) => row.meals.total),
    mealCost: sumBy(rows, (row) => row.mealCost),
    rent: sumBy(rows, (row) => row.rent),
    utilities: sumBy(rows, (row) => row.utilities),
    other: sumBy(rows, (row) => row.otherShare),
    total: sumBy(rows, (row) => row.totalBill),
    paid: sumBy(rows, (row) => row.paidTotal),
  };

  if (settlement.rows.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Monthly report</h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">{monthLabelWithYear(month)}</p>
        </header>

        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={FileText}
              title="Nothing to report yet"
              description="Add members, log bazar spending and mark some meals. The settlement builds itself from those three things."
              action={
                <Link href="/members" className={buttonClass({ size: "sm" })}>
                  Add members
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Monthly report</h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {monthLabelWithYear(month)} · {mess?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav month={month} basePath="/reports" />
          <PrintButton />
        </div>
      </header>

      {/* Printable statement */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:px-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>{mess?.name}</CardTitle>
              <CardDescription>
                Settlement for {monthLabelWithYear(month)}
              </CardDescription>
            </div>
            <div className="text-right text-[12px] text-muted-foreground">
              <p>Prepared for {user?.name}</p>
              <p>{mess?.name}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="print:px-0">
          {/* The four heads, so nobody has to take the maths on trust. */}
          <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Head
              label="Meal rate"
              value={money(totals.mealRate)}
              note={`${formatNumber(totals.totalMeals, 1)} meals at this one rate`}
            />
            <Head
              label="Utilities"
              value={money(totals.utilityTotal)}
              note={`split across ${totals.activeMembers} active members`}
            />
            <Head
              label="Seat rent"
              value={money(totals.seatRentTotal)}
              note="each member's own rent"
            />
            <Head
              label="Other shared"
              value={money(totals.otherSharedTotal)}
              note="everything that is not bazar"
            />
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-[12.5px]">
              <caption className="sr-only">
                Per-member breakdown of meals, rent, utilities and what has been paid.
              </caption>
              <thead>
                <tr className="border-y border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <Th className="text-left">Member</Th>
                  <Th numeric>Meals</Th>
                  <Th numeric>Meal cost</Th>
                  <Th numeric>Rent</Th>
                  <Th numeric>Utilities</Th>
                  <Th numeric>Other</Th>
                  <Th numeric>Total</Th>
                  <Th numeric>Paid</Th>
                  <Th numeric>Balance</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.member.id} className="border-b border-border">
                    <td className="py-2 pr-2 font-medium">
                      <span>{row.member.name}</span>
                      {!row.isActive ? (
                        <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                          {row.member.status.toLowerCase()}
                        </span>
                      ) : null}
                    </td>
                    <Td numeric>{formatNumber(row.meals.total, 1)}</Td>
                    <Td numeric>{money(row.mealCost)}</Td>
                    <Td numeric>{row.rent > 0 ? money(row.rent) : "—"}</Td>
                    <Td numeric>{row.utilities > 0 ? money(row.utilities) : "—"}</Td>
                    <Td numeric>{row.otherShare > 0 ? money(row.otherShare) : "—"}</Td>
                    <Td numeric className="font-semibold">
                      {money(row.totalBill)}
                    </Td>
                    <Td numeric className="text-muted-foreground">
                      {money(row.paidTotal)}
                    </Td>
                    <Td
                      numeric
                      className={cn(
                        "font-semibold",
                        row.balance > 0 && "text-danger",
                        row.balance < 0 && "text-success",
                      )}
                    >
                      {row.balance === 0 ? "—" : money(row.balance)}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border text-[12.5px] font-semibold">
                  <td className="py-2">Total</td>
                  <Td numeric>{formatNumber(columnTotals.meals, 1)}</Td>
                  <Td numeric>{money(columnTotals.mealCost)}</Td>
                  <Td numeric>{money(columnTotals.rent)}</Td>
                  <Td numeric>{money(columnTotals.utilities)}</Td>
                  <Td numeric>{money(columnTotals.other)}</Td>
                  <Td numeric>{money(columnTotals.total)}</Td>
                  <Td numeric>{money(columnTotals.paid)}</Td>
                  <Td numeric className="text-danger">
                    {money(totals.outstanding)}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>

          {settlement.roundingAdjustment !== 0 ? (
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              A rounding adjustment of {money(settlement.roundingAdjustment)} has been applied so
              the column totals reconcile exactly with {money(totals.grandTotal)}.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4 text-[13px]">
            <Figure label="Total billed" value={money(totals.grandTotal)} />
            <Figure label="Collected" value={money(totals.paidTotal)} tone="success" />
            <Figure label="Outstanding" value={money(totals.outstanding)} tone="danger" />
            {totals.change > 0 ? (
              <Figure label="To refund" value={money(totals.change)} tone="warning" />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Collection controls — screen only, never printed. */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Collect payments</CardTitle>
          <CardDescription>
            Mark someone as fully paid, or record a partial payment against a single cost head.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentControls month={month} rows={rows} currency={currency} />
        </CardContent>
      </Card>

      <section aria-label="Month totals" className="no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bazar" value={money(totals.bazarTotal)} hint="drives the meal rate" />
        <StatCard label="Expenses total" value={money(totals.expenseTotal)} hint="bazar plus other" />
        <StatCard
          label="Outstanding"
          value={money(totals.outstanding)}
          hint={`${rows.filter((r) => r.balance > 0).length} members owe`}
          tone={totals.outstanding > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Collected"
          value={money(totals.paidTotal)}
          hint={`${Math.min(100, Math.round((totals.paidTotal / Math.max(totals.grandTotal, 1)) * 100))}% of the bill`}
        />
      </section>
    </div>
  );
}

function Head({ label, value, note }) {
  return (
    <div className="rounded-[var(--radius-field)] border border-border bg-surface-muted/50 p-3">
      <dt className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="nums mt-1 text-[17px] font-semibold">{value}</dd>
      <dd className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{note}</dd>
    </div>
  );
}

function Figure({ label, value, tone = "default" }) {
  return (
    <div>
      <p className="text-[11.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "nums mt-0.5 text-[15px] font-semibold",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Th({ children, className, numeric }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-2 py-2 font-semibold first:pl-0 last:pr-0",
        numeric ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, numeric, className }) {
  return (
    <td className={cn("nums px-2 py-2 first:pl-0 last:pr-0", numeric && "text-right", className)}>
      {children}
    </td>
  );
}
