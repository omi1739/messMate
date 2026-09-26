"use server";

import { db } from "@/lib/db";
import { guardAction, revalidateApp } from "@/lib/action-guard";
import { fail, fieldErrors, formString, succeed } from "@/lib/action-state";
import { billSchema, customBillSchema } from "@/lib/validators";

/** Save the fixed monthly utilities. Upserts on (messId, month). */
export async function saveBillAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = billSchema.safeParse({
    month: formString(formData, "month"),
    water: formString(formData, "water") || 0,
    electricity: formString(formData, "electricity") || 0,
    gas: formString(formData, "gas") || 0,
    wifi: formString(formData, "wifi") || 0,
    other: formString(formData, "other") || 0,
  });

  if (!parsed.success) {
    return fail("Please check the amounts.", fieldErrors(parsed.error));
  }

  const { month, ...amounts } = parsed.data;

  await db.bill.upsert({
    where: { messId_month: { messId, month } },
    update: amounts,
    create: { messId, month, ...amounts },
  });

  revalidateApp();
  return succeed("Utility bills saved.");
}

export async function createCustomBillAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = customBillSchema.safeParse({
    month: formString(formData, "month"),
    title: formString(formData, "title"),
    amount: formString(formData, "amount"),
    notes: formString(formData, "notes"),
  });

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  await db.customBill.create({
    data: { messId, month: data.month, title: data.title, amount: data.amount, notes: data.notes },
  });

  revalidateApp();
  return succeed(`Added "${data.title}".`);
}

export async function updateCustomBillAction(_prevState, formData) {
  const { messId } = await guardAction();

  const billId = formString(formData, "billId");
  if (!billId) return fail("Missing charge.");

  const parsed = customBillSchema.safeParse({
    month: formString(formData, "month"),
    title: formString(formData, "title"),
    amount: formString(formData, "amount"),
    notes: formString(formData, "notes"),
  });

  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const { count } = await db.customBill.updateMany({
    where: { id: billId, messId },
    data: { month: data.month, title: data.title, amount: data.amount, notes: data.notes },
  });

  if (count === 0) return fail("That charge no longer exists.");

  revalidateApp();
  return succeed("Charge updated.");
}

export async function deleteCustomBillAction(_prevState, formData) {
  const { messId } = await guardAction();

  const billId = formString(formData, "billId");
  if (!billId) return fail("Missing charge.");

  const { count } = await db.customBill.deleteMany({ where: { id: billId, messId } });
  if (count === 0) return fail("That charge no longer exists.");

  revalidateApp();
  return succeed("Charge removed.");
}
