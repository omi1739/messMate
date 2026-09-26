import { requireSuperAdmin } from "@/lib/dal";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShieldCheck } from "lucide-react";

/**
 * Super-admin shell. Deliberately separate from the owner `AppShell`: an admin
 * session is a different provider, and the two must never share navigation, so
 * there is no way to wander from one into the other by clicking a link.
 */
export default async function AdminLayout({ children }) {
  const admin = await requireSuperAdmin();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Platform admin
          </span>
          <span className="hidden truncate text-[12.5px] text-muted-foreground sm:inline">
            {admin?.email}
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
