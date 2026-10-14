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

interface ActiveUserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ReservationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  resources: ResourceOption[];
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

  // Admin booking mode: "self" | "behalf"
  const [bookingMode, setBookingMode] = useState<"self" | "behalf">("self");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [activeUsers, setActiveUsers] = useState<ActiveUserOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");

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

  // Switch mode and load active users when admin selects behalf mode
  const handleSelectMode = (mode: "self" | "behalf") => {
    setBookingMode(mode);
    if (mode === "behalf" && activeUsers.length === 0) {
      setIsLoadingUsers(true);
      listActiveUsersAction({ pageSize: 100 })
        .then((res) => {
          if (res.success) {
            setActiveUsers(res.data.items);
            if (res.data.items.length > 0) {
              setTargetUserId((prev) => prev || res.data.items[0].id);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load active users:", err);
        })
        .finally(() => {
          setIsLoadingUsers(false);
        });
    }
  };

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

    if (isAdmin && bookingMode === "behalf" && !targetUserId) {
      setErrorMessage("Please select the target user on whose behalf you are booking.");
      return;
    }

    const startISO = createColomboISO(date, startTime);

    startTransition(async () => {
      const result = await createReservationAction({
        resourceId,
        title: title.trim(),
        startTime: startISO,
        endTime: endISO,
      });
      const result =
        isAdmin && bookingMode === "behalf"
          ? await createAdminReservationAction({
              targetUserId,
              resourceId,
              title: title.trim(),
              startTime: startISO,
              endTime: endISO,
            })
          : await createReservationAction({
              resourceId,
              title: title.trim(),
              startTime: startISO,
              endTime: endISO,
            });

      if (!result.success) {
        if (result.code === "SLOT_CONFLICT") {
          setErrorMessage("This time slot is already requested or reserved. Refresh availability and choose another time.");
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

  // Filter users by search term
  const filteredUsers = activeUsers.filter((u) => {
    if (!userSearch) return true;
    const term = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

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

        {/* Admin Mode Switcher: Mode A (Self) vs Mode B (On behalf of user) */}
        {isAdmin && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-blue-600" />
              Booking Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectMode("self")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                  bookingMode === "self"
                    ? "bg-white text-blue-700 border-blue-200 shadow-2xs"
                    : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100"
                }`}
              >
                Book for Myself
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode("behalf")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                  bookingMode === "behalf"
                    ? "bg-white text-blue-700 border-blue-200 shadow-2xs"
                    : "bg-transparent text-slate-600 border-transparent hover:bg-slate-100"
                }`}
              >
                Book on Behalf of User
              </button>
            </div>

            {bookingMode === "behalf" && (
              <div className="pt-2 space-y-2">
                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    Admin on-behalf reservations are directly <strong>APPROVED</strong> and owned by the selected target user.
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Target User
                  </label>
                  {isLoadingUsers ? (
                    <div className="py-2 text-xs text-slate-400 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                      Loading active team members...
                    </div>
                  ) : (
                    <>
                      {activeUsers.length > 5 && (
                        <input
                          type="text"
                          placeholder="Search user name or email..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white mb-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                      )}
                      <select
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                      >
                        {filteredUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email}) · {u.role}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resource Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            Resource
          </label>
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          >
            {activeResources.length === 0 && (
              <option value="" disabled>No active resources available</option>
            )}
            {activeResources.map((res) => (
              <option key={res.id} value={res.id}>
                {res.name} {res.category ? `(${res.category.name})` : ""} {res.capacity ? `· ${res.capacity} people` : ""}
              </option>
            ))}
          </select>
          {selectedResource?.location && (
            <p className="text-[11px] text-slate-400">
              Location: {selectedResource.location}
            </p>
          )}
        </div>

        {/* Reservation Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            Booking Title / Purpose
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sprint Planning, Client Demo, Board Meeting"
            maxLength={120}
            required
            className="h-10 text-sm"
          />
        </div>

        {/* Date Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            Date (Asia/Colombo)
          </label>
          <Input
            type="date"
            value={date}
            min={getColomboTodayString()}
            onChange={(e) => setDate(e.target.value)}
            required
            className="h-10 text-sm"
          />
        </div>

        {/* Time Interval Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Start Time
            </label>
            <select
              value={startTime}
              onChange={(e) => {
                const newStart = e.target.value;
                setStartTime(newStart);
                // Automatically bump end time if it's earlier or equal
                if (newStart >= endTime) {
                  const sIdx = BUSINESS_TIME_SLOTS.indexOf(newStart);
                  if (sIdx !== -1 && sIdx + 2 < BUSINESS_TIME_SLOTS.length) {
                    setEndTime(BUSINESS_TIME_SLOTS[sIdx + 2]);
                  } else if (sIdx !== -1 && sIdx + 1 < BUSINESS_TIME_SLOTS.length) {
                    setEndTime(BUSINESS_TIME_SLOTS[sIdx + 1]);
                  }
                }
              }}
              required
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            >
              {BUSINESS_TIME_SLOTS.slice(0, -1).map((slot) => (
                <option key={slot} value={slot}>
                  {formatSlotLabel(slot)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              End Time
            </label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            >
              {BUSINESS_TIME_SLOTS.filter((slot) => slot > startTime).map((slot) => (
                <option key={slot} value={slot}>
                  {formatSlotLabel(slot)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Conflict Feedback Indicator */}
        <div className="pt-1">
          {isInvalidTimeOrder ? (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
              <span>Ensure the end time is after start time.</span>
            </div>
          ) : isCheckingConflict ? (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span>Checking real-time slot availability...</span>
            </div>
          ) : availabilityStatus === "available" ? (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-medium">Time slot is available for booking.</span>
            </div>
          ) : availabilityStatus === "conflict" ? (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Conflict Detected:</span> This time slot overlaps with an existing reservation or pending request. Choose a different time or resource.
              </div>
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
            disabled={isSubmitting || availabilityStatus === "conflict" || isInvalidTimeOrder || activeResources.length === 0}
            disabled={
              isSubmitting ||
              availabilityStatus === "conflict" ||
              isInvalidTimeOrder ||
              activeResources.length === 0 ||
              (isAdmin && bookingMode === "behalf" && !targetUserId)
            }
            className="rounded-xl text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Submitting Request...
              </>
            ) : isAdmin && bookingMode === "behalf" ? (
              "Confirm & Approve Booking"
            ) : (
              "Submit Reservation"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
