"use server";

import { db } from "@/lib/db";
import { guardAction, revalidateApp } from "@/lib/action-guard";
import { fail, fieldErrors, formString, succeed } from "@/lib/action-state";
import { messSettingsSchema } from "@/lib/validators";

export async function updateMessSettingsAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = messSettingsSchema.safeParse({
    name: formString(formData, "name"),
    currency: formString(formData, "currency"),
  });

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const { count } = await db.mess.updateMany({
    where: { id: messId },
    data: { name: parsed.data.name, currency: parsed.data.currency },
  });

  if (count === 0) return fail("Your mess could not be found.");

  revalidateApp();
  return succeed("Mess settings saved.");
}
