import Link from "next/link";
import { getMealGrid } from "@/lib/data/meals";
import { getSettlement } from "@/lib/data/settlement";
import { getCurrency } from "@/lib/data/mess";
import { listExpenses } from "@/lib/data/expenses";
import {
  currentMonthKey,
  isMonthKey,
  monthLabel,
  toDateInputValue,
  todayUtcMidnight,
} from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button-classes";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, NON_SHARED_EQUALLY } from "@/lib/constants";
import { MonthNav } from "../month-nav";
import { ExpensesManager } from "./expenses-manager";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }) {
  const params = await searchParams;
  const month = isMonthKey(params?.month) ? params.month : currentMonthKey();

  const category =
    typeof params?.category === "string" && params.category !== "ALL" ? params.category : "ALL";
  const query = typeof params?.q === "string" ? params.q.trim().slice(0, 60) : "";

  // One read for the page: the filtered list plus the whole-month totals.
  const [{ expenses, summary }, settlement, currency] = await Promise.all([
    listExpenses({ month, category, query }),
    getSettlement(month),
    getCurrency(),
  ]);

  const activeMembers = settlement.totals.activeMembers;
  const evenShare = activeMembers > 0 ? summary.other / activeMembers : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {monthLabel(month, { short: false })} · {summary.count}{" "}
            {summary.count === 1 ? "entry" : "entries"}
          </p>
        </div>
        <MonthNav month={month} basePath="/expenses" />
      </header>

      <section aria-label="Spending summary" className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Bazar"
          value={formatMoney(summary.bazar, { currency })}
          hint="Sets the meal rate"
        />
        <StatCard
          label="Other shared"
          value={formatMoney(summary.other, { currency })}
          hint={
            activeMembers > 0
              ? `${formatMoney(evenShare, { currency })} per active member`
              : "Add active members to split this"
          }
        />
        <StatCard
          label="Total"
          value={formatMoney(summary.total, { currency })}
          hint="bazar plus shared costs"
        />
      </section>

      {summary.byCategory.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Where it went</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {summary.byCategory
                .slice()
                .sort((a, b) => b.amount - a.amount)
                .map((row) => (
                  <li key={row.category} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="flex items-center gap-2 font-medium">
                        {EXPENSE_CATEGORY_LABELS[row.category] ?? row.category}
                        {row.category === NON_SHARED_EQUALLY ? (
                          <span className="rounded-full bg-primary-subtle px-1.5 py-0.5 text-[10.5px] font-medium text-primary">
                            meal rate
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                            split evenly
                          </span>
                        )}
                      </span>
                      <span className="nums shrink-0 text-muted-foreground">
                        {formatMoney(row.amount, { currency })}
                        <span className="ml-1.5 text-[11.5px]">{Math.round(row.share)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          row.category === NON_SHARED_EQUALLY ? "bg-primary" : "bg-muted-foreground/35",
                        )}
                        style={{ width: `${Math.max(1.5, row.share)}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <nav aria-label="Filter by category" className="flex flex-wrap gap-1.5">
              <CategoryLink month={month} category="ALL" active={category === "ALL"} query={query}>
                All
              </CategoryLink>
              {EXPENSE_CATEGORIES.map((value) => (
                <CategoryLink
                  key={value}
                  month={month}
                  category={value}
                  active={category === value}
                  query={query}
                >
                  {EXPENSE_CATEGORY_LABELS[value]}
                </CategoryLink>
              ))}
            </nav>

            <ExpensesManager
              expenses={expenses}
              currency={currency}
              defaultDate={toDateInputValue(todayUtcMidnight())}
              initialCategory={category}
              query={query}
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-[12.5px] text-muted-foreground">
        Utility charges are not expenses —{" "}
        <Link href="/bills" className="font-medium text-primary hover:underline">
          add them on the Bills page
        </Link>{" "}
        so they are shared evenly rather than treated as bazar.
      </p>
    </div>
  );
}

function CategoryLink({ month, category, active, query, children }) {
  const search = new URLSearchParams();
  if (month !== currentMonthKey()) search.set("month", month);
  if (category !== "ALL") search.set("category", category);
  if (query) search.set("q", query);
  const suffix = search.toString();

  return (
    <Link
      href={`/expenses${suffix ? `?${suffix}` : ""}`}
      aria-current={active ? "true" : undefined}
      className={buttonClass({
        variant: active ? "secondary" : "ghost",
        size: "sm",
      })}
    >
      {children}
    </Link>
  );
}
