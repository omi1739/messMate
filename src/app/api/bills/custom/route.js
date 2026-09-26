import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const createCustomBillSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format. Use YYYY-MM"),
  title: z.string().min(2, "Title must be at least 2 characters"),
  amount: z.number().positive("Amount must be a positive number"),
  notes: z.string().optional().nullable(),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Expected format: YYYY-MM

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: "Month parameter is required (format: YYYY-MM)" }, { status: 400 });
    }

    const customBills = await db.customBill.findMany({
      where: { month: monthParam },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(customBills);
  } catch (error) {
    console.error("[CUSTOM_BILLS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = createCustomBillSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const { month, title, amount, notes } = validation.data;

    const customBill = await db.customBill.create({
      data: {
        month,
        title,
        amount,
        notes: notes || null,
      },
    });

    return NextResponse.json(customBill, { status: 201 });
  } catch (error) {
    console.error("[CUSTOM_BILLS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
