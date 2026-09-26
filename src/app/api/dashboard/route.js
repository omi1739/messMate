import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    
    const [year, month] = currentMonthStr.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    // 1. Total Members
    const totalMembers = await db.member.count({
      where: { status: { in: ["ACTIVE", "INACTIVE"] } },
    });

    // 2. Today's Meals
    const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const todayMeals = await db.meal.findMany({
      where: { date: todayUtc },
    });
    const todayMealsCount = todayMeals.reduce((sum, m) => sum + m.breakfast + m.lunch + m.dinner, 0);

    // 3. Month Expenses & Bazar
    const expenses = await db.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });
    const totalBazar = expenses.filter(e => e.category === "BAZAR").reduce((sum, e) => sum + e.amount, 0);
    const totalOtherExpenses = expenses.filter(e => e.category !== "BAZAR").reduce((sum, e) => sum + e.amount, 0);

    // 4. Month Meals (for Meal Rate calculation)
    const monthMeals = await db.meal.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });
    const totalMonthMealsCount = monthMeals.reduce((sum, m) => sum + m.breakfast + m.lunch + m.dinner, 0);
    const mealRate = totalMonthMealsCount > 0 ? totalBazar / totalMonthMealsCount : 0;

    // 5. Month Bills
    const bill = await db.bill.findUnique({
      where: { month: currentMonthStr },
    });
    const activeMembers = await db.member.findMany({
      where: { status: "ACTIVE" }
    });
    const rent = activeMembers.reduce((sum, m) => sum + (m.rent || 0), 0);
    const utilities = bill ? (bill.water + bill.electricity + bill.gas + bill.wifi + bill.other) : 0;

    // 6. Recent Activities (Last 5 logged expenses)
    const recentExpenses = await db.expense.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    const totalMonthlyExpense = totalBazar + totalOtherExpenses + rent + utilities;

    return NextResponse.json({
      totalMembers,
      todayMealsCount,
      mealRate,
      totalBazar,
      rent,
      utilities,
      totalMonthlyExpense,
      recentExpenses,
    });
  } catch (error) {
    console.error("[DASHBOARD_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
