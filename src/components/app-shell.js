"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronsLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Meals", href: "/meals", icon: CalendarDays },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Bills", href: "/bills", icon: Wallet },
  { name: "Report", href: "/reports", icon: Shield },
];

const MOBILE_NAV = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Meals", href: "/meals", icon: CalendarDays },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Report", href: "/reports", icon: Shield },
];

const COLLAPSE_KEY = "messmate-nav-collapsed";

/*
 * Sidebar collapse is persisted, so it is read as an external store instead of
 * being copied into state after mount. The server snapshot is always expanded,
 * which is what renders first anyway.
 */

const collapseListeners = new Set();

function subscribeCollapse(onChange) {
  collapseListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    collapseListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getCollapseSnapshot() {
  return window.localStorage.getItem(COLLAPSE_KEY) === "1";
}

function getCollapseServerSnapshot() {
  return false;
}

function isActive(pathname, href) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function NavList({ pathname, onNavigate, collapsed = false }) {
  return (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="Main">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.name : undefined}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-[13.5px] font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-primary-subtle text-primary"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-[17px] shrink-0" aria-hidden />
            {collapsed ? (
              <span className="sr-only">{item.name}</span>
            ) : (
              <span className="truncate">{item.name}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function NavFooter({ collapsed, onToggleCollapsed }) {
  return (
    <div className="mt-auto border-t border-border p-2">
      <Link
        href="/settings"
        title={collapsed ? "Settings" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Settings className="size-[17px] shrink-0" aria-hidden />
        {collapsed ? <span className="sr-only">Settings</span> : <span>Settings</span>}
      </Link>

      <form action={logoutAction}>
        <button
          type="submit"
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-danger-subtle hover:text-danger",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="size-[17px] shrink-0" aria-hidden />
          {collapsed ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
        </button>
      </form>

      {!collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="mt-0.5 hidden w-full items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground lg:flex"
        >
          <ChevronsLeft className="size-[17px] shrink-0" aria-hidden />
          <span>Collapse</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand navigation"
          className="mt-0.5 hidden w-full items-center justify-center rounded-[var(--radius-field)] py-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground lg:flex"
        >
          <ChevronsLeft className="size-[17px] rotate-180" aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * The application shell: persistent sidebar on desktop, drawer plus a bottom
 * tab bar on mobile. One nav definition drives both so they cannot drift.
 */
export function AppShell({ user, children }) {
  const pathname = usePathname();
  // The drawer is closed on navigation. Rather than syncing that with an effect,
  // the pathname it was opened on is remembered: a different pathname means the
  // drawer is closed, so no state has to be updated after the fact.
  const [drawer, setDrawer] = useState({ open: false, path: pathname });
  const drawerOpen = drawer.open && drawer.path === pathname;

  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    getCollapseSnapshot,
    getCollapseServerSnapshot,
  );

  function openDrawer() {
    setDrawer({ open: true, path: pathname });
  }

  function closeDrawer() {
    setDrawer({ open: false, path: pathname });
  }

  function toggleCollapsed() {
    const next = window.localStorage.getItem(COLLAPSE_KEY) === "1" ? "0" : "1";
    window.localStorage.setItem(COLLAPSE_KEY, next);
    collapseListeners.forEach((listener) => listener());
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-4")}>
          <Brand href="/dashboard" showText={!collapsed} size={collapsed ? "sm" : "default"} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <NavList pathname={pathname} collapsed={collapsed} />
        </div>
        <NavFooter collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onClose={closeDrawer} side="left" title="Menu">
        <NavList pathname={pathname} onNavigate={closeDrawer} />
        <div className="border-t border-border p-2">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground"
          >
            <Settings className="size-[17px]" aria-hidden />
            Settings
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-field)] px-2.5 py-2 text-[13.5px] font-medium text-muted-foreground"
            >
              <LogOut className="size-[17px]" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </Sheet>

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <TopBar
          user={user}
          onOpenNav={openDrawer}
        />
        <main className="mx-auto w-full max-w-[110rem] px-4 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>

      <MobileTabBar pathname={pathname} />
    </div>
  );
}

function TopBar({ user, onOpenNav }) {
  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/85 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenNav} aria-label="Open navigation">
        <Menu className="size-[18px]" aria-hidden />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold">{user.messName ?? "Your mess"}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">
          Signed in as {user.name}
        </p>
      </div>

      <ThemeToggle />
    </header>
  );
}

function MobileTabBar({ pathname }) {
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-[18px]" aria-hidden />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
