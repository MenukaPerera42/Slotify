"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Building2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  UserCheck,
  ShieldAlert,
  Briefcase,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createReservationAction,
  createAdminReservationAction,
  findAvailableResourcesAction,
  listActiveUsersAction,
} from "../actions/reservation-actions";
import { getMyDepartmentAction } from "@/features/departments/actions/department-actions";
import {
  BUSINESS_TIME_SLOTS,
  formatSlotLabel,
  getColomboTodayString,
  createColomboISO,
} from "../utils/client-date";

export interface ResourceOption {
  id: string;
  name: string;
  location?: string;
  capacity?: number | null;
  isActive?: boolean;
  category?: { name: string } | null;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface ActiveUserOption {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
}

interface ReservationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  resources: ResourceOption[];
  departments?: DepartmentOption[];
  isAdmin?: boolean;
  initialResourceId?: string;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
}

export function ReservationFormModal({
  isOpen,
  onClose,
  onSuccess,
  resources,
  departments = [],
  isAdmin = false,
  initialResourceId,
  initialDate,
  initialStartTime = "09:00",
  initialEndTime = "10:00",
}: ReservationFormModalProps) {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();

  // Active resources only
  const activeResources = resources.filter((r) => r.isActive !== false);

  // Authenticated user's department state
  const [myDepartment, setMyDepartment] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [isAssignmentRequired, setIsAssignmentRequired] = useState(false);

  // Admin booking mode: "self" (Mode A) | "user" (Mode B) | "dept" (Mode C)
  const [adminMode, setAdminMode] = useState<"self" | "user" | "dept">("self");
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    departments[0]?.id || ""
  );
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [deptUsers, setDeptUsers] = useState<ActiveUserOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Form field states
  const [resourceId, setResourceId] = useState(
    initialResourceId || (activeResources[0]?.id ?? "")
  );
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || getColomboTodayString());
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);

  // Live availability feedback state
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<
    "idle" | "available" | "conflict"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUsersForDepartment = (deptId: string) => {
    setIsLoadingUsers(true);
    listActiveUsersAction({ departmentId: deptId, pageSize: 100 })
      .then((res) => {
        if (res.success && res.data) {
          const usersInDept = res.data.items.filter(
            (u) => u.departmentId === deptId
          );
          setDeptUsers(usersInDept);
          if (usersInDept.length > 0) {
            setTargetUserId(usersInDept[0].id);
          } else {
            setTargetUserId("");
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load department users:", err);
      })
      .finally(() => {
        setIsLoadingUsers(false);
      });
  };

  const handleAdminModeChange = (mode: "self" | "user" | "dept") => {
    setAdminMode(mode);
    if (mode === "user") {
      const activeDeptId = selectedDeptId || departments[0]?.id || "";
      if (activeDeptId) {
        loadUsersForDepartment(activeDeptId);
      }
    }
  };

  const handleDeptSelect = (deptId: string) => {
    setSelectedDeptId(deptId);
    if (adminMode === "user") {
      loadUsersForDepartment(deptId);
    }
  };

  // Fetch current user's department on open
  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    getMyDepartmentAction()
      .then((res) => {
        if (isCurrent && res.success && res.data) {
          setMyDepartment(res.data.department);
          setIsAssignmentRequired(res.data.assignmentRequired);
          if (res.data.department?.id) {
            setSelectedDeptId((prev) => prev || res.data.department!.id);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load user department:", err);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen]);

  // Derived validation
  const isInvalidTimeOrder = Boolean(startTime && endTime && startTime >= endTime);
  const endISO = date && endTime ? createColomboISO(date, endTime) : "";

  // Live conflict checker (debounce 250ms)
  useEffect(() => {
    if (!isOpen || !resourceId || !date || !startTime || !endTime || isInvalidTimeOrder) {
      return;
    }

    // Check if slot end is already in the past
    if (new Date(endISO).getTime() <= Date.now()) {
      return;
    }

    let isCurrent = true;
    const startISO = createColomboISO(date, startTime);

    const timer = setTimeout(() => {
      setIsCheckingConflict(true);
      findAvailableResourcesAction({
        startTime: startISO,
        endTime: endISO,
        resourceId,
      })
        .then((result) => {
          if (!isCurrent) return;
          setIsCheckingConflict(false);
          if (result.success) {
            const isBlocked = result.data.blocked.some((b) => b.id === resourceId);
            setAvailabilityStatus(isBlocked ? "conflict" : "available");
          } else {
            setAvailabilityStatus("idle");
          }
        })
        .catch(() => {
          if (isCurrent) {
            setIsCheckingConflict(false);
            setAvailabilityStatus("idle");
          }
        });
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [isOpen, resourceId, date, startTime, endTime, isInvalidTimeOrder, endISO]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!resourceId) {
      setErrorMessage("Please select a resource to reserve.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Please provide a title or purpose for this reservation.");
      return;
    }

    if (isInvalidTimeOrder) {
      setErrorMessage("End time must be after start time.");
      return;
    }

    if (new Date(endISO).getTime() <= Date.now()) {
      setErrorMessage("Cannot book a reservation that is entirely in the past.");
      return;
    }

    // Member validation
    if (!isAdmin && isAssignmentRequired) {
      setErrorMessage("Department assignment required. Please contact an administrator.");
      return;
    }

    // Admin validation
    if (isAdmin) {
      if (adminMode === "self" && isAssignmentRequired) {
        setErrorMessage(
          "Your account requires an active department assignment to self-book. Assign your department in Administration, or use Department-Only mode."
        );
        return;
      }
      if (adminMode === "user" && !targetUserId) {
        setErrorMessage("Please select a target user belonging to the selected department.");
        return;
      }
      if ((adminMode === "user" || adminMode === "dept") && !selectedDeptId) {
        setErrorMessage("Please choose an active department.");
        return;
      }
    }

    const startISO = createColomboISO(date, startTime);

    startTransition(async () => {
      let result;
      if (!isAdmin || adminMode === "self") {
        // Mode A: Self-booking (Member -> PENDING; Admin -> APPROVED)
        result = await createReservationAction({
          resourceId,
          title: title.trim(),
          startTime: startISO,
          endTime: endISO,
        });
      } else if (adminMode === "user") {
        // Mode B: On behalf of user
        result = await createAdminReservationAction({
          departmentId: selectedDeptId,
          targetUserId,
          resourceId,
          title: title.trim(),
          startTime: startISO,
          endTime: endISO,
        });
      } else {
        // Mode C: Department-only booking
        result = await createAdminReservationAction({
          departmentId: selectedDeptId,
          resourceId,
          title: title.trim(),
          startTime: startISO,
          endTime: endISO,
        });
      }

      if (!result.success) {
        if (result.code === "SLOT_CONFLICT") {
          setErrorMessage("This time slot is already requested or reserved. Refresh availability and choose another time.");
        } else if (result.code === "DEPARTMENT_REQUIRED") {
          setErrorMessage("An active department assignment is required to make a reservation.");
        } else if (result.code === "DEPARTMENT_MISMATCH") {
          setErrorMessage("The selected user does not belong to the selected department.");
        } else if (result.code === "RESOURCE_INACTIVE") {
          setErrorMessage("This resource is currently inactive and cannot be reserved.");
        } else if (result.code === "USER_NOT_FOUND") {
          setErrorMessage("The selected target user account was not found or is inactive.");
        } else {
          setErrorMessage(result.error || "Unable to submit reservation request.");
        }
        return;
      }

      // Success
      setTitle("");
      onClose();
      router.refresh();
      onSuccess?.();
    });
  };

  const selectedResource = resources.find((r) => r.id === resourceId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Reservation"
      description="Select a resource, specify your booking time in Asia/Colombo time, and submit your request."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Member Department Warning Banner (Phase 6) */}
        {!isAdmin && isAssignmentRequired && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Department Assignment Required</span>
            </div>
            <p className="text-amber-700 leading-relaxed">
              Your account does not currently have an assigned organizational department.
              A valid department assignment is required before you can request resource reservations.
              Please contact your system administrator to assign your account to a department.
            </p>
          </div>
        )}

        {/* Member Assigned Department Read-Only Indicator (Phase 6) */}
        {!isAdmin && !isAssignmentRequired && myDepartment && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-500" />
              <span className="font-semibold text-slate-700">Department:</span>
              <span className="font-bold text-slate-900">
                {myDepartment.name} ({myDepartment.code})
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Assigned Department
            </span>
          </div>
        )}

        {/* Admin 3-Mode Selector (Phase 7) */}
        {isAdmin && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-blue-600" />
              Admin Booking Mode
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleAdminModeChange("self")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border text-center ${
                  adminMode === "self"
                    ? "bg-white text-blue-700 border-blue-200 shadow-2xs"
                    : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100"
                }`}
              >
                Mode A: Myself
              </button>
              <button
                type="button"
                onClick={() => handleAdminModeChange("user")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border text-center ${
                  adminMode === "user"
                    ? "bg-white text-blue-700 border-blue-200 shadow-2xs"
                    : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100"
                }`}
              >
                Mode B: For User
              </button>
              <button
                type="button"
                onClick={() => handleAdminModeChange("dept")}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border text-center ${
                  adminMode === "dept"
                    ? "bg-white text-blue-700 border-blue-200 shadow-2xs"
                    : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100"
                }`}
              >
                Mode C: Department Only
              </button>
            </div>

            {/* Mode Explanation & Inputs */}
            {adminMode === "self" && (
              <div className="text-[11px] text-slate-600">
                {myDepartment ? (
                  <span>
                    Directly approved under your assigned department:{" "}
                    <strong>{myDepartment.name} ({myDepartment.code})</strong>.
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    ⚠ Your account is unassigned. Please assign your department in Administration or choose Mode C.
                  </span>
                )}
              </div>
            )}

            {adminMode === "user" && (
              <div className="space-y-2 pt-1 border-t border-slate-200/80">
                <p className="text-[11px] text-slate-500">
                  Select a department first, then select an active user belonging to that department.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Department
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => handleDeptSelect(e.target.value)}
                      className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Target User
                    </label>
                    {isLoadingUsers ? (
                      <div className="h-8 flex items-center px-2 text-xs text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Loading users...
                      </div>
                    ) : deptUsers.length === 0 ? (
                      <div className="h-8 flex items-center px-2 text-xs text-amber-600 font-medium">
                        No active users in dept
                      </div>
                    ) : (
                      <select
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                      >
                        {deptUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {adminMode === "dept" && (
              <div className="space-y-2 pt-1 border-t border-slate-200/80">
                <p className="text-[11px] text-slate-500">
                  Department-only booking: The resource will be reserved for the entire department as a shared unit. No individual user account will be assigned.
                </p>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Department
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resource Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            Resource
          </label>
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            disabled={activeResources.length === 0}
            className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {activeResources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.category?.name || "General"})
                {r.capacity ? ` · ${r.capacity} ppl` : ""}
              </option>
            ))}
          </select>
          {selectedResource?.location && (
            <p className="text-[11px] text-slate-400 pl-1">
              Location: {selectedResource.location}
            </p>
          )}
        </div>

        {/* Title / Purpose */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            Booking Title / Purpose
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Planning, Client Demo, Board Meeting"
            maxLength={120}
            required
            className="text-xs h-10 rounded-xl"
          />
        </div>

        {/* Date Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            Date (Asia/Colombo)
          </label>
          <Input
            type="date"
            value={date}
            min={getColomboTodayString()}
            onChange={(e) => setDate(e.target.value)}
            required
            className="text-xs h-10 rounded-xl"
          />
        </div>

        {/* Start and End Time Selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              Start Time
            </label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {BUSINESS_TIME_SLOTS.slice(0, -1).map((slot) => (
                <option key={`start-${slot}`} value={slot}>
                  {formatSlotLabel(slot)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              End Time
            </label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {BUSINESS_TIME_SLOTS.slice(1).map((slot) => (
                <option key={`end-${slot}`} value={slot}>
                  {formatSlotLabel(slot)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isInvalidTimeOrder && (
          <p className="text-xs text-rose-600 font-medium">
            End time must be later than start time.
          </p>
        )}

        {/* Live Conflict Feedback Bar */}
        <div className="pt-1">
          {isCheckingConflict ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              Checking availability...
            </div>
          ) : availabilityStatus === "available" ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Time slot is open and available!
            </div>
          ) : availabilityStatus === "conflict" ? (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              This time slot is already requested or reserved.
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              availabilityStatus === "conflict" ||
              isInvalidTimeOrder ||
              activeResources.length === 0 ||
              (!isAdmin && isAssignmentRequired) ||
              (isAdmin && adminMode === "self" && isAssignmentRequired) ||
              (isAdmin && adminMode === "user" && (!targetUserId || !selectedDeptId)) ||
              (isAdmin && adminMode === "dept" && !selectedDeptId)
            }
            className="rounded-xl text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Submitting Request...
              </>
            ) : isAdmin ? (
              "Confirm & Reserve"
            ) : (
              "Submit Reservation"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
