"use server";

import { db } from "@/lib/db";
import { guardAction, revalidateApp } from "@/lib/action-guard";
import { fail, fieldErrors, formString, succeed } from "@/lib/action-state";
import { expenseSchema } from "@/lib/validators";
import { parseDateInput } from "@/lib/date";

function readExpenseForm(formData) {
  return {
    date: formString(formData, "date"),
    category: formString(formData, "category"),
    description: formString(formData, "description"),
    amount: formString(formData, "amount"),
    notes: formString(formData, "notes"),
  };
}

export async function createExpenseAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = expenseSchema.safeParse(readExpenseForm(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  await db.expense.create({
    data: {
      messId,
      date: parseDateInput(data.date),
      category: data.category,
      description: data.description,
      amount: data.amount,
      notes: data.notes,
    },
  });

  revalidateApp();
  return succeed("Expense recorded.");
}

export async function updateExpenseAction(_prevState, formData) {
  const { messId } = await guardAction();

  const expenseId = formString(formData, "expenseId");
  if (!expenseId) return fail("Missing expense.");

  const parsed = expenseSchema.safeParse(readExpenseForm(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;
  const { count } = await db.expense.updateMany({
    where: { id: expenseId, messId },
    data: {
      date: parseDateInput(data.date),
      category: data.category,
      description: data.description,
      amount: data.amount,
      notes: data.notes,
    },
  });

  if (count === 0) return fail("That expense no longer exists.");

  revalidateApp();
  return succeed("Expense updated.");
}

export async function deleteExpenseAction(_prevState, formData) {
  const { messId } = await guardAction();

  const expenseId = formString(formData, "expenseId");
  if (!expenseId) return fail("Missing expense.");

  const { count } = await db.expense.deleteMany({ where: { id: expenseId, messId } });
  if (count === 0) return fail("That expense no longer exists.");

  revalidateApp();
  return succeed("Expense deleted.");
}
