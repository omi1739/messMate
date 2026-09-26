import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { CheckCircle2 } from "lucide-react";

const PROMISES = [
  "Members are records, not users — nobody else needs an account",
  "Bazar, rent, utilities and meals in one place",
  "One monthly settlement, calculated for you",
];

export default async function AuthLayout({ children }) {
  const user = await getCurrentUser();
  // The proxy redirects already-signed-in visitors, but checking here avoids
  // rendering the form only to throw it away.
  if (user) redirect(user.isAdmin ? "/admin" : "/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel — desktop only, so mobile is just the form. */}
      <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 15%, rgba(255,255,255,0.35) 0, transparent 45%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.22) 0, transparent 40%)",
          }}
        />
        <div className="relative flex flex-1 flex-col justify-between p-10">
          <Brand showText subtitle="Mess accounting, minus the arguing" className="text-primary-foreground [&_span_span]:text-primary-foreground" />

          <div className="max-w-sm space-y-7">
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-primary-foreground">
              The month-end math,
              <br />
              already done.
            </h2>

            <ul className="space-y-3.5">
              {PROMISES.map((promise) => (
                <li key={promise} className="flex items-start gap-2.5 text-[14px] text-primary-foreground/90">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-foreground" aria-hidden />
                  {promise}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12.5px] text-primary-foreground/70">
            Your mess data stays private to your account.
          </p>
        </div>
      </aside>

      <main className="relative flex flex-col bg-background">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Brand href="/" />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <div className="px-5 pb-6 text-center sm:px-8">
          <Link href="/" className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
            ← Back to the homepage
          </Link>
        </div>
      </main>
    </div>
  );
}
