import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const updateCustomBillSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").optional(),
  amount: z.number().positive("Amount must be a positive number").optional(),
  notes: z.string().optional().nullable(),
});

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateCustomBillSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const updatedCustomBill = await db.customBill.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(updatedCustomBill);
  } catch (error) {
    console.error("[CUSTOM_BILL_PUT]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await db.customBill.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Custom bill deleted successfully" });
  } catch (error) {
    console.error("[CUSTOM_BILL_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
