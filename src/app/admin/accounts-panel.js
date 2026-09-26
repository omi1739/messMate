import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountRow } from "./account-row";
import { formatDate, relativeTime } from "@/lib/date";
import { Users } from "lucide-react";

/**
 * The people on the platform: who signed up, when they were last here, and
 * whether they actually use the app or abandoned the signup.
 */
export function AccountsPanel({ users, adminId }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
        <CardDescription>
          Newest first. Suspending blocks sign-in without touching any data; deleting is permanent
          and removes the mess with it.
        </CardDescription>
      </CardHeader>
      <CardContent padded={false}>
        {users.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="No accounts yet"
              description="Accounts appear here as soon as somebody signs up."
              compact
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">
                All platform accounts, with last sign-in and how much each has recorded.
              </caption>
              <thead>
                <tr className="border-b border-border text-[11px] tracking-wide uppercase text-muted-foreground">
                  <th scope="col" className="px-5 py-2 font-semibold">Account</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Mess</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Usage</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Joined</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Last seen</th>
                  <th scope="col" className="py-2 font-semibold">State</th>
                  <th scope="col" className="py-2 pr-5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <AccountRow key={user.id} user={user} isSelf={user.id === adminId} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Which messes are real. Sorted by record volume so the used ones sit at the top
 * and the abandoned signups are easy to spot at the bottom.
 */
export function MessesPanel({ messes }) {
  const sorted = [...messes].sort((a, b) => b.records - a.records);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messes</CardTitle>
        <CardDescription>
          Record volume per mess, busiest first. A mess with no records is a signup that never got
          started.
        </CardDescription>
      </CardHeader>
      <CardContent padded={false}>
        {sorted.length === 0 ? (
          <p className="p-5 text-[13px] text-muted-foreground">No messes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left">
              <caption className="sr-only">Every mess with its owner and recorded activity.</caption>
              <thead>
                <tr className="border-b border-border text-[11px] tracking-wide uppercase text-muted-foreground">
                  <th scope="col" className="px-5 py-2 font-semibold">Mess</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Owner</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Records</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Breakdown</th>
                  <th scope="col" className="py-2 pr-5 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((mess) => (
                  <tr key={mess.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 align-top">
                      <p className="text-[13.5px] font-medium">{mess.name}</p>
                      <p className="text-[11.5px] text-muted-foreground">{mess.currency}</p>
                    </td>
                    <td className="py-3 pr-3 align-top text-[13px]">
                      <p className="truncate">{mess.owner?.name ?? "—"}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {mess.owner?.email}
                      </p>
                    </td>
                    <td className="nums py-3 pr-3 align-top text-[13px] font-medium">
                      {mess.records}
                    </td>
                    <td className="nums py-3 pr-3 align-top text-[11.5px] text-muted-foreground">
                      {mess._count.members}m · {mess._count.meals}meals ·{" "}
                      {mess._count.expenses}exp · {mess._count.bills}bills ·{" "}
                      {mess._count.payments}pay
                    </td>
                    <td className="py-3 pr-5 align-top text-[12px] whitespace-nowrap text-muted-foreground">
                      {formatDate(mess.createdAt)}
                      {mess.ownerLastSeen ? (
                        <span className="block">owner seen {relativeTime(mess.ownerLastSeen)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
