/**
 * Removing a mess's data.
 *
 * Prisma emits the right cascade for relational databases, but MongoDB does not
 * enforce referential integrity, so a child row deleted via its parent simply
 * becomes an orphan. Every path that removes a mess has to clear the children
 * explicitly, or re-seeding leaves junk behind.
 *
 * Order is irrelevant here because nothing depends on a sibling, but it is kept
 * deepest-first to mirror how the data grows.
 */
export async function clearMessData(db, messId) {
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

/** Removes an account and, if it owns one, everything inside its mess. */
export async function deleteUserCascade(db, userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, mess: { select: { id: true } } },
  });
  if (!user) return null;

  if (user.mess) await clearMessData(db, user.mess.id);
  await db.user.deleteMany({ where: { id: userId } });
  return user;
}
