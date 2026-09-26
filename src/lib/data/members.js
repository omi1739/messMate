import { cache } from "react";
import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";

/** Every member in the mess, active first then alphabetical. */
export const listMembers = cache(async () => {
  const messId = await requireMessId();
  return db.member.findMany({
    where: { messId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
});

/**
 * Looks a member up *within the caller's mess*. Returning null for another
 * tenant's id is deliberate — a 404-shaped answer rather than someone else's
 * record leaking through a guessed id.
 */
export const findMember = cache(async (memberId) => {
  const messId = await requireMessId();
  if (!memberId) return null;
  return db.member.findFirst({ where: { id: memberId, messId } });
});

/** Lightweight list for pickers. */
export const listActiveMembers = cache(async () => {
  const messId = await requireMessId();
  return db.member.findMany({
    where: { messId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, rent: true, phone: true },
  });
});
