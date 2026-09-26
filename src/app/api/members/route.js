import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const createMemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  joiningDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid joining date",
  }),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  photoUrl: z.string().optional().nullable(),
  rent: z.number().min(0, "Rent must be a positive number").default(0),
});

export async function GET() {
  try {
    const members = await db.member.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(members);
  } catch (error) {
    console.error("[MEMBERS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const validation = createMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.format() }, { status: 400 });
    }

    const { name, phone, joiningDate, status, photoUrl, rent } = validation.data;

    const newMember = await db.member.create({
      data: {
        name,
        phone,
        joiningDate: new Date(joiningDate),
        status,
        photoUrl,
        rent,
      },
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error("[MEMBERS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
