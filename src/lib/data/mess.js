import { cache } from "react";
import { db } from "@/lib/db";
import { requireMessId } from "@/lib/dal";

/** Name + currency for the signed-in mess. */
export const getMessProfile = cache(async () => {
  const messId = await requireMessId();
  return db.mess.findUnique({
    where: { id: messId },
    select: { id: true, name: true, currency: true, createdAt: true },
  });
});

export const getCurrency = cache(async () => {
  const mess = await getMessProfile();
  return mess?.currency ?? "BDT";
});
