import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getMessProfile } from "@/lib/data/mess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, relativeTime } from "@/lib/date";
import { MessForm, PasswordForm, ProfileForm, SignOutButton } from "./settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [user, mess] = await Promise.all([getCurrentUser(), getMessProfile()]);

  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">
          Your account, this mess, and your password.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>How you appear inside the mess.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mess settings</CardTitle>
            <CardDescription>
              {mess
                ? `Created ${formatDate(mess.createdAt)} · active ${relativeTime(mess.updatedAt)}`
                : "Not set up yet."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MessForm mess={mess} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              You will stay signed in on this device until the change takes effect elsewhere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>End your session on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </p>
              <SignOutButton />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
