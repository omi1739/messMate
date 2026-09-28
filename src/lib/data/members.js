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

