import { getPlatformOverview, getMessRollup } from "@/lib/data/admin";
import { getCurrentUser } from "@/lib/dal";
import { logoutAction } from "@/app/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, relativeTime } from "@/lib/date";
import { Users } from "lucide-react";
import { AccountRow } from "./account-row";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [overview, rollup, admin] = await Promise.all([
    getPlatformOverview(),
    getMessRollup(),
    getCurrentUser(),
  ]);

  const { stats, users } = overview;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Platform</h1>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">
          Every account on the platform, as {admin?.email}. Deleting an account removes its mess and
          all of that mess&rsquo;s records.
        </p>
      </header>

      <section aria-label="Platform totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accounts"
          value={stats.users}
          hint={`${stats.activeUsers} active · ${stats.suspendedUsers} suspended`}
          tone="primary"
        />
        <StatCard label="Messes" value={stats.messes} hint={`${stats.totalMessMembers} member rows`} />
        <StatCard
          label="Members"
          value={stats.members}
          hint={`${stats.activeMembers} currently active`}
        />
        <StatCard
          label="Newest account"
          value={stats.newestUser ? relativeTime(stats.newestUser.createdAt) : "—"}
          hint={stats.newestUser?.email}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Suspending blocks sign-in without touching any data. Deleting is permanent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No accounts yet"
              description="Accounts appear here as soon as somebody signs up."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left">
                <caption className="sr-only">All platform accounts and their messes.</caption>
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      Account
                    </th>
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      Mess
                    </th>
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      Joined
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      State
                    </th>
                    <th scope="col" className="py-2 pl-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <AccountRow key={user.id} user={user} isSelf={user.id === admin?.id} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mess activity</CardTitle>
          <CardDescription>
            Record counts per mess, newest first. Useful for spotting abandoned signups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rollup.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No messes yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rollup.map((mess) => (
                <li
                  key={mess.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{mess.name}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                      {mess.owner?.name} · {mess.owner?.email}
                    </p>
                  </div>
                  <p className="nums shrink-0 text-[12.5px] text-muted-foreground">
                    {mess._count.members} members · {mess._count.meals} meals ·{" "}
                    {mess._count.expenses} expenses · {mess._count.payments} payments
                  </p>
                  <p className="shrink-0 text-[11.5px] text-muted-foreground">
                    created {formatDate(mess.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaving the panel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">
              Admin sessions are separate from owner sessions — signing out ends the admin session
              only.
            </p>
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Sign out of admin
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
