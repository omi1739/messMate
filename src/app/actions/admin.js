"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertSameOrigin, requireSuperAdmin } from "@/lib/dal";
import { fail, formString, succeed } from "@/lib/action-state";

/**
 * Super-admin mutations.
 *
 * `requireSuperAdmin()` redirects unless the session was minted by the
 * `superadmin` provider, so these cannot be reached by a mess owner even by
 * posting directly to the action endpoint.
 */

export async function setUserSuspendedAction(_prevState, formData) {
  await assertSameOrigin();
  await requireSuperAdmin();

  const userId = formString(formData, "userId");
  const suspended = formString(formData, "suspended") === "true";
  if (!userId) return fail("Missing user.");

  const { count } = await db.user.updateMany({ where: { id: userId }, data: { suspended } });
  if (count === 0) return fail("That account no longer exists.");

  revalidatePath("/admin");
  return succeed(suspended ? "Account suspended." : "Account reinstated.");
}

export async function deleteUserAction(_prevState, formData) {
  await assertSameOrigin();
  const admin = await requireSuperAdmin();

  const userId = formString(formData, "userId");
  if (!userId) return fail("Missing user.");

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, mess: { select: { id: true } } },
  });
  if (!target) return fail("That account no longer exists.");

  // A locked-out platform owner cannot delete themselves from the panel.
  if (target.id === admin.id) return fail("You cannot delete your own admin account.");

  // Messes cascade from their owner via Prisma's onDelete, but MongoDB does not
  // enforce referential integrity, so the child records are cleared explicitly.
  if (target.mess) {
    const messId = target.mess.id;
    await Promise.all([
      db.meal.deleteMany({ where: { messId } }),
      db.payment.deleteMany({ where: { messId } }),
      db.expense.deleteMany({ where: { messId } }),
      db.customBill.deleteMany({ where: { messId } }),
      db.bill.deleteMany({ where: { messId } }),
      db.member.deleteMany({ where: { messId } }),
    ]);
    await db.mess.deleteMany({ where: { id: messId } });
  }
  await db.user.deleteMany({ where: { id: userId } });

  revalidatePath("/admin");
  return succeed(`Deleted ${target.email} and all of their mess data.`);
}
