"use server";

import { db } from "@/lib/db";
import { guardAction, revalidateApp } from "@/lib/action-guard";
import { fail, fieldErrors, formString, succeed } from "@/lib/action-state";
import { paymentSchema } from "@/lib/validators";
import { round2 } from "@/lib/money";

/**
 * Record what a member has paid for a month, split across the three heads
 * (seat rent, meals, utilities). Overpayment is allowed on purpose: someone
 * paying next month's rent in advance is normal in a mess.
 */
export async function recordPaymentAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = paymentSchema.safeParse({
    month: formString(formData, "month"),
    memberId: formString(formData, "memberId"),
    rentPaid: formString(formData, "rentPaid") || 0,
    mealPaid: formString(formData, "mealPaid") || 0,
    utilityPaid: formString(formData, "utilityPaid") || 0,
  });

  if (!parsed.success) {
    return fail("Please check the amounts.", fieldErrors(parsed.error));
  }

  const { month, memberId, rentPaid, mealPaid, utilityPaid } = parsed.data;

  const member = await db.member.findFirst({
    where: { id: memberId, messId },
    select: { id: true, name: true },
  });
  if (!member) return fail("That member is not in your mess.");

  await db.payment.upsert({
    where: { messId_month_memberId: { messId, month, memberId } },
    update: { rentPaid, mealPaid, utilityPaid },
    create: { messId, month, memberId, rentPaid, mealPaid, utilityPaid },
  });

  revalidateApp();
  return succeed(`Payment recorded for ${member.name}.`);
}

/** Mark a member as having paid their full bill for the month, in one go. */
export async function markFullyPaidAction(_prevState, formData) {
  const { messId } = await guardAction();

  // Validated like its sibling. Without this, `getSettlement` silently coerces a
  // bad month to the current one while the upsert below keys on the raw string,
  // minting a Payment row no report will ever read.
  const parsed = paymentSchema
    .pick({ month: true, memberId: true })
    .safeParse({
      month: formString(formData, "month"),
      memberId: formString(formData, "memberId"),
    });
  if (!parsed.success) {
    return fail("That month or member is not valid.", fieldErrors(parsed.error));
  }

  const { month, memberId } = parsed.data;

  // Reuse the report's own engine so the recorded payment is exactly the
  // amount the report asks for — no second, drifting implementation of the
  // costing rules.
  const { getSettlement } = await import("@/lib/data/settlement");
  const settlement = await getSettlement(month);
  const row = settlement.rows.find((item) => item.member.id === memberId);
  if (!row) return fail("That member is not in this month's report.");

  const rentPaid = row.rent;
  const mealPaid = row.mealCost;
  // A member has four cost heads but the record has three columns, so the two
  // shared heads are stored together. The UI labels this column "Shared costs"
  // for exactly this reason — calling it utilities put a figure that silently
  // included "other" in front of the user.
  const utilityPaid = round2(row.utilities + row.otherShare);

  await db.payment.upsert({
    where: { messId_month_memberId: { messId, month, memberId } },
    update: { rentPaid, mealPaid, utilityPaid },
    create: { messId, month, memberId, rentPaid, mealPaid, utilityPaid },
  });

  revalidateApp();
  return succeed(`${row.member.name} marked as fully paid.`);
}
