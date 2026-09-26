import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/dal";
import { sumBy } from "@/lib/money";
import { monthKeyFromDate, relativeTime } from "@/lib/date";
import { readTraffic, dayKey } from "@/lib/analytics";

/**
 * Super-admin only views. Every function here calls `requireSuperAdmin()` first,
 * which redirects unless the session came from the `superadmin` provider.
 *
 * Note these queries are intentionally NOT scoped by messId — the whole point
 * of this panel is to see across all messes.
 */

/** Yesterday's UTC day key, i.e. where "the last 7 days" starts. */
function daysAgoKey(days) {
  return dayKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

/**
 * A rough "is this account actually used?" label, so an operator can tell a
 * real user from a signup that was abandoned on day one.
 */
function usageLevel(records) {
  if (records === 0) return "empty";
  if (records < 20) return "light";
  return "active";
}

export async function getPlatformOverview() {
  await requireSuperAdmin();

  const [users, messCount, memberCount, activeMemberCount] = await Promise.all([
    db.user.findMany({
      include: {
        mess: {
          select: {
            id: true,
            name: true,
            currency: true,
            createdAt: true,
            _count: {
              select: { members: true, meals: true, expenses: true, bills: true, payments: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.mess.count(),
    db.member.count(),
    db.member.count({ where: { status: "ACTIVE" } }),
  ]);

  const withMess = users.filter((user) => user.mess);

  // Signups per day, for the growth chart. Accounts are few (self-hosted), so
  // reading the timestamps and bucketing them here beats an aggregation stage.
  const signups = new Map();
  for (const user of users) {
    const day = dayKey(user.createdAt);
    signups.set(day, (signups.get(day) ?? 0) + 1);
  }
  const signupSeries = [];
  for (let offset = 29; offset >= 0; offset--) {
    const day = daysAgoKey(offset);
    signupSeries.push({ day, count: signups.get(day) ?? 0 });
  }
  const sumDays = (from, to) =>
    users.filter((user) => {
      const day = dayKey(user.createdAt);
      return day >= from && day <= to;
    }).length;
  const thisWeek = sumDays(daysAgoKey(6), dayKey());
  const lastWeek = sumDays(daysAgoKey(13), daysAgoKey(7));

  // Engagement: how much each mess has actually recorded, so abandoned signups
  // stand out next to real usage.
  const accounts = users.map((user) => {
    const counts = user.mess?._count;
    const records = counts
      ? counts.members + counts.meals + counts.expenses + counts.bills + counts.payments
      : 0;
    return {
      ...user,
      records,
      usage: usageLevel(records),
      lastSeen: user.lastLoginAt,
      lastSeenLabel: user.lastLoginAt ? relativeTime(user.lastLoginAt) : "never",
    };
  });

  return {
    stats: {
      users: users.length,
      activeUsers: users.filter((user) => !user.suspended).length,
      suspendedUsers: users.filter((user) => user.suspended).length,
      messes: messCount,
      members: memberCount,
      activeMembers: activeMemberCount,
      totalMessMembers: sumBy(withMess, (user) => user.mess?._count.members ?? 0),
      newestUser: accounts[0] ?? null,
      neverSignedIn: accounts.filter((user) => !user.lastLoginAt).length,
      signedInThisWeek: accounts.filter(
        (user) => user.lastLoginAt && user.lastLoginAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      ).length,
      emptyAccounts: accounts.filter((user) => user.usage === "empty").length,
    },
    users: accounts,
    signupSeries,
    signupTrend: { thisWeek, lastWeek },
  };
}

/** Traffic for the panel. Counts come from src/proxy.js; see src/lib/analytics.js. */
export async function getTrafficOverview(days = 30) {
  await requireSuperAdmin();
  return readTraffic(days);
}


/** Per-mess rollup, so the panel can show which messes are actually being used. */
export async function getMessRollup() {
  await requireSuperAdmin();

  const messes = await db.mess.findMany({
    include: {
      owner: { select: { id: true, name: true, email: true, suspended: true, lastLoginAt: true } },
      _count: { select: { members: true, expenses: true, meals: true, payments: true, bills: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return messes.map((mess) => {
    const records = Object.values(mess._count).reduce((sum, n) => sum + n, 0);
    return {
      ...mess,
      records,
      usage: usageLevel(records),
      lastActivity: monthKeyFromDate(mess.updatedAt),
      ownerLastSeen: mess.owner?.lastLoginAt ?? null,
    };
  });
}
