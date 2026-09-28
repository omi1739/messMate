"use server";

import { db } from "@/lib/db";
import { guardAction, revalidateApp } from "@/lib/action-guard";
import { fail, fieldErrors, formString, succeed } from "@/lib/action-state";
import { mealEntrySchema } from "@/lib/validators";
import { parseDateInput } from "@/lib/date";

export async function setMealAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = mealEntrySchema.safeParse({
    date: formString(formData, "date"),
    memberId: formString(formData, "memberId"),
    breakfast: formString(formData, "breakfast") || 0,
    lunch: formString(formData, "lunch") || 0,
    dinner: formString(formData, "dinner") || 0,
  });

  if (!parsed.success) {
    return fail("Those meal counts are not valid.", fieldErrors(parsed.error));
  }

  const { date, memberId, breakfast, lunch, dinner } = parsed.data;

  // Confirm the member is inside this mess before writing against their id.
  const member = await db.member.findFirst({
    where: { id: memberId, messId },
    select: { id: true },
  });
  if (!member) return fail("That member is not in your mess.");

  await db.meal.upsert({
    where: { messId_date_memberId: { messId, date: parseDateInput(date), memberId } },
    update: { breakfast, lunch, dinner },
    create: { messId, memberId, date: parseDateInput(date), breakfast, lunch, dinner },
  });

  revalidateApp();
  return succeed("Meals saved.");
}

/**
 * "Everyone ate" helper: set the same count for every active member on a date.
 * Saves a mess manager from clicking 12 cells for one ordinary day.
 */
export async function fillDayForAllAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = mealEntrySchema
    .pick({ breakfast: true, lunch: true, dinner: true })
    .safeParse({
      breakfast: formString(formData, "breakfast") || 0,
      lunch: formString(formData, "lunch") || 0,
      dinner: formString(formData, "dinner") || 0,
    });
  if (!parsed.success) {
    return fail("Those meal counts are not valid.", fieldErrors(parsed.error));
  }

  const date = formString(formData, "date");
  if (parseDateInput(date) === null) return fail("Pick a valid date.");

  const { breakfast, lunch, dinner } = parsed.data;

  const members = await db.member.findMany({
    where: { messId, status: "ACTIVE" },
    select: { id: true },
  });
  if (members.length === 0) return fail("Add some active members first.");

  const day = parseDateInput(date);

  await Promise.all(
    members.map((member) =>
      db.meal.upsert({
        where: { messId_date_memberId: { messId, date: day, memberId: member.id } },
        update: { breakfast, lunch, dinner },
        create: { messId, memberId: member.id, date: day, breakfast, lunch, dinner },
      }),
    ),
  );

  revalidateApp();
  return succeed(`Set ${formatCount(breakfast + lunch + dinner)} for ${members.length} members.`);
}

function formatCount(count) {
  return count === 1 ? "1 meal" : `${count} meals`;
}

/**
 * The everyday case: mark the whole day for everyone, but only for members who
 * have nothing recorded yet. `fillDayForAllAction` overwrites, which is wrong
 * when you are catching up on an ordinary day and someone only had half a lunch.
 */
export async function fillMissingMealsAction(_prevState, formData) {
  const { messId } = await guardAction();

  const date = formString(formData, "date");
  const day = parseDateInput(date);
  if (day === null) return fail("Pick a valid date.");

  const members = await db.member.findMany({
    where: { messId, status: "ACTIVE" },
    select: { id: true },
  });
  if (members.length === 0) return fail("Add some active members first.");

  const existing = await db.meal.findMany({
    where: { messId, date: day },
    select: { memberId: true, breakfast: true, lunch: true, dinner: true },
  });

  // Only rows with no meals at all count as missing. A partial day is somebody's
  // real data, not an oversight.
  const untouched = new Set(
    existing
      .filter((meal) => !meal.breakfast && !meal.lunch && !meal.dinner)
      .map((meal) => meal.memberId),
  );
  const targets = members.filter(
    (member) => !existing.some((meal) => meal.memberId === member.id) || untouched.has(member.id),
  );

  if (targets.length === 0) {
    revalidateApp();
    return succeed("Everyone already has meals recorded for that day.");
  }

  await Promise.all(
    targets.map((member) =>
      db.meal.upsert({
        where: { messId_date_memberId: { messId, date: day, memberId: member.id } },
        update: { breakfast: 1, lunch: 1, dinner: 1 },
        create: { messId, memberId: member.id, date: day, breakfast: 1, lunch: 1, dinner: 1 },
      }),
    ),
  );

  revalidateApp();
  return succeed(
    `Filled ${targets.length} of ${members.length} ${members.length === 1 ? "member" : "members"} with all three meals.`,
  );
}
