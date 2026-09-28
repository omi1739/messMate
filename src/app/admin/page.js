import { getMessRollup, getPlatformOverview, getTrafficOverview } from "@/lib/data/admin";
import { getCurrentUser } from "@/lib/dal";
import { logoutAction } from "@/app/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Building2, CalendarClock, Eye, LogIn, UserCheck, Users } from "lucide-react";
import { AccountsPanel, MessesPanel } from "./accounts-panel";
import { SignupChart, TrafficPanel } from "./traffic-panel";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [overview, rollup, traffic, admin] = await Promise.all([
    getPlatformOverview(),
    getMessRollup(),
    getTrafficOverview(30),
    getCurrentUser(),
  ]);

  const { stats, users, signupSeries, signupTrend } = overview;
  const engaged = stats.activeMembers > 0 ? stats.activeMembers / Math.max(stats.members, 1) : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Platform</h1>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">
          Signed in as {admin?.email}. Every account, every mess, and the traffic that reaches this
          site.
        </p>
      </header>

      {/* ---- Headline numbers ------------------------------------------- */}
      <section aria-label="Platform totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Accounts"
          value={stats.users}
          hint={`${stats.activeUsers} active · ${stats.suspendedUsers} suspended`}
          tone="primary"
        />
        <StatCard
          icon={UserCheck}
          label="Signed in this week"
          value={stats.signedInThisWeek}
          hint={`${stats.neverSignedIn} have never signed in`}
          tone="success"
        />
        <StatCard
          icon={Building2}
          label="Messes"
          value={stats.messes}
          hint={`${stats.totalMessMembers} member rows`}
        />
        <StatCard
          icon={Activity}
          label="Members"
          value={stats.members}
          hint={`${stats.activeMembers} active · ${Math.round(engaged * 100)}% of the roster`}
        />
      </section>

      {/* ---- Traffic ---------------------------------------------------- */}
      <section aria-label="Traffic" className="space-y-5">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-[15px] font-semibold tracking-tight">Traffic</h2>
        </div>
        <TrafficPanel traffic={traffic} />
      </section>

      {/* ---- Growth and accounts ---------------------------------------- */}
      <section aria-label="Accounts and growth" className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <SignupChart series={signupSeries} trend={signupTrend} />
          </div>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Account health</CardTitle>
              <CardDescription>
                The two numbers worth watching: accounts that have never come back, and messes that
                were signed up for but never used.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <HealthRow
                icon={CalendarClock}
                label="Never signed in"
                value={stats.neverSignedIn}
                total={stats.users}
                hint="Signed up but never returned — usually a mistyped email or a shared link."
              />
              <HealthRow
                icon={Building2}
                label="Never used"
                value={stats.emptyAccounts}
                total={stats.users}
                hint="Signed in, but no member, meal or bill was ever entered."
              />
              <HealthRow
                icon={LogIn}
                label="Newest account"
                value={stats.newestUser?.name ?? "—"}
                hint={stats.newestUser?.email}
              />
            </CardContent>
          </Card>
        </div>

        <AccountsPanel users={users} adminId={admin?.id} />
      </section>

      {/* ---- Per-mess --------------------------------------------------- */}
      <section aria-label="Messes">
        <MessesPanel messes={rollup} />
      </section>

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

function HealthRow({ icon: Icon, label, value, total, hint }) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{label}</p>
          <p className="truncate text-[12px] text-muted-foreground">{hint}</p>
        </div>
        <p className="nums shrink-0 text-right text-[15px] font-semibold">
          {value}
          {typeof total === "number" ? (
            <span className="ml-1 text-[12px] font-normal text-muted-foreground">/ {total}</span>
          ) : null}
        </p>
      </div>
      {typeof total === "number" ? (
        <div className="mt-1.5 ml-10.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
        </div>
      ) : null}
    </div>
  );
}
