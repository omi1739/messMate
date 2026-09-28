import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Coins,
  Receipt,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getCurrency } from "@/lib/data/mess";
import { currentMonthKey, isMonthKey, monthLabel, formatDateLong } from "@/lib/date";
import { formatMoney, formatMoneyCompact, formatNumber, round2 } from "@/lib/money";
import { buttonClass } from "@/components/ui/button-classes";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { MonthNav } from "../month-nav";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const month = isMonthKey(params?.month) ? params.month : currentMonthKey();

  const [stats, currency] = await Promise.all([getDashboardStats(month), getCurrency()]);
  const { settlement, trend, recentExpenses, today, collectionRate, setup } = stats;
  const { totals } = settlement;

  const money = (value) => formatMoney(value, { currency });
  const isFresh = !setup.hasMembers || !setup.hasExpenses;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {monthLabel(month, { short: false })}
          </h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {isFresh
              ? "Here is where your mess stands."
              : `${formatNumber(totals.activeMembers)} active members · ${formatNumber(totals.totalMeals)} meals logged`}
          </p>
        </div>
        <MonthNav month={month} basePath="/dashboard" />
      </header>

      <nav aria-label="Common tasks" className="flex flex-wrap gap-2">
        <Link href="/meals" className={buttonClass({ size: "sm" })}>
          <UtensilsCrossed className="size-3.5" aria-hidden />
          Log today&rsquo;s meals
        </Link>
        <Link href="/expenses" className={buttonClass({ variant: "secondary", size: "sm" })}>
          <Receipt className="size-3.5" aria-hidden />
          Add an expense
        </Link>
        <Link href="/members" className={buttonClass({ variant: "secondary", size: "sm" })}>
          <Users className="size-3.5" aria-hidden />
          Add a member
        </Link>
        <Link href="/bills" className={buttonClass({ variant: "secondary", size: "sm" })}>
          <Wallet className="size-3.5" aria-hidden />
          Record bills
        </Link>
      </nav>

      {isFresh ? <SetupChecklist setup={setup} /> : null}

      <section aria-label="This month at a glance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Meal rate"
          value={money(totals.mealRate)}
          hint={totals.totalMeals > 0 ? `${formatNumber(totals.totalMeals)} meals this month` : "Log meals to calculate"}
          icon={UtensilsCrossed}
        />
        <StatCard
          label="Bazar spending"
          value={money(totals.bazarTotal)}
          hint={`${money(totals.expenseTotal)} total expenses`}
          icon={Receipt}
        />
        <StatCard
          label="Collected"
          value={money(totals.paidTotal)}
          hint={`${money(totals.outstanding)} still outstanding`}
          icon={Coins}
          tone={totals.outstanding > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Total billed"
          value={money(totals.grandTotal)}
          hint={`${collectionRate}% collected`}
          icon={Wallet}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Today&rsquo;s meals</CardTitle>
            <Link
              href="/meals"
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              Log meals <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MealTile label="Breakfast" value={today.breakfast} rate={totals.mealRate} currency={currency} />
              <MealTile label="Lunch" value={today.lunch} rate={totals.mealRate} currency={currency} />
              <MealTile label="Dinner" value={today.dinner} rate={totals.mealRate} currency={currency} />
              <MealTile label="Total" value={today.total} rate={totals.mealRate} currency={currency} emphasis />
            </div>
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              {today.eaters > 0
                ? `${formatNumber(today.eaters)} ${today.eaters === 1 ? "person has" : "people have"} eaten today.`
                : "Nothing logged for today yet."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last 3 months</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendBars trend={trend} currency={currency} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Who owes what</CardTitle>
            <Link href="/reports" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Full report <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {settlement.rows.length === 0 ? (
              <EmptyState
                className="px-6"
                icon={Users}
                title="No members yet"
                description="Add your members and their seat rent, then the monthly settlement builds itself."
                action={
                  <Link href="/members" className={buttonClass({ size: "sm" })}>
                    Add members
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-left text-[13px]">
                  <thead className="border-y border-border bg-surface-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-semibold">Member</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Meals</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Billed</th>
                      <th scope="col" className="px-2 py-2 text-right font-semibold">Paid</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {settlement.rows.slice(0, 6).map((row) => (
                      <tr key={row.member.id}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{row.member.name}</span>
                          {!row.isActive ? (
                            <Badge tone="neutral" className="ml-2">
                              {row.member.status.toLowerCase()}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="nums px-2 py-2.5 text-right">{formatNumber(row.meals.total, 1)}</td>
                        <td className="nums px-2 py-2.5 text-right">{money(row.totalBill)}</td>
                        <td className="nums px-2 py-2.5 text-right text-muted-foreground">{money(row.paidTotal)}</td>
                        <td
                          className={cn(
                            "nums px-4 py-2.5 text-right font-medium",
                            row.balance > 0 && "text-danger",
                            row.balance < 0 && "text-success",
                            row.balance === 0 && "text-muted-foreground",
                          )}
                        >
                          {row.balance === 0 ? "settled" : money(Math.abs(row.balance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Recent spending</CardTitle>
            <Link href="/expenses" className={buttonClass({ variant: "ghost", size: "sm" })}>
              All <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            {recentExpenses.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No expenses yet"
                description="Log your first bazar run to start the month."
                action={
                  <Link href="/expenses" className={buttonClass({ size: "sm" })}>
                    Add expense
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {recentExpenses.map((expense) => (
                  <li key={expense.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{expense.description}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {expense.category.toLowerCase().replace(/_/g, " ")} · {formatDateLong(expense.date)}
                      </p>
                    </div>
                    <span className="nums shrink-0 text-[13px] font-semibold">
                      {money(expense.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MealTile({ label, value, rate, currency, emphasis = false }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-field)] border border-border p-3",
        emphasis ? "bg-primary-subtle" : "bg-surface",
      )}
    >
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="nums mt-1 text-lg font-semibold">{formatNumber(value, 1)}</p>
      <p className="nums text-[11px] text-muted-foreground">
        {rate > 0
          ? `${formatMoney(round2(value * rate), { currency })} at today's rate`
          : "meals logged"}
      </p>
    </div>
  );
}

function TrendBars({ trend, currency }) {
  const peak = Math.max(...trend.map((point) => Math.max(point.spent, point.collected)), 1);

  return (
    <div className="space-y-3.5">
      {trend.map((point) => (
        <div key={point.month} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-medium">{monthLabel(point.month, { short: true })}</span>
            <span className="nums text-[11.5px] text-muted-foreground">
              {formatMoneyCompact(point.collected, { currency })} of {formatMoneyCompact(point.spent, { currency })}
            </span>
          </div>
          <div className="space-y-1">
            <Bar value={point.collected} peak={peak} className="bg-success" />
            <Bar value={point.spent} peak={peak} className="bg-muted-foreground/35" />
          </div>
        </div>
      ))}
      <p className="flex items-center gap-3 pt-1 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" aria-hidden /> collected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/35" aria-hidden /> spent
        </span>
      </p>
    </div>
  );
}

function Bar({ value, peak, className }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
      <div
        className={cn("h-full rounded-full transition-[width]", className)}
        style={{ width: `${Math.max(2, Math.round((value / peak) * 100))}%` }}
      />
    </div>
  );
}

const CHECKLIST = [
  { key: "hasMembers", href: "/members", title: "Add your members", body: "Names, phone numbers and each person's seat rent." },
  { key: "hasExpenses", href: "/expenses", title: "Log your bazar spending", body: "This is what sets the meal rate." },
  { key: "hasMeals", href: "/meals", title: "Mark daily meals", body: "Breakfast, lunch and dinner per person." },
  { key: "hasBills", href: "/bills", title: "Add utility bills", body: "Water, electricity, gas, internet and any extras." },
];

function SetupChecklist({ setup }) {
  const remaining = CHECKLIST.filter((item) => !setup[item.key]);
  if (remaining.length === 0) return null;

  return (
    <Card className="border-primary-border bg-primary-subtle/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" aria-hidden />
          Finish setting up
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CHECKLIST.map((item) => {
            const done = setup[item.key];
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-start gap-2.5 rounded-[var(--radius-field)] border p-3 transition-colors",
                    done
                      ? "border-border bg-surface/60 opacity-70"
                      : "border-primary-border bg-surface hover:border-primary/40",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="mt-px size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <Circle className="mt-px size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span className={cn("block text-[13px] font-semibold", done && "line-through")}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                      {done ? "Done" : item.body}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {remaining.length > 0 ? (
          <p className="mt-3 text-[12px] text-muted-foreground">
            {remaining.length} {remaining.length === 1 ? "step" : "steps"} left before the
            settlement means anything.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
