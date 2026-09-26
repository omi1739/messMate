import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const createExpenseSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  category: z.enum(["BAZAR", "CLEANING", "FURNITURE", "MAINTENANCE", "KITCHEN", "GAS_CYLINDER", "OTHER"]),
  description: z.string().min(2, "Description must be at least 2 characters"),
  amount: z.number().positive("Amount must be a positive number"),
  notes: z.string().optional().nullable(),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Format: YYYY-MM

    let whereClause = {};

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split("-").map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 1));
      
      whereClause = {
        date: {
          gte: startDate,
          lt: endDate,
        },
      };
    }

    const expenses = await db.expense.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("[EXPENSES_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = createExpenseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const { date, category, description, amount, notes } = validation.data;

    const newExpense = await db.expense.create({
      data: {
        date: new Date(date),
        category,
        description,
        amount,
        notes,
      },
    });

    return NextResponse.json(newExpense, { status: 201 });
  } catch (error) {
    console.error("[EXPENSES_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
