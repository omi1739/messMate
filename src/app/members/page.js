"use client";

import * as React from "react";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Archive, 
  User, 
  Phone, 
  Home, 
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function MembersPage() {
  const [members, setMembers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  
  // Dialog States
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState(null);
  
  // Form State
  const [formData, setFormData] = React.useState({
    name: "",
    phone: "",
    joiningDate: new Date().toISOString().split("T")[0],
    status: "ACTIVE",
    photoUrl: "",
    rent: "0"
  });
  const [formErrors, setFormErrors] = React.useState({});
  const [apiError, setApiError] = React.useState("");

  // Fetch Members
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/members");
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to fetch members", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMembers();
  }, []);

  // Open Form for Add
  const handleAddClick = () => {
    setSelectedMember(null);
    setFormData({
      name: "",
      phone: "",
      joiningDate: new Date().toISOString().split("T")[0],
      status: "ACTIVE",
      photoUrl: "",
      rent: "0"
    });
    setFormErrors({});
    setApiError("");
    setIsFormOpen(true);
  };

  // Open Form for Edit
  const handleEditClick = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      phone: member.phone,
      joiningDate: new Date(member.joiningDate).toISOString().split("T")[0],
      status: member.status,
      photoUrl: member.photoUrl || "",
      rent: (member.rent || 0).toString()
    });
    setFormErrors({});
    setApiError("");
    setIsFormOpen(true);
  };

  // Open Delete Confirmation
  const handleDeleteClick = (member) => {
    setSelectedMember(member);
    setIsDeleteOpen(true);
  };

  // Handle Form Input Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Validate Form
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    else if (formData.name.length < 2) errors.name = "Name must be at least 2 characters";

    if (!formData.phone.trim()) errors.phone = "Phone number is required";
    else if (!/^\d{10,15}$/.test(formData.phone.trim().replace(/[-+() ]/g, ""))) {
      errors.phone = "Provide a valid phone number (10 to 15 digits)";
    }

    if (!formData.joiningDate) errors.joiningDate = "Joining date is required";

    const rentVal = parseFloat(formData.rent);
    if (isNaN(rentVal) || rentVal < 0) {
      errors.rent = "Rent must be a positive number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Add or Edit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setApiError("");
    const url = selectedMember ? `/api/members/${selectedMember.id}` : "/api/members";
    const method = selectedMember ? "PUT" : "POST";

    const payload = {
      ...formData,
      rent: parseFloat(formData.rent) || 0
    };

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsFormOpen(false);
        fetchMembers();
      } else {
        const errorData = await response.json();
        setApiError(errorData.error || "Failed to save member details.");
      }
    } catch (error) {
      setApiError("Network connection error. Please try again.");
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedMember) return;

    try {
      const response = await fetch(`/api/members/${selectedMember.id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setIsDeleteOpen(false);
        fetchMembers();
      }
    } catch (error) {
      console.error("Failed to delete member", error);
    }
  };

  // Archive Member (Shortcut toggle status to ARCHIVED)
  const handleArchiveClick = async (member) => {
    const newStatus = member.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        fetchMembers();
      }
    } catch (error) {
      console.error("Failed to archive member", error);
    }
  };

  // Filtered members list
  const filteredMembers = members.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(query) ||
      member.phone.includes(query)
    );
  });

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Members Directory</h2>
          <p className="text-sm text-slate-500">Manage all student mess members, rooms, and active statuses.</p>
        </div>
        <Button onClick={handleAddClick} className="gap-2 self-start md:self-auto">
          <Plus className="h-4.5 w-4.5" /> Add Member
        </Button>
      </div>

      {/* Directory Content */}
      <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-900 p-6 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Mess Members</CardTitle>
            <CardDescription>A total of {members.length} members registered.</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-full rounded-lg border border-slate-200 bg-white text-xs placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 focus-visible:border-transparent dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
              <p className="text-sm text-slate-500 font-medium">Loading member directory...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-20">
              <User className="mx-auto h-12 w-12 text-slate-350 dark:text-slate-700" />
              <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-200">No members found</h3>
              <p className="mt-1 text-sm text-slate-500">Try searching another query or add a new member.</p>
              <Button onClick={handleAddClick} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Add your first member
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member Name</TableHead>
                
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-semibold text-slate-900 dark:text-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-700 dark:text-violet-400 font-bold text-sm">
                          {member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span>{member.name}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-650 dark:text-slate-350">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{member.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-650 dark:text-slate-350">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{new Date(member.joiningDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : member.status === "INACTIVE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
                          <XCircle className="h-3 w-3" /> Inactive
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40">
                          <Archive className="h-3 w-3" /> Archived
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          onClick={() => handleEditClick(member)}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                          title="Edit Member"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => handleArchiveClick(member)}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          title={member.status === "ARCHIVED" ? "Activate Member" : "Archive Member"}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button 
                          onClick={() => handleDeleteClick(member)}
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Member"
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

      {/* Add/Edit Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMember ? "Edit Member Profile" : "Add New Member"}</DialogTitle>
            <DialogDescription>
              {selectedMember ? "Modify member details below. Make sure room information is correct." : "Fill out details to register a new member in the mess."}
            </DialogDescription>
          </DialogHeader>

          {apiError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-2 border border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/30 dark:text-rose-450">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Full Name</label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter member's full name"
                error={formErrors.name}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Phone Number</label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. 01712345678"
                error={formErrors.phone}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Monthly Rent (৳)</label>
              <Input
                type="number"
                step="0.01"
                name="rent"
                value={formData.rent}
                onChange={handleChange}
                placeholder="0.00"
                error={formErrors.rent}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Joining Date</label>
                <Input
                  type="date"
                  name="joiningDate"
                  value={formData.joiningDate}
                  onChange={handleChange}
                  error={formErrors.joiningDate}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-350">Status</label>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant={selectedMember ? "success" : "default"}>
                {selectedMember ? "Save Changes" : "Register Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" /> Danger: Delete Member
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{selectedMember?.name}</strong>? 
              This action will delete all their historical meal logs and cannot be undone.
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
