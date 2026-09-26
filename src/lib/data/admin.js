import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/dal";
import { sumBy } from "@/lib/money";
import { monthKeyFromDate } from "@/lib/date";

/**
 * Super-admin only views. Every function here calls `requireSuperAdmin()` first,
 * which redirects unless the session came from the `superadmin` provider.
 *
 * Note these queries are intentionally NOT scoped by messId — the whole point
 * of this panel is to see across all messes.
 */

export async function getPlatformOverview() {
  await requireSuperAdmin();

  const [users, messCount, memberCount, activeMemberCount, recentUsers] = await Promise.all([
    db.user.findMany({
      include: {
        mess: {
          select: {
            id: true,
            name: true,
            currency: true,
            createdAt: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.mess.count(),
    db.member.count(),
    db.member.count({ where: { status: "ACTIVE" } }),
    db.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
  ]);

  const withMess = users.filter((user) => user.mess);

  return {
    stats: {
      users: users.length,
      activeUsers: users.filter((user) => !user.suspended).length,
      suspendedUsers: users.filter((user) => user.suspended).length,
      messes: messCount,
      members: memberCount,
      activeMembers: activeMemberCount,
      totalMessMembers: sumBy(withMess, (user) => user.mess?._count.members ?? 0),
      newestUser: recentUsers[0] ?? null,
    },
    users,
    recentUsers,
  };
}

/** Per-mess rollup, so the panel can show which messes are actually being used. */
export async function getMessRollup() {
  await requireSuperAdmin();

  const messes = await db.mess.findMany({
    include: {
      owner: { select: { id: true, name: true, email: true, suspended: true } },
      _count: { select: { members: true, expenses: true, meals: true, payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return messes.map((mess) => ({
    ...mess,
    lastActivity: monthKeyFromDate(mess.updatedAt),
  }));
}
