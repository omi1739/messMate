"use client";

import * as React from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Utensils, 
  Info,
  CalendarDays,
  Save,
  Check,
  Plus,
  Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function MealsPage() {
  const [members, setMembers] = React.useState([]);
  const [meals, setMeals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  
  // Date State
  const [currentDate, setCurrentDate] = React.useState(new Date());
  
  // Cell selection state for modal editing
  const [selectedCell, setSelectedCell] = React.useState(null); // { member, day, dateStr }
  const [editingMeals, setEditingMeals] = React.useState({ breakfast: 0, lunch: 0, dinner: 0 });
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Get number of days in selected month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Fetch Members and Meals
  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, mealsRes] = await Promise.all([
        fetch("/api/members"),
        fetch(`/api/meals?month=${monthStr}`)
      ]);

      if (membersRes.ok && mealsRes.ok) {
        const membersData = await membersRes.json();
        const mealsData = await mealsRes.json();
        
        // Filter out archived members unless they have meals in the current month
        const activeMembers = membersData.filter(m => 
          m.status === "ACTIVE" || 
          mealsData.some(meal => meal.memberId === m.id && (meal.breakfast > 0 || meal.lunch > 0 || meal.dinner > 0))
        );
        
        setMembers(activeMembers);
        setMeals(mealsData);
      }
    } catch (error) {
      console.error("Failed to load meal ledger data", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [currentDate]);

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Find logged meal record for a member on a specific day
  const getMealForMemberDay = (memberId, day) => {
    // Format target date in UTC matching the DB payload
    const targetDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    
    return meals.find(m => {
      const mealDate = new Date(m.date);
      const mealDateStr = `${mealDate.getUTCFullYear()}-${String(mealDate.getUTCMonth() + 1).padStart(2, "0")}-${String(mealDate.getUTCDate()).padStart(2, "0")}`;
      return m.memberId === memberId && mealDateStr === targetDateStr;
    });
  };

  // Open edit dialog for a specific cell
  const handleCellClick = (member, day) => {
    const targetDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existingMeal = getMealForMemberDay(member.id, day);

    setSelectedCell({ member, day, dateStr: targetDateStr });
    setEditingMeals({
      breakfast: existingMeal ? existingMeal.breakfast : 0,
      lunch: existingMeal ? existingMeal.lunch : 0,
      dinner: existingMeal ? existingMeal.dinner : 0
    });
    setIsEditOpen(true);
  };

  // Quick increment/decrement helpers for modal inputs
  const adjustMeal = (type, amount) => {
    setEditingMeals(prev => ({
      ...prev,
      [type]: Math.max(0, Math.min(5, prev[type] + amount))
    }));
  };

  // Save changes
  const handleSaveMeals = async () => {
    if (!selectedCell) return;
    setSaving(true);
    
    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedCell.dateStr,
          memberId: selectedCell.member.id,
          ...editingMeals
        })
      });

      if (response.ok) {
        setIsEditOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save meal record", error);
    } finally {
      setSaving(false);
    }
  };

  // Calculate member summaries
  const getMemberSummary = (memberId) => {
    let breakfast = 0;
    let lunch = 0;
    let dinner = 0;

    meals.forEach(m => {
      if (m.memberId === memberId) {
        breakfast += m.breakfast;
        lunch += m.lunch;
        dinner += m.dinner;
      }
    });

    return {
      breakfast,
      lunch,
      dinner,
      total: breakfast + lunch + dinner
    };
  };

  // Formatting helper for date headers
  const getDayName = (day) => {
    const d = new Date(year, month, day);
    return d.toLocaleDateString("en-US", { weekday: "narrow" });
  };

  const getMonthName = () => {
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="flex-1 p-8 space-y-6 flex flex-col h-screen overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Daily Meal Register</h2>
          <p className="text-sm text-slate-500">Record breakfast, lunch, and dinner logs for each day.</p>
        </div>
        
        {/* Month Navigation Control */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1.5 rounded-lg shadow-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold px-4 min-w-[120px] text-center">
            {getMonthName()}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid Container */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm flex-1 flex flex-col overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-900 p-6 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Meal Matrix</CardTitle>
            <CardDescription>Click any cell to edit daily meal records for members.</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-100 dark:bg-sky-950 border border-sky-300 dark:border-sky-850 rounded-sm"></span> B (Breakfast)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-850 rounded-sm"></span> L (Lunch)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-violet-100 dark:bg-violet-950 border border-violet-300 dark:border-violet-850 rounded-sm"></span> D (Dinner)</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
              <p className="text-sm text-slate-500 font-medium">Loading meals ledger...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <CalendarDays className="h-12 w-12 text-slate-350" />
              <h3 className="mt-4 text-sm font-semibold text-slate-900">No active members found</h3>
              <p className="mt-1 text-sm text-slate-500">Go to Members Directory page to add active members first.</p>
            </div>
          ) : (
            <div className="w-full h-full min-w-max border-collapse select-none">
              {/* Custom Sticky Header Scroll Grid */}
              <div className="grid grid-cols-[200px_1fr_220px] bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-20 text-xs font-semibold text-slate-650 dark:text-slate-400">
                <div className="p-4 border-r border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky left-0 z-20">
                  Member
                </div>
                <div className="flex overflow-visible">
                  {daysArray.map((day) => (
                    <div key={day} className="w-12 text-center py-2 flex flex-col justify-center border-r border-slate-100 dark:border-slate-800 flex-shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">{getDayName(day)}</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{day}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 text-center items-center bg-slate-50 dark:bg-slate-900 pl-2">
                  <span className="text-sky-600">B</span>
                  <span className="text-emerald-600">L</span>
                  <span className="text-violet-600">D</span>
                  <span className="font-bold border-l border-slate-200 dark:border-slate-800 h-full flex items-center justify-center bg-slate-100/50 dark:bg-slate-850/50">Total</span>
                </div>
              </div>

              {/* Rows */}
              {members.map((member) => {
                const summary = getMemberSummary(member.id);

                return (
                  <div key={member.id} className="grid grid-cols-[200px_1fr_220px] border-b border-slate-100 dark:border-slate-800 items-stretch hover:bg-slate-50/30 dark:hover:bg-slate-950/20">
                    {/* Sticky Name column */}
                    <div className="p-4 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky left-0 z-10 flex items-center gap-2.5 font-medium">
                      <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate text-sm text-slate-900 dark:text-slate-100" title={member.name}>
                        {member.name}
                      </span>
                    </div>

                    {/* Scrollable Days */}
                    <div className="flex">
                      {daysArray.map((day) => {
                        const meal = getMealForMemberDay(member.id, day);
                        const hasMeals = meal && (meal.breakfast > 0 || meal.lunch > 0 || meal.dinner > 0);

                        return (
                          <div
                            key={day}
                            onClick={() => handleCellClick(member, day)}
                            className="w-12 border-r border-slate-100 dark:border-slate-850 flex-shrink-0 flex items-center justify-center p-1 cursor-pointer hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors"
                          >
                            {hasMeals ? (
                              <div className="flex flex-col gap-0.5 w-full items-center">
                                {/* Breakfast dot indicator */}
                                {meal.breakfast > 0 && (
                                  <span className="w-7 text-[9px] font-bold text-center leading-none bg-sky-50 dark:bg-sky-950 text-sky-700 border border-sky-200 dark:border-sky-900 rounded-sm">
                                    {meal.breakfast}
                                  </span>
                                )}
                                {/* Lunch dot indicator */}
                                {meal.lunch > 0 && (
                                  <span className="w-7 text-[9px] font-bold text-center leading-none bg-emerald-50 dark:bg-emerald-950 text-emerald-700 border border-emerald-200 dark:border-emerald-900 rounded-sm">
                                    {meal.lunch}
                                  </span>
                                )}
                                {/* Dinner dot indicator */}
                                {meal.dinner > 0 && (
                                  <span className="w-7 text-[9px] font-bold text-center leading-none bg-violet-50 dark:bg-violet-950 text-violet-700 border border-violet-200 dark:border-violet-900 rounded-sm">
                                    {meal.dinner}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-800 text-[10px]">-</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Columns Summaries */}
                    <div className="grid grid-cols-4 text-center items-center text-xs font-semibold pl-2">
                      <span className="text-slate-650 dark:text-slate-400">{summary.breakfast}</span>
                      <span className="text-slate-650 dark:text-slate-400">{summary.lunch}</span>
                      <span className="text-slate-650 dark:text-slate-400">{summary.dinner}</span>
                      <span className="font-bold border-l border-slate-200 dark:border-slate-800 h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900/60 text-violet-750 dark:text-violet-400">
                        {summary.total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Meals Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-violet-600" /> Record Meals
            </DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <>
                  Manage meal quantities for <strong>{selectedCell.member.name}</strong> on{" "}
                  <strong>{new Date(selectedCell.dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Breakfast Quantity */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Breakfast</h4>
                <p className="text-[10px] text-slate-400">Default morning portion count</p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => adjustMeal("breakfast", -0.5)} 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-bold min-w-[24px] text-center">{editingMeals.breakfast}</span>
                <Button 
                  onClick={() => adjustMeal("breakfast", 0.5)} 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Lunch Quantity */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Lunch</h4>
                <p className="text-[10px] text-slate-400">Default midday portion count</p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => adjustMeal("lunch", -0.5)} 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-bold min-w-[24px] text-center">{editingMeals.lunch}</span>
                <Button 
                  onClick={() => adjustMeal("lunch", 0.5)} 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Dinner Quantity */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Dinner</h4>
                <p className="text-[10px] text-slate-400">Default evening portion count</p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => adjustMeal("dinner", -0.5)} 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-bold min-w-[24px] text-center">{editingMeals.dinner}</span>
                <Button 
                  onClick={() => adjustMeal("dinner", 0.5)} 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-full"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between flex-row">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveMeals} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
