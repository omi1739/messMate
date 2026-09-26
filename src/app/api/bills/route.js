import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const saveBillSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month format. Use YYYY-MM"),
  water: z.number().min(0, "Water must be a positive number"),
  electricity: z.number().min(0, "Electricity must be a positive number"),
  gas: z.number().min(0, "Gas must be a positive number"),
  wifi: z.number().min(0, "WiFi must be a positive number"),
  other: z.number().min(0, "Other bills must be a positive number"),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Expected format: YYYY-MM

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: "Month parameter is required (format: YYYY-MM)" }, { status: 400 });
    }

    // Attempt to find the bill record
    let bill = await db.bill.findUnique({
      where: { month: monthParam },
    });

    // If it doesn't exist, we send back a blank default object to keep the UI simple
    if (!bill) {
      bill = {
        month: monthParam,
        water: 0,
        electricity: 0,
        gas: 0,
        wifi: 0,
        other: 0,
      };
    }

    return NextResponse.json(bill);
  } catch (error) {
    console.error("[BILLS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = saveBillSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const { month, water, electricity, gas, wifi, other } = validation.data;

    const upsertedBill = await db.bill.upsert({
      where: { month },
      update: {
        water,
        electricity,
        gas,
        wifi,
        other,
      },
      create: {
        month,
        water,
        electricity,
        gas,
        wifi,
        other,
      },
    });

    return NextResponse.json(upsertedBill);
  } catch (error) {
    console.error("[BILLS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
