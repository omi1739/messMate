"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertSameOrigin, requireSuperAdmin } from "@/lib/dal";
import { fail, formString, succeed } from "@/lib/action-state";
import { clearMessData } from "@/lib/cascade";

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
  if (!userId) return fail("Missing user.");

  // Parsed strictly. Anything that was not literally "true" used to mean
  // "reinstate", so a checkbox (`"on"`), a `"1"`, or a missing field silently
  // granted access rather than revoking it.
  const raw = formString(formData, "suspended");
  if (raw !== "true" && raw !== "false") return fail("That account state is not valid.");
  const suspended = raw === "true";

  const { count } = await db.user.updateMany({ where: { id: userId }, data: { suspended } });
  if (count === 0) return fail("That account no longer exists.");

  // No session bookkeeping is needed to cut access off: `getCurrentUser` re-reads
  // the account on every guarded request and treats a suspended row as no
  // session at all, so the flag takes effect on the target's very next request.
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
  //
  // This is several independent writes with no transaction available on a
  // standalone MongoDB, so a failure part-way through is possible and has to be
  // recoverable. Without this, a failure left the account alive with its mess
  // already gone: a signed-in user with empty pages and a Server Action throwing
  // on every save, and no way to sign out and start again.
  try {
    if (target.mess) {
      await clearMessData(db, target.mess.id);
    }
    await db.user.deleteMany({ where: { id: userId } });
  } catch (error) {
    console.error(`[admin] failed to delete account ${userId}:`, error);
    return fail(
      `Could not finish deleting ${target.email}. The mess data may be partly removed — try again, or remove the account by hand in Prisma Studio.`,
    );
  }

  // Any live session for the deleted account resolves to no user on its next
  // request, because `getCurrentUser` re-reads the row rather than trusting the
  // cookie, so there is no valid-session cleanup to do here.
  revalidatePath("/admin");
  return succeed(`Deleted ${target.email} and all of their mess data.`);
}
