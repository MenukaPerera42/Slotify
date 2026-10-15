"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Edit2,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  createMemberAction,
  updateUserProfileAction,
  setUserRoleAction,
  setUserActiveAction,
} from "@/features/admin-users/actions/admin-user-actions";

import { assignUserDepartmentAction } from "@/features/departments/actions/department-actions";
import {
  listUnassignedReservationsAction,
  correctReservationDepartmentAction,
} from "@/features/reservations/actions/reservation-actions";
import { formatColomboInterval, formatColomboDate } from "@/features/reservations/utils/client-date";
import { AdminOfficeShifts } from "@/features/office-shifts/components/admin-office-shifts";
import { AdminDepartments } from "@/features/departments/components/admin-departments";
import { AdminCategories } from "@/features/resources/components/admin-categories";

export interface AdminUserRecord {
  id: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: "ADMIN" | "MEMBER";
  isActive: boolean;
  departmentId: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
    isActive?: boolean;
  } | null;
  createdAt?: Date | string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface AdminUserManagerProps {
  users: AdminUserRecord[];
  departments: DepartmentOption[];
  currentAdminId: string;
  initialUnassignedCount?: number;
}

export function AdminUserManager({
  users,
  departments,
  currentAdminId,
  initialUnassignedCount = 0,
}: AdminUserManagerProps) {
  const router = useRouter();
  const toast = useToast();

  // Navigation tab
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const getInitialTab = (): "users" | "departments" | "categories" | "shifts" | "unassigned" => {
    if (tabParam === "departments") return "departments";
    if (tabParam === "categories") return "categories";
    if (tabParam === "shifts") return "shifts";
    if (tabParam === "unassigned") return "unassigned";
    return "users";
  };

  const [activeTab, setActiveTab] = useState<
    "users" | "departments" | "categories" | "shifts" | "unassigned"
  >(getInitialTab);

  const handleTabChange = (
    tab: "users" | "departments" | "categories" | "shifts" | "unassigned"
  ) => {
    setActiveTab(tab);
    const params = new URLSearchParams(
      searchParams ? Array.from(searchParams.entries()) : []
    );
    if (tab === "users") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.replace(`/administration${query ? `?${query}` : ""}`, { scroll: false });
  };

  // User filters & search
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"ALL" | "ADMIN" | "MEMBER">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [filterDept, setFilterDept] = useState<string>("ALL");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [deptUser, setDeptUser] = useState<AdminUserRecord | null>(null);
  const [roleUser, setRoleUser] = useState<AdminUserRecord | null>(null);
  const [statusUser, setStatusUser] = useState<AdminUserRecord | null>(null);

  // Add Member Form
  const [addForm, setAddForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    departmentId: departments[0]?.id || "",
    initialPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Profile Form
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string[]>>({});

  const [reviewFieldErrors, setReviewFieldErrors] = useState<Record<string, string[]>>({});

  // Change Department Form
  const [targetDeptId, setTargetDeptId] = useState("");

  // Unassigned Bookings state
  const [unassignedReservations, setUnassignedReservations] = useState<Array<{
    id: string;
    title: string;
    status: string;
    startTime: Date | string;
    endTime: Date | string;
    resource: { name: string };
    user: { name: string; email: string } | null;
  }>>([]);
  const [unassignedCount, setUnassignedCount] = useState(initialUnassignedCount);
  const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);
  const [reviewingReservation, setReviewingReservation] = useState<{
    id: string;
    title: string;
    resourceName: string;
    userName?: string;
    userEmail?: string;
    intervalStr: string;
  } | null>(null);
  const [reviewDeptId, setReviewDeptId] = useState("");
  const [reviewReason, setReviewReason] = useState("");

  // Fetch unassigned reservations
  const fetchUnassigned = useCallback(async () => {
    setIsLoadingUnassigned(true);
    try {
      const res = await listUnassignedReservationsAction({ page: 1, pageSize: 50 });
      if (res.success && res.data) {
        setUnassignedReservations(res.data.items);
        setUnassignedCount(res.data.total);
      }
    } catch (err) {
      console.error("Failed to fetch unassigned reservations:", err);
    } finally {
      setIsLoadingUnassigned(false);
    }
  }, []);

  // Derived user statistics
  const totalUsers = users.length;
  const activeUsersCount = users.filter((u) => u.isActive).length;
  const adminUsersCount = users.filter((u) => u.role === "ADMIN").length;
  const unassignedDeptCount = users.filter((u) => !u.departmentId).length;

  // Filter users
  const filteredUsers = users.filter((u) => {
    const displayName = u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name;
    const matchesSearch =
      displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterRole !== "ALL" && u.role !== filterRole) return false;
    if (filterStatus === "ACTIVE" && !u.isActive) return false;
    if (filterStatus === "INACTIVE" && u.isActive) return false;
    if (filterDept === "UNASSIGNED" && u.departmentId) return false;
    if (filterDept !== "ALL" && filterDept !== "UNASSIGNED" && u.departmentId !== filterDept) {
      return false;
    }
    return true;
  });

  // Handle Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await createMemberAction({
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        email: addForm.email.trim(),
        departmentId: addForm.departmentId,
        initialPassword: addForm.initialPassword,
      });

      if (res.success) {
        toast.success("Team member created successfully.");
        setIsAddModalOpen(false);
        setAddForm({
          firstName: "",
          lastName: "",
          email: "",
          departmentId: departments[0]?.id || "",
          initialPassword: "",
        });
        router.refresh();
      } else {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        toast.error(res.error || "Failed to create member.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditUser = useCallback((u: AdminUserRecord) => {
    setEditingUser(u);
    setEditForm({
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      email: u.email,
    });
    setEditFieldErrors({});
  }, []);

  // Handle Edit Profile
  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFieldErrors({});
    setIsSubmitting(true);

    try {
      const isNameChanged =
        editForm.firstName.trim() !== (editingUser.firstName || "") ||
        editForm.lastName.trim() !== (editingUser.lastName || "");
      const isEmailChanged =
        editForm.email.trim() &&
        editForm.email.trim().toLowerCase() !== editingUser.email.toLowerCase();

      if (!isNameChanged && !isEmailChanged) {
        setEditingUser(null);
        return;
      }

      const res = await updateUserProfileAction({
        userId: editingUser.id,
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined,
        email: isEmailChanged ? editForm.email.trim() : undefined,
      });

      if (!res.success) {
        if (res.fieldErrors) {
          setEditFieldErrors(res.fieldErrors);
        }
        toast.error(res.error || "Failed to update profile.");
        setIsSubmitting(false);
        return;
      }

      toast.success("User profile updated successfully.");
      setEditingUser(null);
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Department Assignment
  const handleAssignDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptUser || !targetDeptId) return;
    setIsSubmitting(true);

    try {
      const res = await assignUserDepartmentAction({
        userId: deptUser.id,
        departmentId: targetDeptId,
      });

      if (res.success) {
        toast.success("Department assigned successfully.");
        setDeptUser(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to assign department.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Role Change
  const handleConfirmRoleChange = async () => {
    if (!roleUser) return;
    const newRole = roleUser.role === "ADMIN" ? "MEMBER" : "ADMIN";
    setIsSubmitting(true);

    try {
      const res = await setUserRoleAction({
        userId: roleUser.id,
        role: newRole,
      });

      if (res.success) {
        toast.success(`User role changed to ${newRole}.`);
        setRoleUser(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update role.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Active Status Change
  const handleConfirmStatusChange = async () => {
    if (!statusUser) return;
    const newActiveState = !statusUser.isActive;
    setIsSubmitting(true);

    try {
      const res = await setUserActiveAction({
        userId: statusUser.id,
        isActive: newActiveState,
      });

      if (res.success) {
        toast.success(newActiveState ? "User activated." : "User deactivated.");
        setStatusUser(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update status.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Review Department Correction
  const handleReviewCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReservation || !reviewDeptId) return;
    setIsSubmitting(true);
    setReviewFieldErrors({});

    try {
      const res = await correctReservationDepartmentAction({
        reservationId: reviewingReservation.id,
        expectedDepartmentId: null,
        departmentId: reviewDeptId,
        reason: reviewReason.trim(),
      });

      if (res.success) {
        toast.success("Historical reservation assigned to department.");
        setReviewingReservation(null);
        setReviewDeptId("");
        setReviewReason("");
        setReviewFieldErrors({});
        fetchUnassigned();
        router.refresh();
      } else {
        if (res.fieldErrors && Object.keys(res.fieldErrors).length > 0) {
          setReviewFieldErrors(res.fieldErrors);
        }
        toast.error(res.error || "Failed to assign department.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top-Level Administration Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 w-fit">
        <button
          type="button"
          onClick={() => handleTabChange("users")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "users" || activeTab === "unassigned"
              ? "bg-white text-blue-600 shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Users className="h-4 w-4" />
          <span>Users</span>
          {unassignedCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
              {unassignedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("departments")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "departments"
              ? "bg-white text-blue-600 shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Building2 className="h-4 w-4" />
          <span>Departments</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("categories")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "categories"
              ? "bg-white text-blue-600 shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Layers className="h-4 w-4" />
          <span>Resource Categories</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("shifts")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
            activeTab === "shifts"
              ? "bg-white text-blue-600 shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Clock className="h-4 w-4" />
          <span>Office Shifts</span>
        </button>
      </div>

      {/* 2. USERS SECTION: Metric Cards & Sub-Tabs */}
      {(activeTab === "users" || activeTab === "unassigned") && (
        <>
          {/* Metric Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Users</span>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalUsers}</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Active Members</span>
                <UserCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-1">{activeUsersCount}</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Administrators</span>
                <Shield className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-1">{adminUsersCount}</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Legacy Bookings</span>
                <AlertTriangle className={cn("h-4 w-4", unassignedCount > 0 ? "text-amber-500" : "text-slate-400")} />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-2xl font-bold text-slate-900">{unassignedCount}</p>
                {unassignedCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Needs Review
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sub-Tabs: Team Directory vs Historical Unassigned Bookings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  activeTab === "users"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Team Directory ({users.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("unassigned");
                  fetchUnassigned();
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  activeTab === "unassigned"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Historical Unassigned Bookings
                {unassignedCount > 0 && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                      activeTab === "unassigned"
                        ? "bg-white text-blue-700"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {unassignedCount}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "users" && (
              <Button
                type="button"
                onClick={() => {
                  setFieldErrors({});
                  setIsAddModalOpen(true);
                }}
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xs"
              >
                <UserPlus className="h-4 w-4" />
                Add Member
              </Button>
            )}
          </div>
        </>
      )}

      {/* TAB 1: USERS DIRECTORY */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Controls: Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 shadow-2xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role filter */}
              <select
                value={filterRole}
                onChange={(e) =>
                  setFilterRole(e.target.value as "ALL" | "ADMIN" | "MEMBER")
                }
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Administrators</option>
                <option value="MEMBER">Members</option>
              </select>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(
                    e.target.value as "ALL" | "ACTIVE" | "INACTIVE"
                  )
                }
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              {/* Department filter */}
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">All Departments</option>
                <option value="UNASSIGNED">Unassigned Only ({unassignedDeptCount})</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* User Table with fixed column widths and clean layouts */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-[32%]">User</th>
                    <th className="py-3 px-3 w-[15%]">Role</th>
                    <th className="py-3 px-3 w-[13%]">Status</th>
                    <th className="py-3 px-3 w-[22%]">Department</th>
                    <th className="py-3 px-4 w-[18%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No team members match the search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.id === currentAdminId;
                      const hasStructuredNames = Boolean(u.firstName && u.lastName);
                      const displayName = hasStructuredNames
                        ? `${u.firstName} ${u.lastName}`
                        : u.name;
                      const initials = displayName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          {/* User Avatar + Name + Email */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0 text-xs">
                                {initials || "U"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900 truncate">
                                    {displayName}
                                  </span>
                                  {isSelf && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 shrink-0">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 truncate block">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3 px-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                                u.role === "ADMIN"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              )}
                            >
                              {u.role === "ADMIN" ? (
                                <Shield className="h-3 w-3" />
                              ) : (
                                <Users className="h-3 w-3" />
                              )}
                              {u.role}
                            </span>
                          </td>

                          {/* Status Dot */}
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  u.isActive ? "bg-emerald-500" : "bg-slate-300"
                                )}
                              />
                              <span className={u.isActive ? "text-slate-800" : "text-slate-400"}>
                                {u.isActive ? "Active" : "Inactive"}
                              </span>
                            </span>
                          </td>

                          {/* Department */}
                          <td className="py-3 px-3">
                            {u.department ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50/80 border border-blue-200/60 text-blue-800 text-[11px] font-medium max-w-full truncate">
                                <Building2 className="h-3 w-3 shrink-0 text-blue-600" />
                                <span className="truncate">{u.department.name}</span>
                                <span className="text-[10px] text-blue-500 font-bold shrink-0">
                                  ({u.department.code})
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Profile */}
                              <button
                                type="button"
                                onClick={() => openEditUser(u)}
                                title="Edit user profile"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>

                              {/* Assign Department */}
                              <button
                                type="button"
                                onClick={() => {
                                  setDeptUser(u);
                                  setTargetDeptId(u.departmentId || departments[0]?.id || "");
                                }}
                                title="Assign department"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                              >
                                <Briefcase className="h-3.5 w-3.5" />
                              </button>

                              {/* Toggle Role */}
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => setRoleUser(u)}
                                title={isSelf ? "You cannot modify your own role" : "Change role"}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  isSelf
                                    ? "text-slate-300 cursor-not-allowed"
                                    : "text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                                )}
                              >
                                <Shield className="h-3.5 w-3.5" />
                              </button>

                              {/* Toggle Active Status */}
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => setStatusUser(u)}
                                title={isSelf ? "You cannot deactivate your own account" : u.isActive ? "Deactivate user" : "Activate user"}
                                className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  isSelf
                                    ? "text-slate-300 cursor-not-allowed"
                                    : u.isActive
                                    ? "text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                    : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                )}
                              >
                                {u.isActive ? (
                                  <UserX className="h-3.5 w-3.5" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORICAL UNASSIGNED BOOKINGS */}
      {activeTab === "unassigned" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-amber-950 block">
                Historical Department Allocation Review Queue
              </span>
              <p className="text-amber-800 leading-relaxed">
                These reservations were created before mandatory department allocation was enforced. In accordance with organizational governance, administrators can review each booking and assign it to the appropriate department with an explicit audit reason.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
            {isLoadingUnassigned ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-xs">Loading unassigned bookings...</span>
              </div>
            ) : unassignedReservations.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-800">All bookings are assigned</p>
                <p className="text-slate-400 mt-0.5">
                  There are no unassigned historical reservations in the database.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Reservation Title</th>
                      <th className="py-3 px-3">Resource</th>
                      <th className="py-3 px-3">Reserved For</th>
                      <th className="py-3 px-3">Date & Time</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {unassignedReservations.map((r) => {
                      const intervalStr = formatColomboInterval(r.startTime, r.endTime);
                      const dateStr = formatColomboDate(r.startTime);

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {r.title}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700">
                            {r.resource.name}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {r.user ? (
                              <span>
                                {r.user.name}{" "}
                                <span className="text-[10px] text-slate-400 block">
                                  {r.user.email}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Department Only</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            <span className="font-medium text-slate-800 block">
                              {dateStr}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {intervalStr}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setReviewingReservation({
                                  id: r.id,
                                  title: r.title,
                                  resourceName: r.resource.name,
                                  userName: r.user?.name,
                                  userEmail: r.user?.email,
                                  intervalStr: `${dateStr} (${intervalStr})`,
                                });
                                setReviewDeptId(departments[0]?.id || "");
                                setReviewReason("");
                              }}
                              className="h-7 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Review & Assign
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DEPARTMENTS */}
      {activeTab === "departments" && <AdminDepartments />}

      {/* TAB: RESOURCE CATEGORIES */}
      {activeTab === "categories" && <AdminCategories />}

      {/* TAB: OFFICE HOURS & SHIFTS */}
      {activeTab === "shifts" && <AdminOfficeShifts />}

      {/* MODAL 1: ADD MEMBER */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Team Member"
        description="Create a new user account with MEMBER role and assign an organizational department."
      >
        <form onSubmit={handleAddMember} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.firstName}
                onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                placeholder="Jane"
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {fieldErrors.firstName && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {fieldErrors.firstName[0]}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={addForm.lastName}
                onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                placeholder="Doe"
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {fieldErrors.lastName && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {fieldErrors.lastName[0]}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              placeholder="jane.doe@example.com"
              className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {fieldErrors.email && (
              <span className="text-[10px] text-rose-500 font-medium block mt-1">
                {fieldErrors.email[0]}
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Department <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={addForm.departmentId}
              onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
              className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Initial Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={addForm.initialPassword}
                onChange={(e) => setAddForm({ ...addForm, initialPassword: e.target.value })}
                placeholder="At least 6 characters (8+ recommended)"
                className="h-9 w-full rounded-xl border border-slate-200 pl-3 pr-9 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.initialPassword && (
              <span className="text-[10px] text-rose-500 font-medium block mt-1">
                {fieldErrors.initialPassword[0]}
              </span>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 6 characters, including a letter, number, and special character. (8+ recommended). Initial password is not stored in plaintext or displayed again.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="h-8 text-xs font-semibold text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Create Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT USER PROFILE */}
      <Modal
        isOpen={Boolean(editingUser)}
        onClose={() => {
          setEditingUser(null);
          setEditFieldErrors({});
        }}
        title="Edit User Profile"
        description={`Update profile information for ${editingUser?.name}.`}
      >
        <form onSubmit={handleEditProfile} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                First Name
              </label>
              <input
                type="text"
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                placeholder="First name"
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {editFieldErrors.firstName && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {editFieldErrors.firstName[0]}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                placeholder="Last name"
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {editFieldErrors.lastName && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {editFieldErrors.lastName[0]}
                </span>
              )}
            </div>
          </div>

          {/* Email Section with OTP Verification Integration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block">
                Email Address
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Active: {editingUser?.email}
              </span>
            </div>

            <div>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => {
                  setEditForm({ ...editForm, email: e.target.value });
                  if (editFieldErrors.email) {
                    setEditFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.email;
                      return copy;
                    });
                  }
                }}
                className={cn(
                  "h-9 w-full rounded-xl border px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600",
                  editFieldErrors.email ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
              />
              {editFieldErrors.email && (
                <span className="text-[10px] text-rose-500 font-medium block mt-1">
                  {editFieldErrors.email[0]}
                </span>
              )}
            </div>
          </div>

          {!editingUser?.firstName && !editingUser?.lastName && (
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Note: This is a legacy account without structured names. Entering both First Name and Last Name will upgrade it to the new structured identity format.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingUser(null);
                setEditFieldErrors({});
              }}
              className="h-8 text-xs font-semibold text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ASSIGN DEPARTMENT */}
      <Modal
        isOpen={Boolean(deptUser)}
        onClose={() => setDeptUser(null)}
        title="Assign Department"
        description={`Select an active department for ${deptUser?.name}.`}
      >
        <form onSubmit={handleAssignDepartment} className="space-y-4 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Organizational Department
            </label>
            <select
              value={targetDeptId}
              onChange={(e) => setTargetDeptId(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeptUser(null)}
              className="h-8 text-xs font-semibold text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Assign Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: ROLE CONFIRMATION */}
      <Modal
        isOpen={Boolean(roleUser)}
        onClose={() => setRoleUser(null)}
        title="Confirm Role Change"
        description={`Modify administrative access level for ${roleUser?.name}.`}
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to change <strong>{roleUser?.name}</strong> from{" "}
            <span className="font-bold text-slate-900">{roleUser?.role}</span> to{" "}
            <span className="font-bold text-blue-600">
              {roleUser?.role === "ADMIN" ? "MEMBER" : "ADMIN"}
            </span>
            ?
            {roleUser?.role === "ADMIN" && (
              <span className="block mt-2 text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Warning: Removing administrator access will revoke their ability to manage users, approve bookings, and reassign departments.
              </span>
            )}
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRoleUser(null)}
              className="h-8 text-xs font-semibold text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleConfirmRoleChange}
              className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm Role Change
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: STATUS CONFIRMATION */}
      <Modal
        isOpen={Boolean(statusUser)}
        onClose={() => setStatusUser(null)}
        title={statusUser?.isActive ? "Deactivate User Account" : "Activate User Account"}
        description={`Change account active status for ${statusUser?.name}.`}
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            {statusUser?.isActive ? (
              <>
                Are you sure you want to deactivate <strong>{statusUser?.name}</strong>? They will no longer be able to sign in or create reservations.
              </>
            ) : (
              <>
                Are you sure you want to reactivate <strong>{statusUser?.name}</strong>? They will regain access to their account. Note: activation requires that the user belongs to an active department.
              </>
            )}
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusUser(null)}
              className="h-8 text-xs font-semibold text-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleConfirmStatusChange}
              className={cn(
                "h-8 text-xs font-semibold text-white gap-1.5",
                statusUser?.isActive
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {statusUser?.isActive ? "Deactivate Account" : "Activate Account"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 6: HISTORICAL RESERVATION REVIEW */}
      <Modal
        isOpen={Boolean(reviewingReservation)}
        onClose={() => setReviewingReservation(null)}
        title="Review & Assign Department"
        description="Assign this historical reservation to an active organizational department."
      >
        {reviewingReservation && (
          <form onSubmit={handleReviewCorrection} className="space-y-4 pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Reservation Title
                </span>
                <span className="font-bold text-slate-800">
                  {reviewingReservation.title}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Resource
                  </span>
                  <span className="font-medium text-slate-700">
                    {reviewingReservation.resourceName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Timing
                  </span>
                  <span className="font-medium text-slate-700">
                    {reviewingReservation.intervalStr}
                  </span>
                </div>
              </div>
              {reviewingReservation.userName && (
                <div className="pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Reserved For
                  </span>
                  <span className="font-medium text-slate-700">
                    {reviewingReservation.userName} ({reviewingReservation.userEmail})
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Target Department <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={reviewDeptId}
                onChange={(e) => {
                  setReviewDeptId(e.target.value);
                  if (reviewFieldErrors.departmentId) {
                    setReviewFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.departmentId;
                      return copy;
                    });
                  }
                }}
                className={cn(
                  "h-9 w-full rounded-xl border px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600",
                  reviewFieldErrors.departmentId ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              {reviewFieldErrors.departmentId && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {reviewFieldErrors.departmentId[0]}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Audit Reason <span className="text-rose-500">*</span>
                </label>
                <span
                  className={cn(
                    "text-[10px]",
                    reviewReason.trim().length >= 10 && reviewReason.trim().length <= 500
                      ? "text-emerald-600 font-bold"
                      : "text-slate-400"
                  )}
                >
                  {reviewReason.trim().length}/500 (min 10)
                </span>
              </div>
              <textarea
                required
                rows={3}
                minLength={10}
                maxLength={500}
                value={reviewReason}
                onChange={(e) => {
                  setReviewReason(e.target.value);
                  if (reviewFieldErrors.reason) {
                    setReviewFieldErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.reason;
                      return copy;
                    });
                  }
                }}
                placeholder="Explain why this reservation is being assigned to the selected department (minimum 10 characters)..."
                className={cn(
                  "w-full rounded-xl border p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none",
                  reviewFieldErrors.reason ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
              />
              {reviewFieldErrors.reason && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {reviewFieldErrors.reason[0]}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReviewingReservation(null)}
                className="h-8 text-xs font-semibold text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  isSubmitting ||
                  !reviewDeptId ||
                  reviewReason.trim().length < 10 ||
                  reviewReason.trim().length > 500
                }
                className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Save Department Assignment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

