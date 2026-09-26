import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const updateMemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").optional(),
  joiningDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid joining date",
  }).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  photoUrl: z.string().optional().nullable(),
  rent: z.number().min(0, "Rent must be a positive number").optional(),
});

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const updateData = { ...validation.data };
    if (updateData.joiningDate) {
      updateData.joiningDate = new Date(updateData.joiningDate);
    }

    const updatedMember = await db.member.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("[MEMBER_PUT]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Cascade delete is configured in Prisma schema for meals, 
    // but in MongoDB client cascade is emulated. Let's delete meals first, then the member.
    await db.meal.deleteMany({
      where: { memberId: id },
    });

    await db.member.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Member deleted successfully" });
  } catch (error) {
    console.error("[MEMBER_DELETE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
