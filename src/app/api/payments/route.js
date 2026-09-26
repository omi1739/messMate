import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const saveBatchPaymentsSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format. Use YYYY-MM"),
  payments: z.array(
    z.object({
      memberId: z.string(),
      rentPaid: z.number().min(0, "Rent payment must be positive"),
      mealPaid: z.number().min(0, "Meal payment must be positive"),
      utilityPaid: z.number().min(0, "Utility payment must be positive"),
    })
  ),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Format: YYYY-MM

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: "Month parameter is required (format: YYYY-MM)" }, { status: 400 });
    }

    const payments = await db.payment.findMany({
      where: { month: monthParam },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("[PAYMENTS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = saveBatchPaymentsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const { month, payments } = validation.data;

    // Use Prisma transaction to upsert payments in bulk
    const upsertPromises = payments.map((pay) => 
      db.payment.upsert({
        where: {
          month_memberId: {
            month,
            memberId: pay.memberId,
          },
        },
        update: {
          rentPaid: pay.rentPaid,
          mealPaid: pay.mealPaid,
          utilityPaid: pay.utilityPaid,
        },
        create: {
          month,
          memberId: pay.memberId,
          rentPaid: pay.rentPaid,
          mealPaid: pay.mealPaid,
          utilityPaid: pay.utilityPaid,
        },
      })
    );

    await Promise.all(upsertPromises);

    return NextResponse.json({ message: "Payments saved successfully" });
  } catch (error) {
    console.error("[PAYMENTS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
