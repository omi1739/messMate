import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const email = "e2e-probe@test.local";
const password = "Probe12345";

await db.user.deleteMany({ where: { email } });

const user = await db.user.create({
  data: {
    name: "E2E Probe",
    email,
    passwordHash: await bcrypt.hash(password, 12),
    mess: { create: { name: "Probe Mess" } },
  },
  select: { id: true, mess: { select: { id: true, name: true } } },
});

// A second mess, to prove isolation.
const other = await db.user.create({
  data: {
    name: "Other Owner",
    email: "e2e-other@test.local",
    passwordHash: await bcrypt.hash(password, 12),
    mess: { create: { name: "Other Mess" } },
  },
  select: { id: true, mess: { select: { id: true, name: true } } },
});

console.log(JSON.stringify({ user, other, password }, null, 2));

await db.$disconnect();
