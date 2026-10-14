"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";
import { assignUserDepartmentAction } from "@/features/departments/actions/department-actions";
import { changeRoleAction } from "@/app/(dashboard)/administration/role-actions";

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  isActive: boolean;
  departmentId: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
}

interface UserDepartmentManagerProps {
  users: AdminUserItem[];
  departments: DepartmentItem[];
  currentAdminId: string;
}

export function UserDepartmentManager({
  users,
  departments,
  currentAdminId,
}: UserDepartmentManagerProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");

  // Track pending assignment per user
  const [selectedDepts, setSelectedDepts] = useState<Record<string, string>>({});
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    userId: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleSelectDept = (userId: string, deptId: string) => {
    setSelectedDepts((prev) => ({ ...prev, [userId]: deptId }));
  };

  const handleAssignDepartment = (userId: string) => {
    const targetDeptId = selectedDepts[userId] || departments[0]?.id;
    if (!targetDeptId) return;

    setUpdatingUserId(userId);
    setActionFeedback(null);

    startTransition(async () => {
      const result = await assignUserDepartmentAction({
        userId,
        departmentId: targetDeptId,
      });

      setUpdatingUserId(null);

      if (result.success) {
        setActionFeedback({
          userId,
          type: "success",
          message: "Department updated successfully.",
        });
        router.refresh();
      } else {
        setActionFeedback({
          userId,
          type: "error",
          message: result.error || "Failed to update department.",
        });
      }
    });
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === "ASSIGNED") return Boolean(u.departmentId);
    if (filterMode === "UNASSIGNED") return !u.departmentId;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls: Search + Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 shadow-2xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterMode("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              filterMode === "ALL"
                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("UNASSIGNED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              filterMode === "UNASSIGNED"
                ? "bg-amber-50 text-amber-800 border-amber-300 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Unassigned ({users.filter((u) => !u.departmentId).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("ASSIGNED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              filterMode === "ASSIGNED"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Assigned ({users.filter((u) => Boolean(u.departmentId)).length})
          </button>
        </div>
      </div>

      {/* User Table / List */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs divide-y divide-slate-100">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No users found matching the filter criteria.
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isUnassigned = !user.departmentId;
            const currentDeptId =
              selectedDepts[user.id] ?? user.departmentId ?? departments[0]?.id;
            const isUpdating = updatingUserId === user.id && isPending;
            const feedback =
              actionFeedback?.userId === user.id ? actionFeedback : null;

            return (
              <div
                key={user.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                {/* User Identity & Current Status */}
                <div className="flex items-center gap-3 min-w-56">
                  <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                    {user.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {user.name}
                      </p>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          user.role === "ADMIN"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user.email} · {user.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>

                {/* Current Department Badge */}
                <div className="flex items-center gap-2 min-w-44">
                  {isUnassigned ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Unassigned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <Building2 className="h-3.5 w-3.5 text-blue-600" />
                      {user.department?.name} ({user.department?.code})
                    </span>
                  )}
                </div>

                {/* Department Assignment Controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={currentDeptId}
                      onChange={(e) => handleSelectDept(user.id, e.target.value)}
                      disabled={isUpdating || !user.isActive}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleAssignDepartment(user.id)}
                      disabled={isUpdating || !user.isActive}
                      className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
                      <span>Assign</span>
                    </button>
                  </div>

                  {feedback && (
                    <div
                      className={`text-[11px] font-medium flex items-center gap-1 ${
                        feedback.type === "success"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {feedback.type === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      <span>{feedback.message}</span>
                    </div>
                  )}

                  {/* Role Change Form */}
                  {user.id !== currentAdminId && (
                    <form action={changeRoleAction} className="inline-block">
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        name="role"
                        value={user.role === "ADMIN" ? "MEMBER" : "ADMIN"}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                        title={`Make ${user.role === "ADMIN" ? "Member" : "Admin"}`}
                      >
                        Make {user.role === "ADMIN" ? "member" : "admin"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
