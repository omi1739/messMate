import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { deleteUserCascade } from "@/lib/cascade";

const db = new PrismaClient();

const email = "e2e-probe@test.local";
const otherEmail = "e2e-other@test.local";
const password = "Probe12345";

/**
 * Creates the two throwaway tenants the HTTP checks sign in as: the main probe
 * (which seed-demo.mjs then fills) and a second one with no data, used to prove
 * an owner cannot see anything that is not theirs.
 *
 * Safe to re-run: each account and its whole mess are removed first, so no
 * orphaned rows are left behind.
 */
for (const stale of [email, otherEmail]) {
  const existing = await db.user.findUnique({ where: { email: stale }, select: { id: true } });
  if (existing) await deleteUserCascade(db, existing.id);
}

const passwordHash = await bcrypt.hash(password, 12);

const user = await db.user.create({
  data: {
    name: "E2E Probe",
    email,
    passwordHash,
    mess: { create: { name: "Probe Mess" } },
  },
  select: { id: true, mess: { select: { id: true, name: true } } },
});

// A second mess, to prove isolation.
const other = await db.user.create({
  data: {
    name: "Other Owner",
    email: otherEmail,
    passwordHash,
    mess: { create: { name: "Other Mess" } },
  },
  select: { id: true, mess: { select: { id: true, name: true } } },
});

console.log(JSON.stringify({ user, other, password }, null, 2));

await db.$disconnect();
