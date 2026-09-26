import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Format: YYYY-MM

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: "Month parameter is required (format: YYYY-MM)" }, { status: 400 });
    }

    const [year, month] = monthParam.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    // 1. Fetch all members
    const members = await db.member.findMany();
    
    // Count active members in the current month (or registered members with status ACTIVE)
    const activeMembers = members.filter(m => m.status === "ACTIVE");
    const activeCount = activeMembers.length;

    // 2. Fetch all meals in this month
    const meals = await db.meal.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    // 3. Fetch all expenses in this month
    const expenses = await db.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    // 4. Fetch the bills recorded for this month
    let bill = await db.bill.findUnique({
      where: { month: monthParam },
    });

    if (!bill) {
      bill = {
        rent: 0,
        water: 0,
        electricity: 0,
        gas: 0,
        wifi: 0,
        other: 0,
      };
    }

    // 4b. Fetch custom bills recorded for this month
    const customBills = await db.customBill.findMany({
      where: { month: monthParam },
      orderBy: { createdAt: "asc" },
    });

    // Fetch payments for this month
    const payments = await db.payment.findMany({
      where: { month: monthParam },
    });

    // 5. Calculations
    // Calculate total meals logged across all members
    const totalMeals = meals.reduce((sum, m) => sum + m.breakfast + m.lunch + m.dinner, 0);

    // Calculate total Bazar/Food expenses
    const totalBazarExpense = expenses
      .filter((e) => e.category === "BAZAR")
      .reduce((sum, e) => sum + e.amount, 0);

    // Calculate other non-bazar shared expenses that might need to be split
    // (Bazar is calculated in meal rate; categories like Furniture/Maintenance/Cleaning/Kitchen/Other 
    // logged in expense ledger are split equally as extra shared costs).
    const otherSharedExpense = expenses
      .filter((e) => e.category !== "BAZAR")
      .reduce((sum, e) => sum + e.amount, 0);

    // Calculate Meal Rate
    const mealRate = totalMeals > 0 ? totalBazarExpense / totalMeals : 0;

    // Split bills among active members
    const totalRent = activeMembers.reduce((sum, m) => sum + (m.rent || 0), 0);
    const customBillsTotal = customBills.reduce((sum, c) => sum + c.amount, 0);
    const utilityBillsTotal = bill.water + bill.electricity + bill.gas + bill.wifi + bill.other + customBillsTotal;
    const utilityShare = activeCount > 0 ? utilityBillsTotal / activeCount : 0;
    const otherSharedShare = activeCount > 0 ? otherSharedExpense / activeCount : 0;

    // Map members to their individual bills
    const memberBreakdowns = members.map((member) => {
      // Find all meal records for this member in the current month
      const memberMeals = meals.filter((m) => m.memberId === member.id);
      const breakfastCount = memberMeals.reduce((sum, m) => sum + m.breakfast, 0);
      const lunchCount = memberMeals.reduce((sum, m) => sum + m.lunch, 0);
      const dinnerCount = memberMeals.reduce((sum, m) => sum + m.dinner, 0);
      const totalMemberMeals = breakfastCount + lunchCount + dinnerCount;

      const mealCost = totalMemberMeals * mealRate;
      
      // Inactive/Archived members do not pay rent or utility splits, only active ones do
      const memberRent = member.status === "ACTIVE" ? (member.rent || 0) : 0;
      const memberUtility = member.status === "ACTIVE" ? utilityShare : 0;
      const memberOtherShared = member.status === "ACTIVE" ? otherSharedShare : 0;

      const totalBill = mealCost + memberRent + memberUtility + memberOtherShared;

      const memberPayment = payments.find((p) => p.memberId === member.id);
      const rentPaid = memberPayment ? (memberPayment.rentPaid || 0) : 0;
      const mealPaid = memberPayment ? (memberPayment.mealPaid || 0) : 0;
      const utilityPaid = memberPayment ? (memberPayment.utilityPaid || 0) : 0;
      const paidAmount = rentPaid + mealPaid + utilityPaid;
      const remainingDue = totalBill - paidAmount;

      return {
        id: member.id,
        name: member.name,
        phone: member.phone,
        status: member.status,
        mealsCount: {
          breakfast: breakfastCount,
          lunch: lunchCount,
          dinner: dinnerCount,
          total: totalMemberMeals,
        },
        costs: {
          mealCost,
          rentShare: memberRent,
          utilityShare: memberUtility,
          otherSharedShare: memberOtherShared,
          totalBill,
          paidAmount,
          remainingDue,
          rentPaid,
          mealPaid,
          utilityPaid,
        },
      };
    });

    return NextResponse.json({
      summary: {
        month: monthParam,
        totalMembersCount: members.length,
        activeMembersCount: activeCount,
        totalMeals,
        totalBazarExpense,
        otherSharedExpense,
        mealRate,
        bills: {
          rent: totalRent,
          utilities: utilityBillsTotal,
          individualUtilityShare: utilityShare,
          otherSharedShare,
          customBills,
          customBillsTotal,
        },
        totalMessExpense: totalBazarExpense + otherSharedExpense + totalRent + utilityBillsTotal,
      },
      memberBreakdowns,
    });
  } catch (error) {
    console.error("[REPORTS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
