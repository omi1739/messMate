"use client";

import * as React from "react";
import Link from "next/link";
import { 
  Users, 
  Utensils, 
  Percent, 
  ShoppingBag, 
  Home, 
  Zap, 
  TrendingUp, 
  ArrowRight,
  Plus,
  PlusCircle,
  Receipt,
  FileText,
  CreditCard
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardStats();
  }, []);

  const getMonthName = () => {
    return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        <p className="text-sm text-slate-500 font-medium">Loading mess dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-600 to-indigo-700 p-8 rounded-2xl text-white shadow-lg shadow-violet-500/10">
        <div>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
            {getMonthName()} Ledger
          </span>
          <h2 className="text-3xl font-black mt-2 tracking-tight">Welcome back, Mess Manager!</h2>
          <p className="text-sm text-violet-100 mt-1 max-w-md">
            MessMate helps you manage daily meals, split utility bills, and settle bazar expenses without excel sheets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/reports">
            <Button className="bg-white text-violet-750 hover:bg-slate-55 border-none shadow-md shadow-black/10 gap-1.5 font-bold">
              <FileText className="h-4 w-4" /> View Settlement
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Members */}
        <Card className="hover:-translate-y-0.5 transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-bold text-slate-500 uppercase">Total Members</CardDescription>
            <div className="bg-violet-50 dark:bg-violet-950/40 p-2 rounded-lg text-violet-650 dark:text-violet-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50">{stats?.totalMembers || 0}</div>
            <p className="text-[10px] text-slate-400 mt-1">Currently registered in the mess</p>
          </CardContent>
        </Card>

        {/* Today's Meals */}
        <Card className="hover:-translate-y-0.5 transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-bold text-slate-500 uppercase">Today's Meals</CardDescription>
            <div className="bg-sky-50 dark:bg-sky-950/40 p-2 rounded-lg text-sky-650 dark:text-sky-400">
              <Utensils className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50">{stats?.todayMealsCount || 0}</div>
            <p className="text-[10px] text-slate-400 mt-1">Breakfast, lunch, and dinner logs</p>
          </CardContent>
        </Card>

        {/* Current Meal Rate */}
        <Card className="hover:-translate-y-0.5 transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-bold text-slate-500 uppercase">Meal Rate</CardDescription>
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg text-emerald-650 dark:text-emerald-400">
              <Percent className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50">৳{stats?.mealRate.toFixed(2) || "0.00"}</div>
            <p className="text-[10px] text-slate-400 mt-1">Total Bazar expense ÷ Total Meals</p>
          </CardContent>
        </Card>

        {/* Total Monthly Expense */}
        <Card className="hover:-translate-y-0.5 transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription className="text-xs font-bold text-slate-500 uppercase">Total Expenses</CardDescription>
            <div className="bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg text-rose-650 dark:text-rose-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-50">৳{stats?.totalMonthlyExpense.toFixed(2) || "0.00"}</div>
            <p className="text-[10px] text-slate-400 mt-1">Includes rent, bazar & utilities</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-1 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Shortcut links to update mess datasets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/members">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-violet-500" /> Manage Members</span>
                <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="/meals">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2"><Utensils className="h-4 w-4 text-sky-500" /> Daily Meal Matrix</span>
                <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="/expenses">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-emerald-500" /> Log Bazar Expense</span>
                <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="/bills">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-500" /> Update Utility Bills</span>
                <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="lg:col-span-2 border-slate-200/60 dark:border-slate-800/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Recent Bazar logs</CardTitle>
              <CardDescription>Last 5 transactions recorded in the ledger.</CardDescription>
            </div>
            <Link href="/expenses">
              <Button variant="ghost" className="text-xs text-violet-600 gap-1 hover:text-violet-750 p-0 h-auto">
                View Ledger <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0 border-t border-slate-100 dark:border-slate-900">
            {stats?.recentExpenses.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 font-medium">
                No recent expenses logged. Click "Log Bazar Expense" to start.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-900">
                {stats?.recentExpenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{exp.description}</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} • {exp.category}
                      </p>
                    </div>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-300">৳{exp.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
