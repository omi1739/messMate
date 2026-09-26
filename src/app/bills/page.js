"use client";

import * as React from "react";
import { 
  CreditCard,
  Save,
  CheckCircle,
  Home,
  Droplet,
  Zap,
  Flame,
  Wifi,
  MoreHorizontal,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  FileText,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function BillsPage() {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState("");
  
  // Bill inputs state
  const [bills, setBills] = React.useState({
    water: 0,
    electricity: 0,
    gas: 0,
    wifi: 0,
    other: 0
  });

  const [errors, setErrors] = React.useState({});

  // Custom bill states
  const [customBills, setCustomBills] = React.useState([]);
  const [isCustomFormOpen, setIsCustomFormOpen] = React.useState(false);
  const [isCustomDeleteOpen, setIsCustomDeleteOpen] = React.useState(false);
  const [selectedCustomBill, setSelectedCustomBill] = React.useState(null);
  const [customForm, setCustomForm] = React.useState({
    title: "",
    amount: "",
    notes: ""
  });
  const [customFormErrors, setCustomFormErrors] = React.useState({});
  const [apiError, setApiError] = React.useState("");
  const [savingCustom, setSavingCustom] = React.useState(false);

  const fetchBills = async () => {
    setLoading(true);
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/bills?month=${currentMonth}`);
      if (response.ok) {
        const data = await response.json();
        setBills({
          water: data.water,
          electricity: data.electricity,
          gas: data.gas,
          wifi: data.wifi,
          other: data.other
        });
      }
    } catch (error) {
      console.error("Failed to load bills", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomBills = async () => {
    try {
      const response = await fetch(`/api/bills/custom?month=${currentMonth}`);
      if (response.ok) {
        const data = await response.json();
        setCustomBills(data);
      }
    } catch (error) {
      console.error("Failed to load custom bills", error);
    }
  };

  React.useEffect(() => {
    fetchBills();
    fetchCustomBills();
  }, [currentMonth]);

  const handleAddCustomClick = () => {
    setSelectedCustomBill(null);
    setCustomForm({ title: "", amount: "", notes: "" });
    setCustomFormErrors({});
    setApiError("");
    setIsCustomFormOpen(true);
  };

  const handleEditCustomClick = (bill) => {
    setSelectedCustomBill(bill);
    setCustomForm({
      title: bill.title,
      amount: bill.amount.toString(),
      notes: bill.notes || ""
    });
    setCustomFormErrors({});
    setApiError("");
    setIsCustomFormOpen(true);
  };

  const handleDeleteCustomClick = (bill) => {
    setSelectedCustomBill(bill);
    setIsCustomDeleteOpen(true);
  };

  const handleCustomChange = (e) => {
    const { name, value } = e.target;
    setCustomForm(prev => ({ ...prev, [name]: value }));
    if (customFormErrors[name]) {
      setCustomFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateCustomForm = () => {
    const newErrors = {};
    if (!customForm.title.trim()) {
      newErrors.title = "Title is required";
    } else if (customForm.title.trim().length < 2) {
      newErrors.title = "Title must be at least 2 characters";
    }

    const parsedAmount = parseFloat(customForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = "Amount must be a positive number";
    }

    setCustomFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!validateCustomForm()) return;

    setSavingCustom(true);
    setApiError("");

    const url = selectedCustomBill ? `/api/bills/custom/${selectedCustomBill.id}` : "/api/bills/custom";
    const method = selectedCustomBill ? "PUT" : "POST";

    const payload = {
      ...(selectedCustomBill ? {} : { month: currentMonth }),
      title: customForm.title.trim(),
      amount: parseFloat(customForm.amount),
      notes: customForm.notes.trim() || null
    };

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsCustomFormOpen(false);
        fetchCustomBills();
      } else {
        const errorData = await response.json();
        setApiError(errorData.error || "Failed to save custom bill.");
      }
    } catch (error) {
      setApiError("Network connection error. Please try again.");
    } finally {
      setSavingCustom(false);
    }
  };

  const handleConfirmCustomDelete = async () => {
    if (!selectedCustomBill) return;
    try {
      const response = await fetch(`/api/bills/custom/${selectedCustomBill.id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setIsCustomDeleteOpen(false);
        fetchCustomBills();
      }
    } catch (error) {
      console.error("Failed to delete custom bill", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const numberValue = value === "" ? 0 : parseFloat(value);
    
    setBills(prev => ({
      ...prev,
      [name]: numberValue
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(bills).forEach(key => {
      if (bills[key] < 0 || isNaN(bills[key])) {
        newErrors[key] = "Value must be a positive number";
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setSuccessMessage("");
    
    try {
      const response = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: currentMonth,
          ...bills
        })
      });

      if (response.ok) {
        setSuccessMessage("Utility bills saved successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
      }
    } catch (error) {
      console.error("Failed to save bills", error);
    } finally {
      setSaving(false);
    }
  };

  const totalBills = bills.water + bills.electricity + bills.gas + bills.wifi + bills.other;
  const customBillsTotal = customBills.reduce((sum, item) => sum + item.amount, 0);
  const grandTotal = totalBills + customBillsTotal;

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Monthly Utility Bills</h2>
          <p className="text-sm text-slate-500">Log fixed and variable apartment utility costs to split amongst members.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="w-40 bg-white"
          />
          <Button onClick={handleAddCustomClick} className="gap-2">
            <Plus className="h-4.5 w-4.5" /> Add Custom Bill
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 text-emerald-800 text-sm font-semibold flex items-center gap-2 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/30 dark:text-emerald-455">
          <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
        <div className="space-y-6">
        {/* Bill Entry Card Form */}
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-900 p-6">
            <CardTitle>Bill Breakdown</CardTitle>
            <CardDescription>Enter expenses for {new Date(currentMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                <p className="text-sm text-slate-500 font-medium">Loading bills...</p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Electricity Bill */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-amber-500" /> Electricity Bill (৳)
                    </label>
                    <Input
                      type="number"
                      name="electricity"
                      value={bills.electricity || ""}
                      onChange={handleChange}
                      placeholder="0.00"
                      error={errors.electricity}
                    />
                  </div>

                  {/* Water Bill */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Droplet className="h-4 w-4 text-sky-500" /> Water Bill (৳)
                    </label>
                    <Input
                      type="number"
                      name="water"
                      value={bills.water || ""}
                      onChange={handleChange}
                      placeholder="0.00"
                      error={errors.water}
                    />
                  </div>

                  {/* Gas Bill */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-orange-500" /> Gas Bill (৳)
                    </label>
                    <Input
                      type="number"
                      name="gas"
                      value={bills.gas || ""}
                      onChange={handleChange}
                      placeholder="0.00"
                      error={errors.gas}
                    />
                  </div>

                  {/* WiFi Bill */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Wifi className="h-4 w-4 text-indigo-500" /> WiFi Internet Bill (৳)
                    </label>
                    <Input
                      type="number"
                      name="wifi"
                      value={bills.wifi || ""}
                      onChange={handleChange}
                      placeholder="0.00"
                      error={errors.wifi}
                    />
                  </div>

                  {/* Other Shared Bills */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <MoreHorizontal className="h-4 w-4 text-slate-500" /> Other Bills (৳)
                    </label>
                    <Input
                      type="number"
                      name="other"
                      value={bills.other || ""}
                      onChange={handleChange}
                      placeholder="0.00"
                      error={errors.other}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-900 flex justify-end">
                  <Button type="submit" disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Utility Bills"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Custom Bills Card */}
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-900 p-6">
            <CardTitle>Custom Bills</CardTitle>
            <CardDescription>
              Additional named bills for {new Date(currentMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })} split equally among active members.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {customBills.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-200">No custom bills yet</h3>
                <p className="mt-1 text-xs text-slate-500">Add bills like building service charge, dustbin fee, or any other shared cost.</p>
                <Button onClick={handleAddCustomClick} variant="outline" size="sm" className="mt-4 gap-1.5">
                  <Plus className="h-4 w-4" /> Add your first custom bill
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {customBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {bill.title}
                        </span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                          ৳{bill.amount.toFixed(2)}
                        </span>
                      </div>
                      {bill.notes && (
                        <p className="text-xs text-slate-500 italic mt-0.5 truncate">{bill.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        onClick={() => handleEditCustomClick(bill)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                        title="Edit custom bill"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteCustomClick(bill)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete custom bill"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Sum sidebar summary card */}
        <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/20 dark:to-slate-950">
          <CardHeader>
            <CardTitle className="text-sm uppercase font-bold text-slate-500 tracking-wider">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <span className="text-xs text-slate-400 font-semibold block">TOTAL MONTHLY BILLS</span>
              <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                ৳{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="border-t border-slate-100 dark:border-slate-900 pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-500">Utility Total</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">৳{totalBills.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-500">Custom Bills ({customBills.length})</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">৳{customBillsTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-lg text-[10px] text-blue-750 dark:text-blue-400 font-medium flex gap-2 border border-blue-100/50 dark:border-blue-950/50">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />
              <span>These values are divided equally among active members in the Settlement Report. Make sure status variables (Active/Inactive) are set correctly before viewing reports.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Custom Bill Dialog */}
      <Dialog open={isCustomFormOpen} onOpenChange={setIsCustomFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCustomBill ? "Edit Custom Bill" : "Create Custom Bill"}</DialogTitle>
            <DialogDescription>
              {selectedCustomBill
                ? "Make changes to this custom bill below."
                : `Add a new custom bill for ${new Date(currentMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" })}. It will be split equally among active members.`}
            </DialogDescription>
          </DialogHeader>

          {apiError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-2 border border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleCustomSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bill Title</label>
              <Input
                name="title"
                value={customForm.title}
                onChange={handleCustomChange}
                placeholder="e.g. Building Service Charge"
                error={customFormErrors.title}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amount (৳)</label>
              <Input
                type="number"
                step="0.01"
                name="amount"
                value={customForm.amount}
                onChange={handleCustomChange}
                placeholder="0.00"
                error={customFormErrors.amount}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notes (Optional)</label>
              <Input
                name="notes"
                value={customForm.notes}
                onChange={handleCustomChange}
                placeholder="Add bill reference or comments..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCustomFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingCustom}>
                {savingCustom ? "Saving..." : selectedCustomBill ? "Save changes" : "Create Custom Bill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Custom Bill Confirmation Dialog */}
      <Dialog open={isCustomDeleteOpen} onOpenChange={setIsCustomDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" /> Danger: Delete Custom Bill
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedCustomBill?.title}</strong> (৳{parseFloat(selectedCustomBill?.amount || 0).toFixed(2)})?
              This will remove it from the monthly bill split.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmCustomDelete}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
