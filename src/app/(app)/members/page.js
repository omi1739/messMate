import { listMembers } from "@/lib/data/members";
import { getCurrency } from "@/lib/data/mess";
import { toDateInputValue, todayUtcMidnight } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MembersManager } from "./members-manager";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const [members, currency] = await Promise.all([listMembers(), getCurrency()]);

  const active = members.filter((m) => m.status === "ACTIVE");
  const totalRent = active.reduce((sum, m) => sum + (m.rent ?? 0), 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Members</h1>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">
          {members.length === 0
            ? "The people you cook for. They never need an account."
            : `${active.length} active of ${members.length} · ${formatMoney(totalRent, { currency })} in seat rent`}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your mess</CardTitle>
          <CardDescription>
            Active members pay seat rent and share utilities. Archived members keep their history
            but are charged nothing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersManager
            members={members}
            currency={currency}
            defaultJoiningDate={toDateInputValue(todayUtcMidnight())}
          />
        </CardContent>
      </Card>
    </div>
  );
}
