import { getMealGrid } from "@/lib/data/meals";
import { getSettlement } from "@/lib/data/settlement";
import { getCurrency } from "@/lib/data/mess";
import { currentMonthKey, isMonthKey, monthLabel, weekdayShort, formatDateLong } from "@/lib/date";
import { formatMoney, formatNumber } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { MonthNav } from "../month-nav";
import { MealGrid } from "./meal-grid";

export const metadata = { title: "Meals" };

export default async function MealsPage({ searchParams }) {
  const params = await searchParams;
  const month = isMonthKey(params?.month) ? params.month : currentMonthKey();

  const [grid, settlement, currency] = await Promise.all([
    getMealGrid(month),
    getSettlement(month),
    getCurrency(),
  ]);

  // `getMealGrid` hands back a Map for cheap lookups, which cannot cross the
  // server/client boundary. Flatten it once here into a plain object.
  const cells = {};
  for (const member of grid.members) {
    const row = grid.grid.get(member.id);
    if (!row) continue;
    cells[member.id] = Object.fromEntries(
      [...row.entries()].map(([dayKey, value]) => [
        dayKey,
        { b: value.breakfast, l: value.lunch, d: value.dinner },
      ]),
    );
  }

  const days = grid.days.map((day) => ({
    key: day.key,
    day: day.day,
    isToday: day.isToday,
    isFuture: day.isFuture,
    weekday: weekdayShort(day.date),
  }));

  // A day counts as logged when anybody ate. Checking a single member would
  // undercount, since members join and leave part-way through the month.
  const loggedDays = grid.days.filter(
    (day) =>
      !day.isFuture &&
      grid.members.some((member) => (cells[member.id]?.[day.key]?.total ?? 0) > 0),
  ).length;
  const elapsedDays = grid.days.filter((day) => !day.isFuture).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Meals</h1>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {monthLabel(month, { short: false })} ·{" "}
            {settlement.totals.totalMeals > 0
              ? `${formatNumber(settlement.totals.totalMeals, 1)} meals logged`
              : "nothing logged yet"}
          </p>
        </div>
        <MonthNav month={month} basePath="/meals" />
      </header>

      <section aria-label="Meal summary" className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Meal rate"
          value={formatMoney(settlement.totals.mealRate, { currency })}
          hint={
            settlement.totals.totalMeals > 0
              ? `${formatMoney(settlement.totals.bazarTotal, { currency })} bazar ÷ ${formatNumber(settlement.totals.totalMeals, 1)} meals`
              : "Add bazar spending and meals to calculate"
          }
        />
        <StatCard
          label="Total meals"
          value={formatNumber(settlement.totals.totalMeals, 1)}
          hint={`${settlement.totals.activeMembers} active members`}
        />
        <StatCard
          label="Days logged"
          value={loggedDays}
          hint={
            elapsedDays > 0
              ? `of ${elapsedDays} elapsed · ${elapsedDays - loggedDays} still blank`
              : "no days elapsed yet"
          }
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Daily log</CardTitle>
          <CardDescription>
            One row per member, one column per day. Values are meal counts and may be halves, so
            0.5 for someone who ate only dinner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MealGrid
            members={grid.members.map((member) => ({
              id: member.id,
              name: member.name,
              status: member.status,
            }))}
            days={days}
            cells={cells}
          />
        </CardContent>
      </Card>

      {grid.todayKey ? (
        <p className="text-[12.5px] text-muted-foreground">
          Today is {formatDateLong(grid.todayKey)}. Future days can be pre-filled if you already
          know the plan.
        </p>
      ) : null}
    </div>
  );
}
