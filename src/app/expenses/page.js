"use client";

import * as React from "react";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  TrendingUp, 
  Filter,
  DollarSign,
  AlertTriangle,
  Receipt,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const CATEGORIES = [
  { value: "BAZAR", label: "Bazar / Food" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "KITCHEN", label: "Kitchen Utensils" },
  { value: "GAS_CYLINDER", label: "Gas Cylinder" },
  { value: "OTHER", label: "Other Expenses" }
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("ALL");
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  // Dialog states
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedExpense, setSelectedExpense] = React.useState(null);

  // Form State
  const [formData, setFormData] = React.useState({
    date: new Date().toISOString().split("T")[0],
    category: "BAZAR",
    description: "",
    amount: "",
    notes: ""
  });
  const [formErrors, setFormErrors] = React.useState({});
  const [apiError, setApiError] = React.useState("");

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/expenses?month=${currentMonth}`);
      if (response.ok) {
        const data = await response.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error("Failed to load expenses", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExpenses();
  }, [currentMonth]);

  const handleAddClick = () => {
    setSelectedExpense(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      category: "BAZAR",
      description: "",
      amount: "",
      notes: ""
    });
    setFormErrors({});
    setApiError("");
    setIsFormOpen(true);
  };

  const handleEditClick = (expense) => {
    setSelectedExpense(expense);
    setFormData({
      date: new Date(expense.date).toISOString().split("T")[0],
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      notes: expense.notes || ""
    });
    setFormErrors({});
    setApiError("");
    setIsFormOpen(true);
  };

  const handleDeleteClick = (expense) => {
    setSelectedExpense(expense);
    setIsDeleteOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.date) errors.date = "Date is required";
    if (!formData.description.trim()) errors.description = "Description is required";
    
    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = "Amount must be a positive number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setApiError("");
    const url = selectedExpense ? `/api/expenses/${selectedExpense.id}` : "/api/expenses";
    const method = selectedExpense ? "PUT" : "POST";

    const payload = {
      ...formData,
      amount: parseFloat(formData.amount)
    };

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsFormOpen(false);
        fetchExpenses();
      } else {
        const errorData = await response.json();
        setApiError(errorData.error || "Failed to save expense details.");
      }
    } catch (error) {
      setApiError("Network connection error. Please try again.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedExpense) return;
    try {
      const response = await fetch(`/api/expenses/${selectedExpense.id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setIsDeleteOpen(false);
        fetchExpenses();
      }
    } catch (error) {
      console.error("Failed to delete expense", error);
    }
  };

  // Filtered Ledger List
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "ALL" || exp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculations
  const totalAmount = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalBazar = expenses.filter(e => e.category === "BAZAR").reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Expenses Ledger</h2>
          <p className="text-sm text-slate-500">Track bazar expenses, cooking gas costs, and general maintenance fees.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="w-40 bg-white"
          />
          <Button onClick={handleAddClick} className="gap-2">
            <Plus className="h-4.5 w-4.5" /> Log Expense
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-violet-50 to-white dark:from-slate-950 dark:to-slate-950 border-violet-100 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-violet-600 uppercase">Filtered Total</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-violet-950 dark:text-violet-400">
              ৳{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            For selected categories in {new Date(currentMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-slate-950 dark:to-slate-950 border-emerald-100 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-emerald-600 uppercase">Total Bazar Costs</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-emerald-950 dark:text-emerald-400">
              ৳{totalBazar.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Core food expense used directly to calculate the meal rate this month.
          </CardContent>
        </Card>
      </div>

      {/* Ledger Directory */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Transactions Log</CardTitle>
            <CardDescription>A total of {filteredExpenses.length} transactions match current filter.</CardDescription>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Category Filter */}
            <div className="relative w-full sm:w-48">
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </Select>
            </div>

            {/* Search Query */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-full rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 focus-visible:border-transparent dark:border-slate-800 dark:bg-slate-950"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
              <p className="text-sm text-slate-500 font-medium">Loading ledger...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-20">
              <Receipt className="mx-auto h-12 w-12 text-slate-350 dark:text-slate-700" />
              <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-200">No expenses recorded</h3>
              <p className="mt-1 text-sm text-slate-500">Record a new expense for this month to populate the ledger.</p>
              <Button onClick={handleAddClick} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Log your first expense
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{new Date(expense.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        expense.category === "BAZAR" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40"
                          : expense.category === "GAS_CYLINDER"
                          ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40"
                          : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                      }`}>
                        {CATEGORIES.find(c => c.value === expense.category)?.label || expense.category}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-250">
                      {expense.description}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-slate-105">
                      ৳{expense.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 italic max-w-xs truncate">
                      {expense.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          onClick={() => handleEditClick(expense)}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                          title="Edit transaction"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => handleDeleteClick(expense)}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedExpense ? "Edit Transaction details" : "Record New Expense"}</DialogTitle>
            <DialogDescription>
              {selectedExpense ? "Make changes to the transaction log below." : "Enter transaction details below. Remember that Bazar categories are calculated towards daily meal rates."}
            </DialogDescription>
          </DialogHeader>

          {apiError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-2 border border-rose-100">
              <AlertTriangle className="h-4 w-4" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Transaction Date</label>
                <Input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  error={formErrors.date}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Expense Category</label>
                <Select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-[2fr_1fr] gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Description</label>
                <Input
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="e.g. Bazar by Seyam"
                  error={formErrors.description}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Amount (৳)</label>
                <Input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  error={formErrors.amount}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Notes (Optional)</label>
              <Input
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add shopping list items or comments..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant={selectedExpense ? "success" : "default"}>
                {selectedExpense ? "Save changes" : "Log Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" /> Danger: Delete Transaction
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense record for <strong>৳{parseFloat(selectedExpense?.amount).toFixed(2)}</strong>? 
              This will impact the calculation of the monthly meal rates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
