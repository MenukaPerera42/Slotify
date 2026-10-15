"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  Users,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  listDepartmentsAction,
  createDepartmentAction,
  updateDepartmentAction,
  setDepartmentStatusAction,
  deleteDepartmentAction,
} from "@/features/departments/actions/department-actions";

export interface DepartmentListItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  _count: {
    users: number;
    reservations: number;
    previousCorrections: number;
    newCorrections: number;
  };
}

export function AdminDepartments() {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // Search & Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);

  // Data state
  const [departments, setDepartments] = useState<DepartmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentListItem | null>(null);
  const [statusTarget, setStatusTarget] = useState<DepartmentListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentListItem | null>(null);
  const [deleteErrorFeedback, setDeleteErrorFeedback] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    isActive: true,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Load departments
  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listDepartmentsAction({
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize: 50,
      });
      if (res.success) {
        setDepartments(res.data.items as DepartmentListItem[]);
        setTotal(res.data.total);
      } else {
        toast.error(res.error || "Failed to load departments.");
      }
    } catch {
      toast.error("Failed to load departments.");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, page, toast]);

  useEffect(() => {
    let isCurrent = true;
    listDepartmentsAction({
      search: search.trim() || undefined,
      status: statusFilter,
      page,
      pageSize: 50,
    })
      .then((res) => {
        if (!isCurrent) return;
        if (res.success) {
          setDepartments(res.data.items as DepartmentListItem[]);
          setTotal(res.data.total);
        } else {
          toast.error(res.error || "Failed to load departments.");
        }
      })
      .catch(() => {
        if (isCurrent) toast.error("Failed to load departments.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [search, statusFilter, page, toast]);

  // Metric counts
  const activeCount = departments.filter((d) => d.isActive).length;
  const inactiveCount = departments.filter((d) => !d.isActive).length;
  const totalAssignedUsers = departments.reduce((acc, d) => acc + d._count.users, 0);

  // Open Add Modal
  const openAddModal = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      isActive: true,
    });
    setFieldErrors({});
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (dept: DepartmentListItem) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || "",
      isActive: dept.isActive,
    });
    setFieldErrors({});
    setFormError(null);
  };

  // Handle Create
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const res = await createDepartmentAction({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
      });

      if (res.success) {
        toast.success(`Department "${res.data.name}" created successfully.`);
        setIsAddModalOpen(false);
        fetchDepartments();
        router.refresh();
      } else {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        setFormError(res.error || "Failed to create department.");
        toast.error(res.error || "Failed to create department.");
      }
    });
  };

  // Handle Update
  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const res = await updateDepartmentAction(editingDept.id, {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
      });

      if (res.success) {
        // Also update status if changed
        if (editingDept.isActive !== formData.isActive) {
          const statusRes = await setDepartmentStatusAction({
            id: editingDept.id,
            isActive: formData.isActive,
          });
          if (!statusRes.success) {
            toast.error(statusRes.error || "Failed to update department status.");
          }
        }
        toast.success(`Department "${res.data.name}" updated successfully.`);
        setEditingDept(null);
        fetchDepartments();
        router.refresh();
      } else {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        setFormError(res.error || "Failed to update department.");
        toast.error(res.error || "Failed to update department.");
      }
    });
  };

  // Handle Status Toggle
  const handleToggleStatus = async () => {
    if (!statusTarget) return;

    startTransition(async () => {
      const newStatus = !statusTarget.isActive;
      const res = await setDepartmentStatusAction({
        id: statusTarget.id,
        isActive: newStatus,
      });

      if (res.success) {
        toast.success(
          `Department "${statusTarget.name}" ${newStatus ? "activated" : "deactivated"} successfully.`
        );
        setStatusTarget(null);
        fetchDepartments();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to change department status.");
      }
    });
  };

  // Handle Delete
  const handleDeleteDepartment = async () => {
    if (!deleteTarget) return;
    setDeleteErrorFeedback(null);

    startTransition(async () => {
      const res = await deleteDepartmentAction(deleteTarget.id);

      if (res.success) {
        toast.success(`Department "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget(null);
        fetchDepartments();
        router.refresh();
      } else {
        if (res.code === "IN_USE") {
          setDeleteErrorFeedback(
            `This department cannot be deleted because it is associated with ${deleteTarget._count.users} user(s) or past reservation records. Deactivate it instead to prevent new bookings while preserving audit integrity.`
          );
        } else {
          setDeleteErrorFeedback(res.error || "Failed to delete department.");
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Departments</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inactive</span>
            <AlertTriangle className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{inactiveCount}</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Assigned Members</span>
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalAssignedUsers}</p>
        </div>
      </div>

      {/* Toolbar: Search, Filters & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by department name or code..."
              className="h-9 w-full rounded-xl border border-slate-200/80 bg-white pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all",
                  statusFilter === status
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {status === "ALL" ? "All" : status === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>

        {/* Add Department Button */}
        <Button
          type="button"
          onClick={openAddModal}
          className="h-9 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add Department</span>
        </Button>
      </div>

      {/* Departments Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading organizational departments...</span>
          </div>
        ) : departments.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-2">
            <Building2 className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">No departments found</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              {search
                ? `No departments matched your query "${search}". Try resetting the search.`
                : "Get started by adding your first organizational department."}
            </p>
            {search && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearch("")}
                className="mt-2 text-xs"
              >
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Members</th>
                  <th className="py-3 px-3 text-center">Reservations</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Department Name & Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{dept.name}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {dept.code}
                        </span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-3 max-w-xs truncate text-slate-500">
                      {dept.description || <span className="text-slate-300 italic">—</span>}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                          dept.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            dept.isActive ? "bg-emerald-500" : "bg-slate-400"
                          )}
                        />
                        {dept.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Users Count */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {dept._count.users}
                      </span>
                    </td>

                    {/* Reservations Count */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {dept._count.reservations}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(dept)}
                          title="Edit department"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Status Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setStatusTarget(dept)}
                          title={dept.isActive ? "Deactivate department" : "Activate department"}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            dept.isActive
                              ? "text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                              : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          )}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteErrorFeedback(null);
                            setDeleteTarget(dept);
                          }}
                          title="Delete department"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD DEPARTMENT */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Department"
        description="Register an organizational department for user access and reservation grouping."
      >
        <form onSubmit={handleCreateDepartment} className="space-y-4 pt-1">
          {formError && (
            <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Department Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Engineering & Platform"
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {fieldErrors.name && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {fieldErrors.name[0]}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={12}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. ENG"
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {fieldErrors.code && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {fieldErrors.code[0]}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of department scope and team responsibilities..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
            {fieldErrors.description && (
              <span className="text-[10px] text-rose-500 font-medium block mt-1">
                {fieldErrors.description[0]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="dept-add-active"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="dept-add-active" className="text-xs font-medium text-slate-700 cursor-pointer">
              Active status (visible for user assignment and booking)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Create Department</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT DEPARTMENT */}
      <Modal
        isOpen={Boolean(editingDept)}
        onClose={() => setEditingDept(null)}
        title="Edit Department"
        description="Update department details and operational status."
      >
        <form onSubmit={handleUpdateDepartment} className="space-y-4 pt-1">
          {formError && (
            <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Department Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {fieldErrors.name && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {fieldErrors.name[0]}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={12}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {fieldErrors.code && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {fieldErrors.code[0]}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
            {fieldErrors.description && (
              <span className="text-[10px] text-rose-500 font-medium block mt-1">
                {fieldErrors.description[0]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="dept-edit-active"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="dept-edit-active" className="text-xs font-medium text-slate-700 cursor-pointer">
              Active status
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingDept(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Changes</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: STATUS TOGGLE CONFIRMATION */}
      <Modal
        isOpen={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.isActive ? "Deactivate Department" : "Activate Department"}
        description={`Confirm status change for ${statusTarget?.name}.`}
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            {statusTarget?.isActive ? (
              <>
                Deactivating <span className="font-bold text-slate-900">{statusTarget.name}</span> will hide it from future member registrations and new reservation bookings. Existing historical reservations remain intact.
                {statusTarget._count.users > 0 && (
                  <span className="block mt-2 font-bold text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    Note: If this department has active team members, reassignment of active users is required before deactivation.
                  </span>
                )}
              </>
            ) : (
              <>
                Activating <span className="font-bold text-slate-900">{statusTarget?.name}</span> will make it immediately available for team member assignment and department-scoped reservations.
              </>
            )}
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleToggleStatus}
              className={cn(
                "gap-1.5 text-white",
                statusTarget?.isActive
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{statusTarget?.isActive ? "Deactivate Department" : "Activate Department"}</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: DELETE CONFIRMATION */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErrorFeedback(null);
        }}
        title="Delete Department"
        description={`Confirm deletion for ${deleteTarget?.name}.`}
      >
        <div className="space-y-4 pt-1">
          {deleteErrorFeedback ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{deleteErrorFeedback}</p>
              </div>
              <div className="pt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={async () => {
                    if (!deleteTarget) return;
                    const res = await setDepartmentStatusAction({
                      id: deleteTarget.id,
                      isActive: false,
                    });
                    if (res.success) {
                      toast.success(`Department "${deleteTarget.name}" deactivated.`);
                      setDeleteTarget(null);
                      setDeleteErrorFeedback(null);
                      fetchDepartments();
                      router.refresh();
                    } else {
                      toast.error(res.error || "Failed to deactivate department.");
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>Deactivate Instead</span>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-slate-900">{deleteTarget?.name}</span> (
              {deleteTarget?.code})? This action cannot be undone. Only departments with zero linked members and no historical reservations can be deleted.
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteErrorFeedback(null);
              }}
            >
              Cancel
            </Button>
            {!deleteErrorFeedback && (
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleDeleteDepartment}
                className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Delete Department</span>
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
