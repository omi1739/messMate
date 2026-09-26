"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Receipt, 
  CreditCard, 
  FileText,
  UtensilsCrossed
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Members", href: "/members", icon: Users },
  { name: "Daily Meals", href: "/meals", icon: CalendarDays },
  { name: "Expenses Ledger", href: "/expenses", icon: Receipt },
  { name: "Monthly Bills", href: "/bills", icon: CreditCard },
  { name: "Settlement Report", href: "/reports", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 z-30">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-2.5">
        <div className="bg-violet-600 p-2 rounded-lg text-white">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none text-white tracking-tight">MessMate</h1>
          <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Mess Management</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/10" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className={cn(
                "h-4.5 w-4.5 transition-colors", 
                isActive ? "text-white" : "text-slate-400 group-hover:text-white"
              )} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-center">
        <p className="text-xs text-slate-500 font-medium">MessMate Desktop v1.0</p>
        <p className="text-[10px] text-slate-650 mt-0.5">Bangladesh</p>
      </div>
    </aside>
  );
}
