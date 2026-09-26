import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const updateExpenseSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }).optional(),
  category: z.enum(["BAZAR", "CLEANING", "FURNITURE", "MAINTENANCE", "KITCHEN", "GAS_CYLINDER", "OTHER"]).optional(),
  description: z.string().min(2, "Description must be at least 2 characters").optional(),
  amount: z.number().positive("Amount must be a positive number").optional(),
  notes: z.string().optional().nullable(),
});

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateExpenseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const updateData = { ...validation.data };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const updatedExpense = await db.expense.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error("[EXPENSE_PUT]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await db.expense.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("[EXPENSE_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
