"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
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
import { getEffectiveSchedulingHoursAction } from "@/features/office-shifts/actions/office-shift-actions";
import type { EffectiveSchedule } from "@/features/office-shifts/types/effective-schedule";
import {
  generateBookingStartOptions,
  generateBookingEndOptions,
  formatShiftHours,
} from "@/features/office-shifts/utils/shift-client-utils";
import {
  getColomboTodayString,
  shiftColomboDate,
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
  effectiveSchedule?: EffectiveSchedule | null;
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
  effectiveSchedule,
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

  // Dynamic schedule state
  const [fetchedSchedule, setFetchedSchedule] = useState<EffectiveSchedule | null>(null);
  const schedule = effectiveSchedule ?? fetchedSchedule;

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    getEffectiveSchedulingHoursAction({
      date,
      resourceId: resourceId || undefined,
    })
      .then((res) => {
        if (isCurrent && res.success && res.data) {
          setFetchedSchedule(res.data as unknown as EffectiveSchedule);
        }
      })
      .catch((err) => {
        console.error("Failed to load effective schedule in modal:", err);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, date, resourceId]);

  const startMinute = schedule?.startMinute ?? 540;
  const durationMinutes = schedule?.durationMinutes ?? 540;

  const startOptions = useMemo(() => {
    return generateBookingStartOptions(startMinute, durationMinutes);
  }, [startMinute, durationMinutes]);

  const [userStartTime, setUserStartTime] = useState<string | null>(null);
  const [userEndTime, setUserEndTime] = useState<string | null>(null);

  // Derived effective start time: user selection or initialStartTime or first available
  const startTime = useMemo(() => {
    if (userStartTime && startOptions.some((o) => o.timeStr === userStartTime)) {
      return userStartTime;
    }
    if (initialStartTime && startOptions.some((o) => o.timeStr === initialStartTime)) {
      return initialStartTime;
    }
    return startOptions[0]?.timeStr ?? "09:00";
  }, [userStartTime, startOptions, initialStartTime]);

  const endOptions = useMemo(() => {
    if (!startTime) return [];
    return generateBookingEndOptions(startTime, startMinute, durationMinutes);
  }, [startTime, startMinute, durationMinutes]);

  // Derived effective end time: user selection or initialEndTime or standard 1h/30m
  const endTime = useMemo(() => {
    if (userEndTime && endOptions.some((o) => o.timeStr === userEndTime)) {
      return userEndTime;
    }
    if (initialEndTime && endOptions.some((o) => o.timeStr === initialEndTime)) {
      return initialEndTime;
    }
    return endOptions.length > 1 ? endOptions[1].timeStr : (endOptions[0]?.timeStr ?? "10:00");
  }, [userEndTime, endOptions, initialEndTime]);

  // Derive ISO strings and timezone offsets
  const selectedStartOpt = startOptions.find((o) => o.timeStr === startTime);
  const startDayOffset = selectedStartOpt?.dayOffset ?? 0;
  const startDateStr = date ? shiftColomboDate(date, startDayOffset) : "";
  const startISO = date && startTime ? createColomboISO(startDateStr, startTime) : "";

  const selectedEndOpt = endOptions.find((o) => o.timeStr === endTime);
  const endDayOffset = selectedEndOpt?.dayOffset ?? 0;
  const endDateStr = date ? shiftColomboDate(date, endDayOffset) : "";
  const endISO = date && endTime ? createColomboISO(endDateStr, endTime) : "";

  const isInvalidTimeOrder = Boolean(
    !startTime ||
      !endTime ||
      (startISO && endISO && new Date(endISO).getTime() <= new Date(startISO).getTime())
  );

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
  }, [isOpen, resourceId, date, startTime, endTime, isInvalidTimeOrder, startISO, endISO]);

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
        if (result.code === "SHIFT_OUTSIDE_WINDOW") {
          setErrorMessage("This time slot falls outside the active office shift hours. Please choose a time within permitted operating hours.");
        } else if (result.code === "SLOT_CONFLICT") {
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
      description={`Specify reservation parameters in Asia/Colombo (${formatShiftHours(startMinute, durationMinutes)}).`}
      className="max-w-2xl sm:max-w-[720px] w-full p-6 sm:p-7"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Active Shift Policy Banner */}
        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-blue-900">Active Policy:</span>
            <span className="text-blue-800 font-medium">
              {schedule?.policy?.name || "Standard Business Hours"} (
              {formatShiftHours(startMinute, durationMinutes)})
            </span>
          </div>
          {schedule?.enforced && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
              Enforced
            </span>
          )}
        </div>

        {/* Member Department Warning Banner */}
        {!isAdmin && isAssignmentRequired && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Department Assignment Required</span>
            </div>
            <p className="text-amber-700 leading-relaxed text-[11px]">
              Your account does not currently have an assigned organizational department.
              A valid department assignment is required before you can request resource reservations.
              Please contact your system administrator to assign your account.
            </p>
          </div>
        )}

        {/* Member Assigned Department Read-Only Indicator */}
        {!isAdmin && !isAssignmentRequired && myDepartment && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-500" />
              <span className="font-semibold text-slate-700">Booking Department:</span>
              <span className="font-bold text-slate-900">
                {myDepartment.name} ({myDepartment.code})
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Verified Member
            </span>
          </div>
        )}

        {/* SECTION A & B: Admin Booking Mode & Target Allocation */}
        {isAdmin && (
          <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <span>Admin Booking Mode</span>
              </label>
              <span className="text-[10px] font-medium text-slate-400">
                Direct Administrator Override
              </span>
            </div>

            {/* 3-Button Segmented Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleAdminModeChange("self")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border text-center ${
                  adminMode === "self"
                    ? "bg-white text-blue-700 border-blue-300 shadow-2xs ring-1 ring-blue-300/40"
                    : "bg-slate-100/70 text-slate-600 border-slate-200/80 hover:bg-white hover:text-slate-900"
                }`}
              >
                Mode A: Myself
              </button>
              <button
                type="button"
                onClick={() => handleAdminModeChange("user")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border text-center ${
                  adminMode === "user"
                    ? "bg-white text-blue-700 border-blue-300 shadow-2xs ring-1 ring-blue-300/40"
                    : "bg-slate-100/70 text-slate-600 border-slate-200/80 hover:bg-white hover:text-slate-900"
                }`}
              >
                Mode B: For User
              </button>
              <button
                type="button"
                onClick={() => handleAdminModeChange("dept")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border text-center ${
                  adminMode === "dept"
                    ? "bg-white text-blue-700 border-blue-300 shadow-2xs ring-1 ring-blue-300/40"
                    : "bg-slate-100/70 text-slate-600 border-slate-200/80 hover:bg-white hover:text-slate-900"
                }`}
              >
                Mode C: Department Only
              </button>
            </div>

            {/* Mode A Description */}
            {adminMode === "self" && (
              <div className="text-xs text-slate-600 pt-1">
                {myDepartment ? (
                  <p className="text-[11px]">
                    Directly approved under your administrative department:{" "}
                    <strong className="text-slate-900">{myDepartment.name} ({myDepartment.code})</strong>.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 font-medium">
                    ⚠ Your administrator account has no department assigned. Please assign a department in Administration or choose Mode C.
                  </p>
                )}
              </div>
            )}

            {/* Mode B: 2-Column Fields for Department + Target User */}
            {adminMode === "user" && (
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Select the target department, then select the active team member to reserve on their behalf.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Department
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => handleDeptSelect(e.target.value)}
                      className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                      <div className="h-9 flex items-center px-3 text-xs text-slate-400 bg-white rounded-xl border border-slate-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2 text-blue-600" /> Loading members...
                      </div>
                    ) : deptUsers.length === 0 ? (
                      <div className="h-9 flex items-center px-3 text-xs text-amber-700 bg-amber-50/50 rounded-xl border border-amber-200 font-medium">
                        No active users in department
                      </div>
                    ) : (
                      <select
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
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

            {/* Mode C: Department Only Field */}
            {adminMode === "dept" && (
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Shared department reservation: The slot is allocated to the entire department without assigning a specific individual user.
                </p>
                <div className="sm:w-1/2 pt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Department
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => handleDeptSelect(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
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

        {/* SECTION C: 2-Column Resource and Booking Purpose */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>Resource</span>
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

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Booking Title / Purpose</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint Planning, Client Demo, Board Meeting"
              maxLength={120}
              required
              className="text-xs h-10 rounded-xl shadow-2xs"
            />
            <p className="text-[11px] text-slate-400 pl-1">
              Brief description visible in reservation details
            </p>
          </div>
        </div>

        {/* SECTION D: 2-Column Date and Time Schedule */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>Date (Asia/Colombo)</span>
            </label>
            <Input
              type="date"
              value={date}
              min={getColomboTodayString()}
              onChange={(e) => setDate(e.target.value)}
              required
              className="text-xs h-10 rounded-xl shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>Time Slot ({formatShiftHours(startMinute, durationMinutes)})</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={startTime}
                onChange={(e) => setUserStartTime(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {startOptions.map((opt) => (
                  <option key={`start-${opt.timeStr}-${opt.dayOffset}`} value={opt.timeStr}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={endTime}
                onChange={(e) => setUserEndTime(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {endOptions.map((opt) => (
                  <option key={`end-${opt.timeStr}-${opt.dayOffset}`} value={opt.timeStr}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {isInvalidTimeOrder && (
              <p className="text-[11px] text-rose-600 font-medium pl-1">
                End time must be after start time.
              </p>
            )}
          </div>
        </div>

        {/* SECTION E: Availability & Validation Feedback */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isCheckingConflict ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-slate-500 font-medium">Checking live conflict status...</span>
              </>
            ) : availabilityStatus === "available" ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">
                  This time slot is open and available to reserve!
                </span>
              </>
            ) : availabilityStatus === "conflict" ? (
              <>
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span className="text-rose-700 font-semibold">
                  This time slot is already requested or reserved.
                </span>
              </>
            ) : (
              <span className="text-slate-400">Verifying timeline interval...</span>
            )}
          </div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Live Check
          </span>
        </div>

        {/* SECTION F: Confirmation Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl text-xs h-9 px-4 border-slate-200 text-slate-700 hover:bg-slate-50"
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
            className="rounded-xl text-xs h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Submitting Request...
              </>
            ) : isAdmin ? (
              "Confirm & Reserve"
            ) : (
              "Submit Reservation Request"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
