import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const saveMealSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  memberId: z.string(),
  breakfast: z.number().min(0).max(5),
  lunch: z.number().min(0).max(5),
  dinner: z.number().min(0).max(5),
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month"); // Expected format: YYYY-MM

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: "Month parameter is required (format: YYYY-MM)" }, { status: 400 });
    }

    const [year, month] = monthParam.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1)); // Start of next month

    const meals = await db.meal.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    return NextResponse.json(meals);
  } catch (error) {
    console.error("[MEALS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = saveMealSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const { date, memberId, breakfast, lunch, dinner } = validation.data;
    const parsedDate = new Date(date);
    
    // Normalize date to UTC midnight to avoid local timezone offsets
    const utcDate = new Date(Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    ));

    // Upsert meal log using date + memberId unique index
    const upsertedMeal = await db.meal.upsert({
      where: {
        date_memberId: {
          date: utcDate,
          memberId,
        },
      },
      update: {
        breakfast,
        lunch,
        dinner,
      },
      create: {
        date: utcDate,
        memberId,
        breakfast,
        lunch,
        dinner,
      },
    });

    return NextResponse.json(upsertedMeal);
  } catch (error) {
    console.error("[MEALS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
