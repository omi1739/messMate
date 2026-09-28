"use server";

import { db } from "@/lib/db";
import { guardAction, revalidateApp } from "@/lib/action-guard";
import { fieldErrors, fail, formString, succeed } from "@/lib/action-state";
import { memberSchema } from "@/lib/validators";
import { parseDateInput } from "@/lib/date";

function readMemberForm(formData) {
  return {
    name: formString(formData, "name"),
    phone: formString(formData, "phone"),
    joiningDate: formString(formData, "joiningDate"),
    status: formString(formData, "status") || "ACTIVE",
    rent: formString(formData, "rent") || 0,
    notes: formString(formData, "notes"),
    photoUrl: formString(formData, "photoUrl"),
  };
}

export async function createMemberAction(_prevState, formData) {
  const { messId } = await guardAction();

  const parsed = memberSchema.safeParse(readMemberForm(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = parsed.data;

  await db.member.create({
    data: {
      messId,
      name: data.name,
      phone: data.phone,
      joiningDate: parseDateInput(data.joiningDate),
      status: data.status,
      rent: data.rent,
      notes: data.notes,
      photoUrl: data.photoUrl,
    },
  });

  revalidateApp();
  return succeed(`${data.name} added to your mess.`);
}

export async function updateMemberAction(_prevState, formData) {
  const { messId } = await guardAction();

  const memberId = formString(formData, "memberId");
  if (!memberId) return fail("Missing member.", { memberId: "Required" });

  const parsed = memberSchema.safeParse(readMemberForm(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrors(parsed.error));
  }

  // Scoped by messId on purpose: `update({ where: { id } })` alone would let a
  // crafted id edit a member belonging to a different mess.
  const { count } = await db.member.updateMany({
    where: { id: memberId, messId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      joiningDate: parseDateInput(parsed.data.joiningDate),
      status: parsed.data.status,
      rent: parsed.data.rent,
      notes: parsed.data.notes,
      photoUrl: parsed.data.photoUrl,
    },
  });

  if (count === 0) return fail("That member no longer exists.");

  revalidateApp();
  return succeed(`${parsed.data.name} updated.`);
}

export async function setMemberStatusAction(_prevState, formData) {
  const { messId } = await guardAction();

  const memberId = formString(formData, "memberId");
  const status = formString(formData, "status");
  if (!memberId || !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(status)) {
    return fail("That change is not valid.");
  }

  const { count } = await db.member.updateMany({ where: { id: memberId, messId }, data: { status } });
  if (count === 0) return fail("That member no longer exists.");

  revalidateApp();
  // ARCHIVED is a distinct terminal state, not a flavour of inactive. The old
  // two-way ternary reported "inactive" for an archive, so the button said
  // Archived while the confirmation said otherwise.
  const confirmations = {
    ACTIVE: "Member reactivated.",
    INACTIVE: "Member marked as inactive.",
    ARCHIVED: "Member archived. Their history is kept and their charges have stopped.",
  };
  return succeed(confirmations[status]);
}

export async function deleteMemberAction(_prevState, formData) {
  const { messId } = await guardAction();

  const memberId = formString(formData, "memberId");
  if (!memberId) return fail("Missing member.");

  // MongoDB has no foreign-key cascade, so the dependants go first — each
  // delete is still scoped to this mess.
  const [, , removed] = await Promise.all([
    db.meal.deleteMany({ where: { messId, memberId } }),
    db.payment.deleteMany({ where: { messId, memberId } }),
    db.member.deleteMany({ where: { messId, id: memberId } }),
  ]);

  if (removed.count === 0) return fail("That member no longer exists.");

  revalidateApp();
  return succeed("Member and their meal/payment records were removed.");
}
