"use client";

import * as React from "react";
import { 
  Printer, 
  Download, 
  Calculator, 
  User, 
  Calendar,
  Layers,
  UtensilsCrossed,
  Info,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function ReportsPage() {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  const [report, setReport] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  
  // Payment edit states
  const [editingPayments, setEditingPayments] = React.useState({});
  const [savingPayments, setSavingPayments] = React.useState(false);
  const [paymentSuccess, setPaymentSuccess] = React.useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports?month=${currentMonth}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        
        // Pre-fill editingPayments with currently saved database values
        const initialPayments = {};
        data.memberBreakdowns.forEach((m) => {
          initialPayments[m.id] = m.costs.paidAmount;
        });
        setEditingPayments(initialPayments);
      }
    } catch (error) {
      console.error("Failed to load report", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReport();
  }, [currentMonth]);

  const handlePaymentChange = (memberId, value) => {
    const floatVal = value === "" ? 0 : parseFloat(value);
    setEditingPayments(prev => ({
      ...prev,
      [memberId]: isNaN(floatVal) ? 0 : floatVal
    }));
  };

  const handleSavePayments = async () => {
    setSavingPayments(true);
    setPaymentSuccess(false);
    try {
      const payload = Object.entries(editingPayments).map(([memberId, amount]) => ({
        memberId,
        amount
      }));

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: currentMonth,
          payments: payload
        })
      });

      if (response.ok) {
        setPaymentSuccess(true);
        setTimeout(() => setPaymentSuccess(false), 3000);
        // Reload report data to recalculate dues
        fetchReport();
      }
    } catch (error) {
      console.error("Failed to save payments", error);
    } finally {
      setSavingPayments(false);
    }
  };

  // Dialog States
  const [payMember, setPayMember] = React.useState(null);
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);
  const [paymentForm, setPaymentForm] = React.useState({
    rentPaid: 0,
    mealPaid: 0,
    utilityPaid: 0
  });
  const [savingPayment, setSavingPayment] = React.useState(false);

  const handlePayClick = (member) => {
    setPayMember(member);
    setPaymentForm({
      rentPaid: member.costs.rentPaid || 0,
      mealPaid: member.costs.mealPaid || 0,
      utilityPaid: member.costs.utilityPaid || 0
    });
    setIsPayModalOpen(true);
  };

  const handlePaymentFormChange = (e) => {
    const { name, value } = e.target;
    const numVal = value === "" ? 0 : parseFloat(value);
    setPaymentForm(prev => ({
      ...prev,
      [name]: isNaN(numVal) ? 0 : numVal
    }));
  };

  const handleSavePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!payMember) return;
    setSavingPayment(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: currentMonth,
          payments: [
            {
              memberId: payMember.id,
              rentPaid: paymentForm.rentPaid,
              mealPaid: paymentForm.mealPaid,
              utilityPaid: paymentForm.utilityPaid
            }
          ]
        })
      });

      if (response.ok) {
        setIsPayModalOpen(false);
        fetchReport();
      }
    } catch (error) {
      console.error("Failed to save payment", error);
    } finally {
      setSavingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getMonthName = () => {
    return new Date(currentMonth + "-02").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="flex-1 p-8 space-y-6 print:p-0 print:bg-white print:text-black">
      {/* Page Header (Hidden on print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Settlement Report</h2>
          <p className="text-sm text-slate-500">Calculate meal rates, input payments, and view outstanding member dues.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="w-40 bg-white"
          />
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="h-4.5 w-4.5" /> Print Report
          </Button>
        </div>
      </div>

      {/* Print-Only Invoice Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">MESSMATE BILL REPORT</h1>
            <p className="text-sm font-semibold text-slate-700">Billing Month: {getMonthName()}</p>
            <p className="text-xs text-slate-500">Generated on: {new Date().toLocaleDateString("en-US")}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-900">Mess Manager</h2>
            <p className="text-xs text-slate-500">Shared Expense System</p>
            <p className="text-[10px] text-slate-400">Bangladesh</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 print:hidden">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          <p className="text-sm text-slate-500 font-medium">Calculating settlement details...</p>
        </div>
      ) : !report ? (
        <p className="text-center text-sm py-20 text-slate-500 print:hidden">No report details available.</p>
      ) : (
        <div className="space-y-6">
          {/* Summary KPI Panel (Print version has clean list, web version has cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
            {/* Meal Rate Card */}
            <Card className="border-violet-100 bg-gradient-to-br from-violet-50/50 to-white dark:from-slate-950 dark:to-slate-950 print:border-slate-300 print:bg-none print:shadow-none">
              <CardHeader className="pb-1.5 p-4">
                <CardDescription className="text-[10px] font-bold text-violet-600 uppercase print:text-black">Meal Rate</CardDescription>
                <CardTitle className="text-2xl font-black text-violet-950 dark:text-violet-300 print:text-black">
                  ৳{report.summary.mealRate.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[10px] text-slate-500 p-4 pt-0 print:text-slate-700">
                ৳{report.summary.totalBazarExpense.toFixed(0)} Bazar / {report.summary.totalMeals.toFixed(1)} Meals
              </CardContent>
            </Card>

            {/* Rent Share Card */}
            <Card className="border-sky-100 bg-gradient-to-br from-sky-50/50 to-white dark:from-slate-950 dark:to-slate-950 print:border-slate-300 print:bg-none print:shadow-none">
              <CardHeader className="pb-1.5 p-4">
                <CardDescription className="text-[10px] font-bold text-sky-600 uppercase print:text-black">Total Rent</CardDescription>
                <CardTitle className="text-2xl font-black text-sky-950 dark:text-sky-300 print:text-black">
                  ৳{report.summary.bills.rent.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[10px] text-slate-500 p-4 pt-0 print:text-slate-700">
                Sum of active members' rent
              </CardContent>
            </Card>

            {/* Utilities Share Card */}
            <Card className="border-amber-100 bg-gradient-to-br from-amber-50/50 to-white dark:from-slate-950 dark:to-slate-950 print:border-slate-300 print:bg-none print:shadow-none">
              <CardHeader className="pb-1.5 p-4">
                <CardDescription className="text-[10px] font-bold text-amber-600 uppercase print:text-black">Utilities Share</CardDescription>
                <CardTitle className="text-2xl font-black text-amber-950 dark:text-amber-300 print:text-black">
                  ৳{report.summary.bills.individualUtilityShare.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[10px] text-slate-500 p-4 pt-0 print:text-slate-700">
                ৳{report.summary.bills.utilities.toFixed(0)} total bill split equally
                {report.summary.bills.customBillsTotal > 0 && (
                  <span className="block mt-0.5">
                    includes {report.summary.bills.customBills.length} custom bill{report.summary.bills.customBills.length > 1 ? "s" : ""} (৳{report.summary.bills.customBillsTotal.toFixed(0)})
                  </span>
                )}
              </CardContent>
            </Card>

            {/* Other Shared Expenses Card */}
            <Card className="border-slate-100 bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-950 print:border-slate-300 print:bg-none print:shadow-none">
              <CardHeader className="pb-1.5 p-4">
                <CardDescription className="text-[10px] font-bold text-slate-600 uppercase print:text-black">Other Shared Cost</CardDescription>
                <CardTitle className="text-2xl font-black text-slate-800 dark:text-slate-300 print:text-black">
                  ৳{report.summary.bills.otherSharedShare.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[10px] text-slate-500 p-4 pt-0 print:text-slate-700">
                ৳{report.summary.otherSharedExpense.toFixed(0)} non-bazar ledger total
              </CardContent>
            </Card>
          </div>

          {/* Breakdown List Table */}
          <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm print:border-slate-300 print:shadow-none overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-900 p-6 print:p-4">
              <CardTitle className="print:text-lg">Detailed Billing Ledger</CardTitle>
              <CardDescription className="print:text-xs text-slate-500">
                Individual cost distributions. Click <strong>Pay Bill</strong> next to any member to log payments (Rent, Meals, Utilities) and calculate outstanding dues.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="print:border-collapse">
                <TableHeader>
                  <TableRow className="print:bg-slate-100">
                    <TableHead className="font-bold print:text-black">Member Name</TableHead>
                    <TableHead className="font-bold print:text-black">Meal Count</TableHead>
                    <TableHead className="font-bold print:text-black">Meal Cost</TableHead>
                    <TableHead className="font-bold print:text-black">Rent Share</TableHead>
                    <TableHead className="font-bold print:text-black">Utility Share</TableHead>
                    <TableHead className="font-bold print:text-black">Other Shared</TableHead>
                    <TableHead className="font-bold print:text-black">Total Bill</TableHead>
                    <TableHead className="font-bold print:text-black">Paid Amount</TableHead>
                    <TableHead className="font-bold print:text-black">Remaining Due</TableHead>
                    <TableHead className="font-bold text-right print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.memberBreakdowns.map((member) => (
                    <TableRow key={member.id} className="print:border-b print:border-slate-200">
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-200 print:text-black">
                        {member.name}
                        {member.status !== "ACTIVE" && (
                          <span className="ml-1.5 text-[9px] text-slate-400 border border-slate-200 rounded px-1 font-medium print:text-slate-700">
                            {member.status}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="print:text-black">{member.mealsCount.total.toFixed(1)}</TableCell>
                      <TableCell className="print:text-black">৳{member.costs.mealCost.toFixed(2)}</TableCell>
                      <TableCell className="print:text-black">৳{member.costs.rentShare.toFixed(2)}</TableCell>
                      <TableCell className="print:text-black">৳{member.costs.utilityShare.toFixed(2)}</TableCell>
                      <TableCell className="print:text-black">৳{member.costs.otherSharedShare.toFixed(2)}</TableCell>
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                        ৳{member.costs.totalBill.toFixed(2)}
                      </TableCell>
                      <TableCell className="print:text-black font-semibold text-slate-700 dark:text-slate-350">
                        ৳{member.costs.paidAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className={`font-bold print:text-black ${
                        member.costs.remainingDue > 0.01 
                          ? "text-rose-650 dark:text-rose-450" 
                          : "text-emerald-650 dark:text-emerald-450"
                      }`}>
                        ৳{member.costs.remainingDue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right print:hidden">
                        <Button 
                          onClick={() => handlePayClick(member)}
                          variant="outline" 
                          size="sm"
                          className="h-8 border-slate-200 dark:border-slate-800 hover:bg-violet-50 hover:text-violet-650 dark:hover:bg-violet-950/40"
                        >
                          Pay Bill
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="print:bg-slate-100">
                  <TableRow>
                    <TableCell className="font-bold print:text-black">Total Mess Costs</TableCell>
                    <TableCell className="font-bold print:text-black">
                      {report.memberBreakdowns.reduce((sum, m) => sum + m.mealsCount.total, 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="font-bold print:text-black">
                      ৳{report.memberBreakdowns.reduce((sum, m) => sum + m.costs.mealCost, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold print:text-black">
                      ৳{report.memberBreakdowns.reduce((sum, m) => sum + m.costs.rentShare, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold print:text-black">
                      ৳{report.memberBreakdowns.reduce((sum, m) => sum + m.costs.utilityShare, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold print:text-black">
                      ৳{report.memberBreakdowns.reduce((sum, m) => sum + m.costs.otherSharedShare, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                      ৳{report.memberBreakdowns.reduce((sum, m) => sum + m.costs.totalBill, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold print:text-black">
                      ৳{report.memberBreakdowns.reduce((sum, m) => sum + m.costs.paidAmount, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-bold text-violet-850 dark:text-violet-400 print:text-black">
                      ৳{report.memberBreakdowns.reduce((sum, m) => sum + m.costs.remainingDue, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="print:hidden"></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Printable signature fields */}
          <div className="hidden print:flex justify-between mt-24 pt-8">
            <div className="text-center w-48 border-t border-slate-900 pt-1.5 text-xs font-semibold text-slate-800">
              Mess Manager Signature
            </div>
            <div className="text-center w-48 border-t border-slate-900 pt-1.5 text-xs font-semibold text-slate-800">
              Audit Representative
            </div>
          </div>

          {/* Pay Modal Dialog */}
          <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
            <DialogContent className="max-w-md">
              {payMember && (
                <>
                  <DialogHeader>
                    <DialogTitle>Record Payment</DialogTitle>
                    <DialogDescription>
                      Log payments received for <strong>{payMember.name}</strong> for {getMonthName()}.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSavePaymentSubmit} className="space-y-4 py-2">
                    {/* Rent Split */}
                    <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Monthly Rent Bill</span>
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">৳{payMember.costs.rentShare.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="checkbox"
                          id="rentPaidCheckbox"
                          checked={paymentForm.rentPaid >= (payMember.costs.rentShare || 0) && (payMember.costs.rentShare || 0) > 0}
                          onChange={(e) => {
                            setPaymentForm(prev => ({
                              ...prev,
                              rentPaid: e.target.checked ? (payMember.costs.rentShare || 0) : 0
                            }));
                          }}
                          className="rounded border-slate-350 h-4 w-4 text-violet-650 focus:ring-violet-500 accent-violet-600 cursor-pointer"
                        />
                        <label htmlFor="rentPaidCheckbox" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                          Mark Rent Paid
                        </label>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block">Custom Rent Paid (৳)</label>
                        <Input
                          type="number"
                          step="0.01"
                          name="rentPaid"
                          value={paymentForm.rentPaid === 0 ? "" : paymentForm.rentPaid}
                          onChange={handlePaymentFormChange}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Meal Split */}
                    <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Meal Money Bill</span>
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">৳{payMember.costs.mealCost.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="checkbox"
                          id="mealPaidCheckbox"
                          checked={paymentForm.mealPaid >= (payMember.costs.mealCost || 0) && (payMember.costs.mealCost || 0) > 0}
                          onChange={(e) => {
                            setPaymentForm(prev => ({
                              ...prev,
                              mealPaid: e.target.checked ? (payMember.costs.mealCost || 0) : 0
                            }));
                          }}
                          className="rounded border-slate-350 h-4 w-4 text-violet-650 focus:ring-violet-500 accent-violet-600 cursor-pointer"
                        />
                        <label htmlFor="mealPaidCheckbox" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                          Mark Meal Paid
                        </label>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block">Custom Meal Paid (৳)</label>
                        <Input
                          type="number"
                          step="0.01"
                          name="mealPaid"
                          value={paymentForm.mealPaid === 0 ? "" : paymentForm.mealPaid}
                          onChange={handlePaymentFormChange}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Utility Split */}
                    <div className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Utilities & Shared Bill</span>
                        <span className="font-extrabold text-slate-900 dark:text-slate-100">
                          ৳{( (payMember.costs.utilityShare || 0) + (payMember.costs.otherSharedShare || 0) ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="checkbox"
                          id="utilityPaidCheckbox"
                          checked={paymentForm.utilityPaid >= ((payMember.costs.utilityShare || 0) + (payMember.costs.otherSharedShare || 0)) && ((payMember.costs.utilityShare || 0) + (payMember.costs.otherSharedShare || 0)) > 0}
                          onChange={(e) => {
                            const fullVal = (payMember.costs.utilityShare || 0) + (payMember.costs.otherSharedShare || 0);
                            setPaymentForm(prev => ({
                              ...prev,
                              utilityPaid: e.target.checked ? fullVal : 0
                            }));
                          }}
                          className="rounded border-slate-350 h-4 w-4 text-violet-650 focus:ring-violet-500 accent-violet-600 cursor-pointer"
                        />
                        <label htmlFor="utilityPaidCheckbox" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                          Mark Utilities Paid
                        </label>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block">Custom Utility Paid (৳)</label>
                        <Input
                          type="number"
                          step="0.01"
                          name="utilityPaid"
                          value={paymentForm.utilityPaid === 0 ? "" : paymentForm.utilityPaid}
                          onChange={handlePaymentFormChange}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Modal Footer Info */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div>
                        <span>Total Paid: </span>
                        <span className="font-black text-slate-900 dark:text-white">
                          ৳{(paymentForm.rentPaid + paymentForm.mealPaid + paymentForm.utilityPaid).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span>Due: </span>
                        <span className={`font-black ${
                          ( (payMember.costs.totalBill || 0) - (paymentForm.rentPaid + paymentForm.mealPaid + paymentForm.utilityPaid) ) > 0.01
                            ? "text-rose-600"
                            : "text-emerald-600"
                        }`}>
                          ৳{Math.max(0, (payMember.costs.totalBill || 0) - (paymentForm.rentPaid + paymentForm.mealPaid + paymentForm.utilityPaid)).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <DialogFooter className="pt-2">
                      <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={savingPayment}>
                        {savingPayment ? "Saving..." : "Save Payment"}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
