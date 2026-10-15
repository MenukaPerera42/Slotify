"use client";

import { useState, useRef, useEffect } from "react";
import {
  Building2,
  Monitor,
  Cpu,
  Layers,
  ChevronLeft,
  Plus,
  CalendarX2,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Edit3,
  Loader2,
  Eye,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  correctReservationDepartmentAction,
  getReservationAction,
  updateReservationTimeAction,
  adminRemoveBookingAction,
} from "@/features/reservations/actions/reservation-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  formatColomboInterval,
  formatColomboDate,
  formatColomboFullDate,
  formatColomboTime,
  createColomboISO,
} from "@/features/reservations/utils/client-date";
import {
  getDepartmentColorScheme,
} from "@/features/departments/utils/department-colors";
import {
  generateShiftTimelineSlots,
  formatShiftHours,
} from "@/features/office-shifts/utils/shift-client-utils";
import type { EffectiveSchedule } from "@/features/office-shifts/types/effective-schedule";
import { minuteToTimeStr } from "@/features/office-shifts/utils/shift-client-utils";
import { selectFreeTimelineRange } from "../utils/timeline-range";
import { applyConfirmedTime, bookedTimelineResources, dragOverlapsBooking, proposeTimelineDrag, type ConfirmedReservationTime, type DragMode } from "../utils/timeline-interactions";

export interface ReservationOccupancy {
  id?: string;
  resourceId: string;
  departmentId?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  updatedAt?: Date | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  title?: string;
  reservationIds?: string[];
  user?: { name: string; email: string };
  bookings?: {
    id: string;
    title: string;
    userId: string | null;
    startTime?: Date | string;
    endTime?: Date | string;
    updatedAt?: Date | string;
  }[];
  outsideEffectiveWindow?: boolean;
}

export interface TimelineResourceItem {
  id: string;
  name: string;
  location?: string | null;
  capacity?: number | null;
  isActive?: boolean;
  category?: {
    id?: string;
    name: string;
  } | null;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export interface TimelineGridProps {
  resources: TimelineResourceItem[];
  selectedDate: string;
  occupancy?: ReservationOccupancy[];
  effectiveSchedule?: EffectiveSchedule | null;
  departments?: DepartmentOption[];
  isAdmin?: boolean;
  onSelectRange?: (resourceId: string, startTime: string, endTime: string) => void;
  onNewReservation?: () => void;
  onBrowseResources?: () => void;
  onRefresh?: () => void;
  onReservationTimeSaved?: (reservation: ConfirmedReservationTime) => void;
  isLoading?: boolean;
}

export function TimelineGrid({
  resources,
  selectedDate,
  occupancy: rawOccupancy = [],
  effectiveSchedule,
  departments = [],
  isAdmin = false,
  onSelectRange,
  onNewReservation,
  onBrowseResources,
  onRefresh,
  onReservationTimeSaved,
  isLoading = false,
}: TimelineGridProps) {
  const router = useRouter();
  const toast = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [rangeAnchor, setRangeAnchor] = useState<{ resourceId: string; index: number; date: string; timelineStartMs: number } | null>(null);
  const [rangeHover, setRangeHover] = useState<number | null>(null);

  // Helper to extract Colombo HH:MM time
  const getColomboHHMM = (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Colombo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  };

  // Detail inspection modal state
  const [inspectBooking, setInspectBooking] = useState<{
    booking: ReservationOccupancy;
    resource: TimelineResourceItem;
  } | null>(null);

  // One pointer interaction handles body moves and independent edge resizes.
  type BookingDrag = {
    bookingId: string;
    reservationId: string;
    resource: TimelineResourceItem;
    booking: ReservationOccupancy;
    edge: DragMode;
    startX: number;
    pointerId: number;
    containerWidth: number;
    initialStartMs: number;
    initialEndMs: number;
    proposedStartMs: number;
    proposedEndMs: number;
    hasMoved: boolean;
    invalidReason: "shift" | "conflict" | null;
    expectedUpdatedAt: string;
  };
  const [dragState, setDragState] = useState<BookingDrag | null>(null);
  const dragRef = useRef<BookingDrag | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [confirmedTimes, setConfirmedTimes] = useState<Record<string, ConfirmedReservationTime>>({});

  // Modal to confirm time adjustment after dragging
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    reservationId: string;
    resourceName: string;
    departmentName: string;
    title?: string;
    originalStart: Date;
    originalEnd: Date;
    proposedStart: Date;
    proposedEnd: Date;
    expectedUpdatedAt: string;
    isSubmitting: boolean;
    error: string | null;
    isStale: boolean;
  } | null>(null);

  // Accessible fallback modal for keyboard/touch/individual grouped booking editing
  const [accessibleEditModalState, setAccessibleEditModalState] = useState<{
    isOpen: boolean;
    reservationId: string;
    resourceName: string;
    title?: string;
    dateStr: string;
    startTimeStr: string;
    endTimeStr: string;
    expectedUpdatedAt: string;
    isSubmitting: boolean;
    error: string | null;
    isStale: boolean;
  } | null>(null);

  // Admin Remove Booking confirmation modal state
  const [removeModalState, setRemoveModalState] = useState<{
    isOpen: boolean;
    reservationId: string;
    resourceName: string;
    title: string;
    departmentName: string;
    dateStr: string;
    startTime: Date | string;
    endTime: Date | string;
    status: string;
    isSubmitting: boolean;
    error: string | null;
  } | null>(null);

  // Department correction form state inside inspection modal
  const [isCorrectingDept, setIsCorrectingDept] = useState(false);
  const [correctTargetDeptId, setCorrectTargetDeptId] = useState("");
  const [correctReason, setCorrectReason] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [selectedCorrectionResId, setSelectedCorrectionResId] = useState<string>("");
  const [correctionFieldErrors, setCorrectionFieldErrors] = useState<Record<string, string[]>>({});
  const [correctionGeneralError, setCorrectionGeneralError] = useState<string | null>(null);

  // Drawer for outside-window reservations
  const [showOutsideWindowDrawer, setShowOutsideWindowDrawer] = useState(false);

  // Determine operational shift boundaries
  const [year, month, day] = selectedDate.split("-").map(Number);

  let startMinute = 540; // 09:00 default
  let durationMinutes = 540; // 9 hours default
  let timelineStartUtc = Date.UTC(year, month - 1, day, 9, 0, 0) - 5.5 * 3600 * 1000;
  let timelineEndUtc = Date.UTC(year, month - 1, day, 18, 0, 0) - 5.5 * 3600 * 1000;
  let policyName = "Legacy display window";
  let policyMode = "CUSTOM";
  let isEnforced = false;
  let outsideWindowList: ReservationOccupancy[] = [];
  let effectiveOccupancy = rawOccupancy;

  if (effectiveSchedule) {
    startMinute = effectiveSchedule.startMinute;
    durationMinutes = effectiveSchedule.durationMinutes;
    timelineStartUtc = new Date(effectiveSchedule.startTime).getTime();
    timelineEndUtc = new Date(effectiveSchedule.endTime).getTime();
    policyName = effectiveSchedule.policy.name;
    policyMode = effectiveSchedule.policy.mode;
    isEnforced = effectiveSchedule.enforced;
    outsideWindowList = (effectiveSchedule.outsideWindowOccupancy || []) as unknown as ReservationOccupancy[];
    effectiveOccupancy = (effectiveSchedule.occupancy || rawOccupancy) as unknown as ReservationOccupancy[];
  }

  const totalTimelineMs = timelineEndUtc - timelineStartUtc;
  const activeAnchor = rangeAnchor?.date === selectedDate && rangeAnchor.timelineStartMs === timelineStartUtc ? rangeAnchor : null;
  const canSelectFreeRange = Boolean(onSelectRange && effectiveSchedule?.operationalDate === selectedDate);

  // Generate dynamic 30-min time slots
  const timeSlots = generateShiftTimelineSlots(startMinute, durationMinutes);

  // Width calculation for horizontal scroll (minimum 42px per half-hour column)
  const gridMinWidth = Math.max(960, timeSlots.length * 44);

  const displayedOccupancy = Object.values(confirmedTimes).reduce(
    (items, confirmed) => {
      const current = items.find((item) => item.id === confirmed.id);
      if (!current || (current.updatedAt && new Date(current.updatedAt).getTime() >= new Date(confirmed.updatedAt).getTime())) return items;
      return applyConfirmedTime(items, confirmed);
    }, effectiveOccupancy,
  );
  const timelineResources = bookedTimelineResources(resources, displayedOccupancy, timelineStartUtc, timelineEndUtc);
  const shiftHoursLabel = formatShiftHours(startMinute, durationMinutes);
  const isDragging = dragState !== null;

  const renderIcon = (catName?: string) => {
    const lower = (catName || "").toLowerCase();
    if (
      lower.includes("meeting") ||
      lower.includes("room") ||
      lower.includes("board")
    ) {
      return <Building2 className="h-5 w-5" />;
    }
    if (
      lower.includes("workstation") ||
      lower.includes("desk") ||
      lower.includes("pod")
    ) {
      return <Monitor className="h-5 w-5" />;
    }
    if (
      lower.includes("lab") ||
      lower.includes("equipment") ||
      lower.includes("gpu")
    ) {
      return <Cpu className="h-5 w-5" />;
    }
    return <Layers className="h-5 w-5" />;
  };

  /**
   * Computes horizontal positioning percentage for a continuous reservation block.
   */
  const computePosition = (
    startTime: Date | string,
    endTime: Date | string,
    bookingKey?: string
  ) => {
    let s = new Date(startTime).getTime();
    let e = new Date(endTime).getTime();

    if (dragState && bookingKey && dragState.bookingId === bookingKey) {
      s = dragState.proposedStartMs;
      e = dragState.proposedEndMs;
      if (e <= s) {
        s = dragState.initialStartMs;
        e = dragState.initialEndMs;
      } else if (e <= timelineStartUtc) {
        e = timelineStartUtc + (e - s);
        s = timelineStartUtc;
      } else if (s >= timelineEndUtc) {
        s = timelineEndUtc - (e - s);
        e = timelineEndUtc;
      }
    }

    // Clip to visible window
    const visibleStart = Math.max(s, timelineStartUtc);
    const visibleEnd = Math.min(e, timelineEndUtc);

    if (visibleEnd <= visibleStart) return null;

    const leftPercent =
      ((visibleStart - timelineStartUtc) / totalTimelineMs) * 100;
    const widthPercent = ((visibleEnd - visibleStart) / totalTimelineMs) * 100;

    return {
      left: Math.max(0, leftPercent),
      width: Math.min(100 - leftPercent, widthPercent),
      startsBefore: s < timelineStartUtc,
      endsAfter: e > timelineEndUtc,
    };
  };

  const bookingRevision = (booking: ReservationOccupancy, reservationId: string) => {
    const detail = booking.bookings?.find((item) => item.id === reservationId);
    const value = detail?.updatedAt ?? (booking.id === reservationId ? booking.updatedAt : null);
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  // Initiate pointer drag on left or right handle
  const handleStartDrag = (
    e: React.PointerEvent,
    booking: ReservationOccupancy,
    resource: TimelineResourceItem,
    edge: DragMode
  ) => {
    if (!isAdmin) return;
    const count = booking.reservationIds?.length ?? 1;
    if (count > 1) return; // Grouped reservations must be edited individually through details modal

    e.stopPropagation();
    e.preventDefault();

    const reservationId = booking.reservationIds?.[0] || booking.id || "";
    const expectedUpdatedAt = bookingRevision(booking, reservationId);
    if (!reservationId || !expectedUpdatedAt) {
      toast.error("Booking details are incomplete. Refresh the schedule before editing.");
      onRefresh?.();
      return;
    }

    const initialStartMs = new Date(booking.startTime).getTime();
    const initialEndMs = new Date(booking.endTime).getTime();

    const bookingKey = booking.id || booking.reservationIds?.[0] || `${booking.resourceId}`;
    const containerWidth = (e.currentTarget.closest('[data-timeline-container="true"]') as HTMLElement | null)?.getBoundingClientRect().width || 1000;
    const next: BookingDrag = {
      bookingId: bookingKey,
      reservationId,
      resource,
      booking,
      edge,
      startX: e.clientX,
      pointerId: e.pointerId,
      containerWidth,
      initialStartMs,
      initialEndMs,
      proposedStartMs: initialStartMs,
      proposedEndMs: initialEndMs,
      hasMoved: false,
      invalidReason: null,
      expectedUpdatedAt,
    };
    dragRef.current = next;
    setDragState(next);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      const deltaX = e.clientX - current.startX;
      if (!current.hasMoved && Math.abs(deltaX) <= 5) return;
      const proposal = proposeTimelineDrag({
        mode: current.edge,
        initialStartMs: current.initialStartMs,
        initialEndMs: current.initialEndMs,
        deltaX,
        containerWidth: current.containerWidth,
        windowStartMs: timelineStartUtc,
        windowEndMs: timelineEndUtc,
        intervalMinutes: effectiveSchedule?.timelineIntervalMinutes ?? 30,
      });
      const invalidReason = proposal.outsideShift ? "shift" :
        dragOverlapsBooking(effectiveOccupancy, current.resource.id, current.reservationId, proposal.startMs, proposal.endMs)
          ? "conflict" : null;
      const next = { ...current, proposedStartMs: proposal.startMs, proposedEndMs: proposal.endMs,
        hasMoved: true, invalidReason } satisfies BookingDrag;
      dragRef.current = next;
      setDragState(next);
    };

    const onPointerUp = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      const {
        hasMoved, invalidReason,
        proposedStartMs,
        proposedEndMs,
        initialStartMs,
        initialEndMs,
        reservationId,
        resource,
        booking,
        expectedUpdatedAt,
      } = current;

      dragRef.current = null;
      setDragState(null);
      if (hasMoved) suppressClickUntilRef.current = performance.now() + 350;

      if (hasMoved && invalidReason) {
        toast.error(invalidReason === "shift" ? `Choose a time within the office shift (${shiftHoursLabel}).` :
          "That time is occupied by another booking. Choose a different interval.");
        return;
      }

      if (hasMoved && (proposedStartMs !== initialStartMs || proposedEndMs !== initialEndMs)) {
        const department = departments.find((item) => item.id === booking.departmentId);
        setConfirmModalState({
          isOpen: true,
          reservationId,
          resourceName: resource.name,
          departmentName: department?.name || "Unassigned / Legacy",
          title: booking.title,
          originalStart: new Date(initialStartMs),
          originalEnd: new Date(initialEndMs),
          proposedStart: new Date(proposedStartMs),
          proposedEnd: new Date(proposedEndMs),
          expectedUpdatedAt,
          isSubmitting: false,
          error: null,
          isStale: false,
        });
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isDragging, timelineStartUtc, timelineEndUtc, effectiveSchedule?.timelineIntervalMinutes, effectiveOccupancy, departments, shiftHoursLabel, toast]);

  // Commit proposed drag time change to database
  const handleConfirmTimeChange = async () => {
    if (!confirmModalState || confirmModalState.isStale || confirmModalState.isSubmitting) return;

    setConfirmModalState((prev) => (prev ? { ...prev, isSubmitting: true, error: null } : null));

    try {
      const res = await updateReservationTimeAction({
        reservationId: confirmModalState.reservationId,
        startTime: confirmModalState.proposedStart.toISOString(),
        endTime: confirmModalState.proposedEnd.toISOString(),
        expectedUpdatedAt: confirmModalState.expectedUpdatedAt,
      });

      if (res.success) {
        const confirmed = res.data.reservation;
        setConfirmedTimes((previous) => ({ ...previous, [confirmed.id]: confirmed }));
        onReservationTimeSaved?.(confirmed);
        toast.success("Reservation time updated successfully.");
        setConfirmModalState(null);
        if (!onReservationTimeSaved) onRefresh?.();
        router.refresh();
      } else {
        let errorMsg = res.error || "Failed to update reservation time.";
        if (res.code === "SLOT_CONFLICT") {
          errorMsg = "That time is occupied by another booking. Choose a different interval.";
        } else if (res.code === "OUTSIDE_SHIFT_HOURS") {
          errorMsg = `Choose a time within the office shift (${shiftHoursLabel}).`;
        } else if (res.code === "STALE_UPDATE") {
          errorMsg = "This booking changed. Reload its latest time before resizing again.";
        } else if (res.code === "INVALID_TIME_RANGE") {
          errorMsg = "End time must be after start time.";
        } else if (res.code === "FORBIDDEN" || res.code === "UNAUTHENTICATED") {
          errorMsg = "Administrator access is required to adjust this booking.";
        } else if (res.code === "DATABASE_ERROR") {
          errorMsg = "The booking could not be saved. Please try again.";
        }
        setConfirmModalState((prev) => (prev ? { ...prev, isSubmitting: false, error: errorMsg, isStale: res.code === "STALE_UPDATE" } : null));
      }
    } catch {
      setConfirmModalState((prev) => (prev ? { ...prev, isSubmitting: false, error: "Network error while saving." } : null));
    }
  };

  const reloadLatestBooking = async (reservationId: string) => {
    const result = await getReservationAction(reservationId);
    if (!result.success) {
      toast.error(result.error || "Unable to reload this booking.");
      return;
    }
    setConfirmModalState(null);
    setAccessibleEditModalState(null);
    setInspectBooking(null);
    onRefresh?.();
    router.refresh();
  };

  // Open accessible edit times modal for a single booking
  const openAccessibleEditModal = (
    booking: ReservationOccupancy,
    resource: TimelineResourceItem
  ) => {
    const reservationId = booking.reservationIds?.[0] || booking.id || "";
    const expectedUpdatedAt = bookingRevision(booking, reservationId);
    if (!reservationId || !expectedUpdatedAt) {
      toast.error("Booking details are incomplete. Refresh the schedule before editing.");
      onRefresh?.();
      return;
    }

    setInspectBooking(null);
    setAccessibleEditModalState({
      isOpen: true,
      reservationId,
      resourceName: resource.name,
      title: booking.title,
      dateStr: selectedDate,
      startTimeStr: getColomboHHMM(booking.startTime),
      endTimeStr: getColomboHHMM(booking.endTime),
      expectedUpdatedAt,
      isSubmitting: false,
      error: null,
      isStale: false,
    });
  };

  // Open accessible edit times modal for an individual segment in a grouped booking
  const openAccessibleEditModalForSegment = (
    b: { id: string; title: string; startTime?: Date | string; endTime?: Date | string; updatedAt?: Date | string },
    resource: TimelineResourceItem
  ) => {
    const startIso = b.startTime || inspectBooking?.booking.startTime || new Date();
    const endIso = b.endTime || inspectBooking?.booking.endTime || new Date();
    const expectedUpdatedAt = b.updatedAt ? new Date(b.updatedAt).toISOString() : null;
    if (!expectedUpdatedAt) {
      toast.error("Booking details are incomplete. Refresh the schedule before editing.");
      onRefresh?.();
      return;
    }

    setInspectBooking(null);
    setAccessibleEditModalState({
      isOpen: true,
      reservationId: b.id,
      resourceName: resource.name,
      title: b.title,
      dateStr: selectedDate,
      startTimeStr: getColomboHHMM(startIso),
      endTimeStr: getColomboHHMM(endIso),
      expectedUpdatedAt,
      isSubmitting: false,
      error: null,
      isStale: false,
    });
  };

  // Save accessible edit modal time changes
  const handleSaveAccessibleEdit = async () => {
    if (!accessibleEditModalState || accessibleEditModalState.isStale) return;

    const startIso = createColomboISO(accessibleEditModalState.dateStr, accessibleEditModalState.startTimeStr);
    const endIso = createColomboISO(accessibleEditModalState.dateStr, accessibleEditModalState.endTimeStr);

    if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
      setAccessibleEditModalState((prev) => (prev ? { ...prev, error: "End time must be after start time." } : null));
      return;
    }

    setAccessibleEditModalState((prev) => (prev ? { ...prev, isSubmitting: true, error: null } : null));

    try {
      const res = await updateReservationTimeAction({
        reservationId: accessibleEditModalState.reservationId,
        startTime: startIso,
        endTime: endIso,
        expectedUpdatedAt: accessibleEditModalState.expectedUpdatedAt,
      });

      if (res.success) {
        const confirmed = res.data.reservation;
        setConfirmedTimes((previous) => ({ ...previous, [confirmed.id]: confirmed }));
        onReservationTimeSaved?.(confirmed);
        toast.success("Reservation time updated successfully.");
        setAccessibleEditModalState(null);
        setInspectBooking(null);
        if (!onReservationTimeSaved) onRefresh?.();
        router.refresh();
      } else {
        let errorMsg = res.error || "Failed to update reservation time.";
        if (res.code === "SLOT_CONFLICT") {
          errorMsg = "That time is occupied by another booking. Choose a different interval.";
        } else if (res.code === "OUTSIDE_SHIFT_HOURS") {
          errorMsg = `Choose a time within the office shift (${shiftHoursLabel}).`;
        } else if (res.code === "STALE_UPDATE") {
          errorMsg = "This booking changed. Reload its latest time before editing again.";
        } else if (res.code === "INVALID_TIME_RANGE") {
          errorMsg = "End time must be after start time.";
        }
        setAccessibleEditModalState((prev) => (prev ? { ...prev, isSubmitting: false, error: errorMsg, isStale: res.code === "STALE_UPDATE" } : null));
      }
    } catch {
      setAccessibleEditModalState((prev) => (prev ? { ...prev, isSubmitting: false, error: "Network error while saving." } : null));
    }
  };

  // Open Admin Remove Booking confirmation modal for single booking
  const openRemoveBookingModal = (
    booking: ReservationOccupancy,
    resource: TimelineResourceItem
  ) => {
    const reservationId = booking.reservationIds?.[0] || booking.id || "";
    const dept = departments.find((d) => d.id === booking.departmentId);
    const departmentName = dept ? `${dept.name} (${dept.code})` : "Unassigned / Legacy";

    setRemoveModalState({
      isOpen: true,
      reservationId,
      resourceName: resource.name,
      title: booking.title || "Reservation",
      departmentName,
      dateStr: selectedDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      isSubmitting: false,
      error: null,
    });
  };

  // Open Admin Remove Booking confirmation modal for a specific segment in a grouped booking
  const openRemoveBookingModalForSegment = (
    segment: { id: string; title: string; startTime?: Date | string; endTime?: Date | string },
    resource: TimelineResourceItem,
    departmentId?: string | null
  ) => {
    const dept = departments.find((d) => d.id === departmentId);
    const departmentName = dept ? `${dept.name} (${dept.code})` : "Unassigned / Legacy";

    setRemoveModalState({
      isOpen: true,
      reservationId: segment.id,
      resourceName: resource.name,
      title: segment.title || "Reserved Segment",
      departmentName,
      dateStr: selectedDate,
      startTime: segment.startTime || selectedDate,
      endTime: segment.endTime || selectedDate,
      status: "APPROVED",
      isSubmitting: false,
      error: null,
    });
  };

  // Confirm booking removal via admin action
  const handleConfirmRemoveBooking = async () => {
    if (!removeModalState) return;

    setRemoveModalState((prev) => (prev ? { ...prev, isSubmitting: true, error: null } : null));

    try {
      const res = await adminRemoveBookingAction(removeModalState.reservationId);
      if (res.success) {
        toast.success(`Booking "${removeModalState.title}" removed successfully.`);
        const removedId = removeModalState.reservationId;
        setRemoveModalState(null);

        // Update or close inspectBooking if open
        setInspectBooking((prev) => {
          if (!prev) return null;
          const remainingIds = prev.booking.reservationIds?.filter((id) => id !== removedId);
          const remainingBookings = prev.booking.bookings?.filter((b) => b.id !== removedId);
          if (!remainingIds || remainingIds.length === 0) {
            return null;
          }
          return {
            ...prev,
            booking: {
              ...prev.booking,
              reservationIds: remainingIds,
              bookings: remainingBookings,
            },
          };
        });

        onRefresh?.();
        router.refresh();
      } else {
        const errorMsg = res.error || "Failed to remove booking.";
        setRemoveModalState((prev) => (prev ? { ...prev, isSubmitting: false, error: errorMsg } : null));
        toast.error(errorMsg);
      }
    } catch {
      setRemoveModalState((prev) => (prev ? { ...prev, isSubmitting: false, error: "Network error while removing booking." } : null));
      toast.error("Failed to remove booking.");
    }
  };

  /**
   * Tests if a single 30-minute slot is blocked by any reservation on this resource.
   */
  const isSlotBlocked = (resourceId: string, minuteOffset: number) => {
    const slotStartUtc = timelineStartUtc + minuteOffset * 60_000;
    const slotEndUtc = slotStartUtc + 30 * 60_000;

    for (const res of effectiveOccupancy) {
      if (res.resourceId !== resourceId) continue;
      if (res.status !== "PENDING" && res.status !== "APPROVED") continue;

      const s = new Date(res.startTime).getTime();
      const e = new Date(res.endTime).getTime();

      if (s < slotEndUtc && e > slotStartUtc) {
        return true;
      }
    }
    return false;
  };

  const chooseFreeSlot = (resourceId: string, index: number) => {
    if (!onSelectRange || !canSelectFreeRange) return;
    if (!activeAnchor || activeAnchor.resourceId !== resourceId) {
      setRangeAnchor({ resourceId, index, date: selectedDate, timelineStartMs: timelineStartUtc });
      setRangeHover(index);
      return;
    }
    const range = selectFreeTimelineRange(resourceId, activeAnchor.index, index,
      timelineStartUtc, timelineEndUtc, 30, effectiveOccupancy);
    setRangeAnchor(null);
    setRangeHover(null);
    if (!range) {
      toast.error("That range crosses a booking or the office shift boundary. Select free slots only.");
      return;
    }
    onSelectRange(resourceId,
      minuteToTimeStr(startMinute + range.startIndex * 30),
      minuteToTimeStr(startMinute + range.endIndex * 30));
  };

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      {/* Outside-Window Commitments Banner (Zero Silent Hiding) */}
      {outsideWindowList.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 sm:p-4 text-xs shadow-2xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>{outsideWindowList.length}</strong> {outsideWindowList.length === 1 ? "reservation is" : "reservations are"} scheduled on this date outside the active <strong>{policyName}</strong> hours.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowOutsideWindowDrawer((prev) => !prev)}
              className="text-xs font-bold text-amber-900 underline hover:text-amber-700 self-start sm:self-auto flex items-center gap-1"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>
                {showOutsideWindowDrawer
                  ? "Hide Outside-Window Commitments"
                  : `Inspect Commitments (${outsideWindowList.length})`}
              </span>
            </button>
          </div>

          {showOutsideWindowDrawer && (
            <div className="pt-2 border-t border-amber-200/80">
              <div className="max-h-48 overflow-y-auto rounded-xl bg-white border border-amber-200/70 divide-y divide-slate-100">
                {outsideWindowList.map((item, idx) => {
                  const targetRes = resources.find((r) => r.id === item.resourceId);
                  const resName = targetRes?.name || "Resource";
                  return (
                    <div
                      key={item.id || `${item.resourceId}-${idx}`}
                      className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{resName}</span>
                          {item.title && (
                            <span className="text-slate-600 font-medium truncate max-w-xs">
                              · {item.title}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {formatColomboInterval(item.startTime, item.endTime)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            item.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          )}
                        >
                          {item.status}
                        </span>
                        {targetRes && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setInspectBooking({
                                booking: item,
                                resource: targetRes,
                              })
                            }
                            className="h-6 px-2 text-[10px] rounded-lg"
                          >
                            Details
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Schedule Container */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden min-w-0 max-w-full">
        {/* Full Date & Dynamic Shift Header Banner */}
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">
              {formatColomboFullDate(selectedDate)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-500">
              Asia/Colombo (UTC+05:30)
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              <Clock className="h-3 w-3 text-blue-600" />
              <span>{policyName}</span>
              <span className="text-blue-600 font-normal">({policyMode})</span>
            </span>
            {isEnforced ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Enforced
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Display Fallback
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            {timeSlots.length >= 32 && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Scroll horizontally to view 24h &rarr;
              </span>
            )}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>{shiftHoursLabel}</span>
            </div>
          </div>
        </div>

        {onSelectRange && !isLoading && timelineResources.length > 0 && (
          <div className="px-4 py-2 border-b border-blue-100 bg-blue-50/50 text-[11px] text-blue-800" aria-live="polite">
            {!canSelectFreeRange
              ? "Loading office shift availability before range selection…"
              : activeAnchor
              ? "Choose the ending free slot on the same resource. Select the same slot for 30 minutes; press Escape to cancel."
              : "To book a free range, select its first slot, then its last slot on the same resource."}
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Loading schedule timeline...</span>
          </div>
        ) : timelineResources.length === 0 ? (
          /* Empty State: No reservations scheduled for this date */
          <div className="py-12 px-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-2xs">
              <CalendarX2 className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                No reservations scheduled for this date.
              </h3>
              <p className="text-xs text-slate-400">
                There are no active reservations on{" "}
                {formatColomboDate(selectedDate, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}{" "}
                during the {policyName} shift ({shiftHoursLabel}). All active resources are open for booking.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {onNewReservation && (
                <Button
                  onClick={onNewReservation}
                  size="sm"
                  className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Reservation</span>
                </Button>
              )}
              {onBrowseResources && (
                <Button
                  onClick={onBrowseResources}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs text-slate-700 border-slate-300 font-semibold"
                >
                  Browse Catalog
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Only resources with blocking bookings in this window are shown. */
          <div className="overflow-x-auto relative max-w-full overscroll-x-contain" ref={scrollContainerRef}>
            <div style={{ minWidth: `${gridMinWidth}px` }}>
              {/* Header Row: Sticky Resources column + Dynamic Time markers */}
              <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                {/* Sticky Left Resource Column */}
                <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-800 flex items-center justify-between sticky left-0 z-20 bg-slate-50 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  <span>Resources</span>
                  <span className="text-slate-400">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </span>
                </div>

                {/* Dynamic 30-min Time Interval Columns */}
                <div
                  className="flex-1 grid divide-x divide-[#E5E7EB] text-center"
                  style={{
                    gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))`,
                  }}
                >
                  {timeSlots.map((slot) => (
                    <div
                      key={`${slot.slotTime}-${slot.minuteOffset}`}
                      className={cn(
                        "py-2.5 truncate font-medium text-[10px] transition-colors",
                        slot.isMidnight
                          ? "bg-indigo-50/60 font-bold text-indigo-900 border-indigo-200"
                          : slot.isNoon
                          ? "bg-amber-50/50 font-bold text-amber-900"
                          : slot.isRollover
                          ? "text-blue-900/80 bg-blue-50/20"
                          : "text-slate-600"
                      )}
                      title={`${slot.label}${slot.isNoon ? " (Noon)" : slot.isMidnight ? " (Midnight Rollover)" : ""}`}
                    >
                      {slot.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Resource Rows: ONLY Booked Resources */}
              <div className="divide-y divide-[#E5E7EB]">
                {timelineResources.map((res) => {
                  const resourceBookings = displayedOccupancy.filter(
                    (o) =>
                      o.resourceId === res.id &&
                      (o.status === "PENDING" || o.status === "APPROVED")
                  );

                  return (
                    <div
                      key={res.id}
                      className="flex items-center hover:bg-slate-50/30 transition-colors"
                    >
                      {/* Left Column: Sticky Resource Identity */}
                      <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 flex items-center gap-3 sticky left-0 z-20 bg-white shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                        <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          {renderIcon(res.category?.name)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {res.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {res.location}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {res.capacity
                              ? `${res.capacity} People`
                              : "Individual"}
                          </p>
                        </div>
                      </div>

                      {/* Right Columns: Continuous Timeline Container */}
                      <div className="flex-1 relative h-14 bg-white" data-timeline-container="true">
                        {/* 1. Underlying 30-min Grid Cells for Click-to-Book */}
                        <div
                          className="absolute inset-0 grid divide-x divide-[#E5E7EB]"
                          style={{
                            gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {timeSlots.map((slot, slotIndex) => {
                            const blocked = isSlotBlocked(res.id, slot.minuteOffset);
                            const preview = activeAnchor?.resourceId === res.id && rangeHover !== null
                              ? selectFreeTimelineRange(res.id, activeAnchor.index, rangeHover,
                                  timelineStartUtc, timelineEndUtc, 30, effectiveOccupancy)
                              : null;
                            const isSelected = preview && slotIndex >= preview.startIndex && slotIndex < preview.endIndex;
                            return (
                              <button
                                type="button"
                                key={`${slot.slotTime}-${slot.minuteOffset}`}
                                disabled={!res.isActive || blocked || !canSelectFreeRange}
                                onClick={() => chooseFreeSlot(res.id, slotIndex)}
                                onPointerEnter={() => {
                                  if (activeAnchor?.resourceId === res.id) setRangeHover(slotIndex);
                                }}
                                onFocus={() => {
                                  if (activeAnchor?.resourceId === res.id) setRangeHover(slotIndex);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    setRangeAnchor(null);
                                    setRangeHover(null);
                                  }
                                }}
                                aria-label={`${res.name}, ${slot.label}, ${blocked ? "reserved" : "free"}${activeAnchor ? ", choose range end" : ", choose range start"}`}
                                aria-pressed={Boolean(isSelected)}
                                className={cn(
                                  "h-full relative flex items-center justify-center transition-colors group/cell focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:z-10",
                                  blocked
                                    ? "bg-transparent cursor-default"
                                    : res.isActive
                                    ? "hover:bg-blue-50/40 cursor-pointer"
                                    : "bg-slate-50/40 cursor-not-allowed opacity-60",
                                  isSelected && "bg-blue-100/80 ring-inset ring-1 ring-blue-300"
                                )}
                                title={
                                  blocked
                                    ? undefined
                                    : res.isActive
                                    ? `Available · Select ${slot.label} on ${res.name} to ${activeAnchor ? "end" : "start"} a booking range`
                                    : `${res.name} is inactive`
                                }
                              >
                                {res.isActive && !blocked && (
                                  <span className="opacity-0 group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100 text-blue-600 transition-opacity">
                                    <Plus className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* 2. Overlaid Continuous Reservation Blocks */}
                        <div className="absolute inset-0 pointer-events-none p-1.5 flex items-center">
                          {resourceBookings.map((booking, bIdx) => {
                            const bookingKey =
                              booking.id ||
                              booking.reservationIds?.[0] ||
                              `${booking.resourceId}-${bIdx}`;
                            const pos = computePosition(
                              booking.startTime,
                              booking.endTime,
                              bookingKey
                            );
                            if (!pos) return null;

                            const isPending = booking.status === "PENDING";
                            const dept = departments.find(
                              (d) => d.id === booking.departmentId
                            );
                            const isLegacy = !booking.departmentId;
                            const colorScheme = getDepartmentColorScheme(
                              dept?.code,
                              dept?.name
                            );

                            const count =
                              booking.reservationIds?.length ?? 1;
                            const isGrouped = count > 1;

                            const isWide = pos.width >= 26;
                            const isNarrow = pos.width < 10;
                            const compactTime = (value: Date | string) => {
                              const [hour, minute] = getColomboHHMM(value).split(":");
                              return `${Number(hour) % 12 || 12}${minute === "00" ? "" : `:${minute}`}`;
                            };
                            const compactInterval = `${compactTime(booking.startTime)}–${compactTime(booking.endTime)}`;

                            const isDraggingThis =
                              dragState?.bookingId === bookingKey;

                            const statusLabel = isPending
                              ? "Pending Approval"
                              : "Reserved";
                            const intervalStr = isDraggingThis
                              ? formatColomboInterval(
                                  new Date(dragState.proposedStartMs),
                                  new Date(dragState.proposedEndMs)
                                )
                              : formatColomboInterval(
                                  booking.startTime,
                                  booking.endTime
                                );

                            const tooltipText = [
                              `${statusLabel} · ${intervalStr}`,
                              isLegacy
                                ? "Department: Unassigned / Legacy"
                                : dept
                                ? `Department: ${dept.name} (${dept.code})`
                                : `Department: ${colorScheme.name}`,
                              isGrouped
                                ? `Grouped reservations: ${count}`
                                : null,
                              isAdmin && booking.title
                                ? `Title: ${booking.title}`
                                : null,
                              isAdmin && booking.user?.name
                                ? `User: ${booking.user.name}`
                                : null,
                              isAdmin && !isGrouped
                                ? "Drag the block to move it; drag handles to adjust times"
                                : null,
                              "Click to inspect details",
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            return (
                              <div
                                key={bookingKey}
                                className={cn("group/block absolute top-1.5 bottom-1.5 pointer-events-auto", isDraggingThis && "z-30 transition-[left,width] duration-100 ease-out", isDraggingThis && dragState.invalidReason && "z-30")}
                                style={{
                                  left: `${pos.left}%`,
                                  width: `${pos.width}%`,
                                }}
                              >
                                {/* Floating Live Time Drag Preview */}
                                {isDraggingThis && (
                                  <div className={cn("absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md pointer-events-none z-40 whitespace-nowrap flex items-center gap-1 ring-1 ring-white/20", dragState.invalidReason && "bg-rose-700")}>
                                    <Clock className="h-3 w-3 text-blue-400" />
                                    <span>
                                      {formatColomboInterval(
                                        new Date(dragState.proposedStartMs),
                                        new Date(dragState.proposedEndMs)
                                      )}
                                      {dragState.invalidReason && " · Unavailable"}
                                    </span>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onPointerDown={(e) => {
                                    if (isAdmin && !isGrouped && bookingRevision(booking, booking.reservationIds?.[0] || booking.id || "")) {
                                      handleStartDrag(e, booking, res, "move");
                                    }
                                  }}
                                  onClick={() => {
                                    if (performance.now() < suppressClickUntilRef.current) {
                                      return;
                                    }
                                    setInspectBooking({
                                      booking,
                                      resource: res,
                                    });
                                  }}
                                  className={cn(
                                    "absolute inset-0 rounded-lg border shadow-2xs transition-all select-none overflow-hidden flex items-center px-1.5 py-0.5 z-10 cursor-pointer text-left hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-blue-500",
                                    isAdmin && !isGrouped && "cursor-grab touch-none hover:shadow-md hover:ring-1 hover:ring-blue-400/50",
                                    isPending && "border-amber-400 border-dashed",
                                    isDraggingThis &&
                                      "ring-2 ring-blue-500 z-30 opacity-95 shadow-md cursor-grabbing",
                                    isDraggingThis && dragState.invalidReason && "!ring-rose-500 !border-rose-500",
                                  )}
                                  style={{
                                    backgroundColor: colorScheme.bg,
                                    borderColor: isPending
                                      ? "#F59E0B"
                                      : colorScheme.border,
                                    color: colorScheme.text,
                                  }}
                                  title={tooltipText}
                                >
                                  <div className={cn("flex w-full min-w-0 max-w-full overflow-hidden", isWide ? "items-center justify-between gap-1" : "flex-col justify-center gap-0.5")}>
                                    <div className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden">
                                      {!isNarrow && (isPending ? (
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                      ) : (
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      ))}
                                      <span
                                        className={cn("min-w-0 max-w-full truncate rounded border px-1 text-[9px] leading-3 font-bold tracking-tight shadow-2xs", isWide && "shrink-0")}
                                        style={{
                                          backgroundColor: colorScheme.badgeBg,
                                          borderColor: colorScheme.badgeBorder,
                                          color: colorScheme.badgeText,
                                        }}
                                      >
                                        {isNarrow
                                          ? isLegacy
                                            ? "—"
                                            : (dept?.code || colorScheme.code || "DEP").slice(0, 3)
                                          : isLegacy
                                          ? "Legacy / Unassigned"
                                          : dept?.code || colorScheme.code}
                                      </span>

                                      {!isNarrow && (
                                        <span className="min-w-0 flex-1 truncate text-[10px] leading-3 font-bold">
                                          {isAdmin && booking.title
                                            ? booking.title
                                            : statusLabel}
                                        </span>
                                      )}
                                    </div>

                                    <div className={cn("flex min-w-0 max-w-full items-center gap-1 overflow-hidden text-[9px] leading-3 font-semibold opacity-90", isWide ? "shrink-0" : "w-full")}>
                                      {isGrouped && !isNarrow && (
                                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-white/90 px-1 text-[8px] font-bold text-slate-800 shadow-2xs">
                                          <Layers className="h-2.5 w-2.5" />
                                          {count}
                                        </span>
                                      )}
                                      <span className={cn("block min-w-0 max-w-full truncate", isNarrow && "text-[8px] tracking-tighter")}>{isWide ? intervalStr : compactInterval}</span>
                                    </div>
                                  </div>

                                </button>
                                {isAdmin && !isGrouped && bookingRevision(booking, booking.reservationIds?.[0] || booking.id || "") && (
                                  <>
                                    <div
                                      role="slider"
                                      tabIndex={0}
                                      aria-label="Adjust start time"
                                      aria-valuenow={new Date(booking.startTime).getTime()}
                                      aria-valuemin={timelineStartUtc}
                                      aria-valuemax={new Date(booking.endTime).getTime() - (effectiveSchedule?.timelineIntervalMinutes ?? 30) * 60 * 1000}
                                      aria-valuetext={formatColomboTime(booking.startTime)}
                                      title="Adjust start time"
                                      onPointerDown={(e) => handleStartDrag(e, booking, res, "start")}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          openAccessibleEditModal(booking, res);
                                        }
                                      }}
                                      className={cn("group/start absolute left-0 top-0 bottom-0 w-4 z-20 cursor-col-resize flex items-center justify-center opacity-0 group-hover/block:opacity-60 hover:!opacity-100 focus-visible:opacity-100 bg-blue-500/15 hover:bg-blue-500/30 focus-visible:bg-blue-500/30 border-l-[3px] border-blue-500/60 hover:border-blue-700 focus-visible:border-blue-700 hover:shadow-[inset_3px_0_8px_rgba(37,99,235,0.22)] transition-opacity duration-150 select-none rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", isDraggingThis && dragState.edge === "start" && "!opacity-100 bg-blue-500/35 border-blue-700 shadow-[inset_3px_0_8px_rgba(37,99,235,0.3)]")}
                                    >
                                      <div className="h-4 w-0.5 rounded-full bg-blue-600 shadow-xs" />
                                      <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 mb-1 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow-sm opacity-0 group-hover/start:opacity-100 group-focus-within/start:opacity-100 transition-opacity">Adjust start time</span>
                                    </div>
                                    <div
                                      role="slider"
                                      tabIndex={0}
                                      aria-label="Adjust end time"
                                      aria-valuenow={new Date(booking.endTime).getTime()}
                                      aria-valuemin={new Date(booking.startTime).getTime() + (effectiveSchedule?.timelineIntervalMinutes ?? 30) * 60 * 1000}
                                      aria-valuemax={timelineEndUtc}
                                      aria-valuetext={formatColomboTime(booking.endTime)}
                                      title="Adjust end time"
                                      onPointerDown={(e) => handleStartDrag(e, booking, res, "end")}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          openAccessibleEditModal(booking, res);
                                        }
                                      }}
                                      className={cn("group/end absolute right-0 top-0 bottom-0 w-4 z-20 cursor-col-resize flex items-center justify-center opacity-0 group-hover/block:opacity-60 hover:!opacity-100 focus-visible:opacity-100 bg-blue-500/15 hover:bg-blue-500/30 focus-visible:bg-blue-500/30 border-r-[3px] border-blue-500/60 hover:border-blue-700 focus-visible:border-blue-700 hover:shadow-[inset_-3px_0_8px_rgba(37,99,235,0.22)] transition-opacity duration-150 select-none rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600", isDraggingThis && dragState.edge === "end" && "!opacity-100 bg-blue-500/35 border-blue-700 shadow-[inset_-3px_0_8px_rgba(37,99,235,0.3)]")}
                                    >
                                      <div className="h-4 w-0.5 rounded-full bg-blue-600 shadow-xs" />
                                      <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow-sm opacity-0 group-hover/end:opacity-100 group-focus-within/end:opacity-100 transition-opacity">Adjust end time</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accessible Detail Popover / Modal on Click */}
      {inspectBooking && (
        <Modal
          isOpen={Boolean(inspectBooking)}
          onClose={() => setInspectBooking(null)}
          title={
            isAdmin ? "Reservation Details" : "Resource Reservation Schedule"
          }
          description={`${inspectBooking.resource.name} · ${formatColomboDate(
            selectedDate,
            { weekday: "long", month: "long", day: "numeric" }
          )}`}
          className="max-w-md overflow-x-hidden break-words"
        >
          <div className="space-y-4 text-xs">
            {/* Status & Department Bar */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Department
                </span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {(() => {
                      const d = departments.find(
                        (dept) => dept.id === inspectBooking.booking.departmentId
                      );
                      if (!inspectBooking.booking.departmentId) {
                        return "Unassigned / Legacy";
                      }
                      return d ? `${d.name} (${d.code})` : "Assigned";
                    })()}
                  </span>
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Status
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    inspectBooking.booking.status === "PENDING"
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-emerald-50 text-emerald-800 border-emerald-300"
                  )}
                >
                  {inspectBooking.booking.status === "PENDING" ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {inspectBooking.booking.status === "PENDING"
                    ? "Pending Approval"
                    : "Reserved"}
                </span>
              </div>
            </div>

            {/* Time Interval */}
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900 space-y-3">
              <div className="flex items-start gap-2 min-w-0">
                <Clock className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold block leading-relaxed break-words">
                    {formatColomboInterval(
                      inspectBooking.booking.startTime,
                      inspectBooking.booking.endTime
                    )}
                  </span>
                  <span className="text-[10px] text-blue-700/80 block">
                    Asia/Colombo Standard Time (UTC+05:30)
                  </span>
                </div>
              </div>
              {isAdmin && (inspectBooking.booking.reservationIds?.length ?? 1) <= 1 && (
                <div className="flex flex-col gap-2 w-full">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openAccessibleEditModal(
                        inspectBooking.booking,
                        inspectBooking.resource
                      )
                    }
                    className="h-9 w-full justify-center px-3 text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-100/60"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Edit Times
                  </Button>
                  {(inspectBooking.booking.status === "PENDING" ||
                    inspectBooking.booking.status === "APPROVED") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        openRemoveBookingModal(
                          inspectBooking.booking,
                          inspectBooking.resource
                        )
                      }
                      className="h-9 w-full justify-center px-3 text-xs font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove Booking
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Admin-only Detailed Bookings & Ownership */}
            {isAdmin ? (
              <div className="space-y-3 pt-1 border-t border-slate-100">
                {inspectBooking.booking.title && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Reservation Purpose / Title
                    </span>
                    <p className="font-medium text-slate-800">
                      {inspectBooking.booking.title}
                    </p>
                  </div>
                )}

                {inspectBooking.booking.user && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Reserved For
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {inspectBooking.booking.user.name} (
                        {inspectBooking.booking.user.email})
                      </span>
                    </div>
                  </div>
                )}

                {/* Grouped Bookings Detail */}
                {(inspectBooking.booking.reservationIds?.length ?? 1) > 1 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Grouped Contiguous Bookings (
                        {inspectBooking.booking.reservationIds?.length})
                      </span>
                      <span className="text-[10px] text-amber-600 font-semibold">
                        Edit individually below
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 divide-y divide-slate-100 p-2 space-y-1.5">
                      {inspectBooking.booking.bookings &&
                      inspectBooking.booking.bookings.length > 0
                        ? inspectBooking.booking.bookings.map((b, i) => (
                            <div key={b.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-800">
                                  Segment {i + 1}:
                                </span>{" "}
                                <span className="text-slate-600 truncate">
                                  {b.title || "Reserved Segment"}
                                </span>
                                {b.startTime && b.endTime && (
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    {formatColomboInterval(b.startTime, b.endTime)}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openAccessibleEditModalForSegment(
                                      b,
                                      inspectBooking.resource
                                    )
                                  }
                                  className="h-6 px-2 text-[10px] font-semibold text-blue-700 border-blue-200 hover:bg-blue-100 shrink-0"
                                >
                                  <Edit3 className="h-2.5 w-2.5 mr-1" />
                                  Edit Times
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openRemoveBookingModalForSegment(
                                      b,
                                      inspectBooking.resource,
                                      inspectBooking.booking.departmentId
                                    )
                                  }
                                  className="h-6 px-2 text-[10px] font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 shrink-0"
                                >
                                  <Trash2 className="h-2.5 w-2.5 mr-1" />
                                  Remove Booking
                                </Button>
                              </div>
                            </div>
                          ))
                        : inspectBooking.booking.reservationIds?.map((id, i) => (
                            <div key={id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] text-slate-600">
                                Segment {i + 1}: {id.slice(0, 8)}...
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openRemoveBookingModalForSegment(
                                    {
                                      id,
                                      title: `Segment ${i + 1}`,
                                      startTime: inspectBooking.booking.startTime,
                                      endTime: inspectBooking.booking.endTime,
                                    },
                                    inspectBooking.resource,
                                    inspectBooking.booking.departmentId
                                  )
                                }
                                className="h-6 px-2 text-[10px] font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 shrink-0"
                              >
                                <Trash2 className="h-2.5 w-2.5 mr-1" />
                                Remove Booking
                              </Button>
                            </div>
                          ))}
                    </div>
                  </div>
                )}

                {/* Department Correction Action */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Department Allocation
                    </span>
                    {!isCorrectingDept && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCorrectingDept(true);
                          setCorrectTargetDeptId(
                            inspectBooking.booking.departmentId ||
                              departments[0]?.id ||
                              ""
                          );
                          setCorrectReason("");
                          setCorrectionFieldErrors({});
                          setCorrectionGeneralError(null);
                          setSelectedCorrectionResId(
                            inspectBooking.booking.id ||
                              inspectBooking.booking.reservationIds?.[0] ||
                              ""
                          );
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>Reassign Department</span>
                      </button>
                    )}
                  </div>

                  {isCorrectingDept && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      {correctionGeneralError && !correctionFieldErrors.reason && !correctionFieldErrors.departmentId && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                          {correctionGeneralError}
                        </div>
                      )}

                      {(inspectBooking.booking.reservationIds?.length ?? 1) > 1 && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                            Select Segment to Reassign
                          </label>
                          <select
                            value={selectedCorrectionResId}
                            onChange={(e) => {
                              setSelectedCorrectionResId(e.target.value);
                              if (correctionFieldErrors.reservationId) {
                                setCorrectionFieldErrors((prev) => {
                                  const copy = { ...prev };
                                  delete copy.reservationId;
                                  return copy;
                                });
                              }
                            }}
                            className={cn(
                              "w-full h-8 rounded-lg border bg-white px-2 text-xs text-slate-800",
                              correctionFieldErrors.reservationId
                                ? "border-rose-400 focus:ring-rose-200"
                                : "border-slate-300"
                            )}
                          >
                            {inspectBooking.booking.reservationIds?.map(
                              (id, idx) => (
                                <option key={id} value={id}>
                                  Segment {idx + 1} ({id.slice(0, 8)}...)
                                </option>
                              )
                            )}
                          </select>
                          {correctionFieldErrors.reservationId && (
                            <p className="text-[11px] text-rose-600 mt-1">
                              {correctionFieldErrors.reservationId[0]}
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Target Department
                        </label>
                        <select
                          value={correctTargetDeptId}
                          onChange={(e) => {
                            setCorrectTargetDeptId(e.target.value);
                            if (correctionFieldErrors.departmentId) {
                              setCorrectionFieldErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.departmentId;
                                return copy;
                              });
                            }
                          }}
                          className={cn(
                            "w-full h-8 rounded-lg border bg-white px-2 text-xs text-slate-800",
                            correctionFieldErrors.departmentId
                              ? "border-rose-400 focus:ring-rose-200"
                              : "border-slate-300"
                          )}
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </option>
                          ))}
                        </select>
                        {correctionFieldErrors.departmentId && (
                          <p className="text-[11px] text-rose-600 mt-1">
                            {correctionFieldErrors.departmentId[0]}
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                            Correction Reason (Audit Trail)
                          </label>
                          <span
                            className={cn(
                              "text-[10px]",
                              correctReason.trim().length >= 10 && correctReason.trim().length <= 500
                                ? "text-emerald-600 font-bold"
                                : "text-slate-400"
                            )}
                          >
                            {correctReason.trim().length}/500 (min 10)
                          </span>
                        </div>
                        <input
                          type="text"
                          required
                          value={correctReason}
                          onChange={(e) => {
                            setCorrectReason(e.target.value);
                            if (correctionFieldErrors.reason) {
                              setCorrectionFieldErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.reason;
                                return copy;
                              });
                            }
                          }}
                          placeholder="e.g. Assigned to wrong team during booking (min 10 chars)"
                          className={cn(
                            "w-full h-8 rounded-lg border px-2.5 text-xs text-slate-800",
                            correctionFieldErrors.reason
                              ? "border-rose-400 focus:ring-rose-200 bg-rose-50/20"
                              : "border-slate-300"
                          )}
                        />
                        {correctionFieldErrors.reason && (
                          <p className="text-[11px] text-rose-600 mt-1">
                            {correctionFieldErrors.reason[0]}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsCorrectingDept(false);
                            setCorrectionFieldErrors({});
                            setCorrectionGeneralError(null);
                          }}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            isSubmittingCorrection ||
                            !correctTargetDeptId ||
                            !correctReason.trim()
                          }
                          onClick={async () => {
                            const targetId =
                              selectedCorrectionResId ||
                              inspectBooking.booking.id ||
                              inspectBooking.booking.reservationIds?.[0];
                            if (!targetId) return;

                            setIsSubmittingCorrection(true);
                            setCorrectionFieldErrors({});
                            setCorrectionGeneralError(null);

                            try {
                              const res =
                                await correctReservationDepartmentAction({
                                  reservationId: targetId,
                                  expectedDepartmentId:
                                    inspectBooking.booking.departmentId ?? null,
                                  departmentId: correctTargetDeptId,
                                  reason: correctReason.trim(),
                                });

                              if (res.success) {
                                toast.success(
                                  "Department corrected successfully."
                                );
                                setInspectBooking((prev) => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    booking: {
                                      ...prev.booking,
                                      departmentId: correctTargetDeptId,
                                    },
                                  };
                                });
                                setIsCorrectingDept(false);
                                router.refresh();
                              } else {
                                if (res.fieldErrors && Object.keys(res.fieldErrors).length > 0) {
                                  setCorrectionFieldErrors(res.fieldErrors);
                                }
                                setCorrectionGeneralError(
                                  res.error || "Failed to correct department."
                                );
                                toast.error(
                                  res.error || "Failed to correct department."
                                );
                              }
                            } catch {
                              setCorrectionGeneralError("An unexpected error occurred.");
                              toast.error("An unexpected error occurred.");
                            } finally {
                              setIsSubmittingCorrection(false);
                            }
                          }}
                          className="h-7 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        >
                          {isSubmittingCorrection && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          Save Correction
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Privacy-Safe Notice for Members */
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                This time interval is reserved under the{" "}
                <strong>
                  {(() => {
                    const d = departments.find(
                      (dept) => dept.id === inspectBooking.booking.departmentId
                    );
                    return d ? d.name : "organizational";
                  })()}
                </strong>{" "}
                department. To book this resource, select an available unoccupied
                slot on the schedule.
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectBooking(null)}
                className="h-8 px-4 rounded-lg text-xs font-semibold text-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CONFIRM TIME RESIZE */}
      {confirmModalState && (
        <Modal
          isOpen={confirmModalState.isOpen}
          onClose={() => setConfirmModalState(null)}
          title="Confirm Time Adjustment"
          description={`Update reservation schedule on ${confirmModalState.resourceName}`}
          className="max-w-md overflow-x-hidden break-words"
        >
          <div className="space-y-4 pt-1 min-w-0">
            {confirmModalState.error && (
              <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{confirmModalState.error}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-1">
                <span className="text-xs font-bold text-slate-700">Resource</span>
                <span className="text-xs font-medium text-slate-900 break-words text-right min-w-0">{confirmModalState.resourceName}</span>
              </div>
              {confirmModalState.title && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Purpose</span>
                  <span className="text-xs font-medium text-slate-900">{confirmModalState.title}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Department</span>
                <span className="text-xs font-medium text-slate-900">{confirmModalState.departmentName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Original Time
                </span>
                <span className="text-xs font-bold text-slate-700 block">
                  {formatColomboInterval(confirmModalState.originalStart, confirmModalState.originalEnd)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Proposed Time
                </span>
                <span className="text-xs font-bold text-blue-900 block">
                  {formatColomboInterval(confirmModalState.proposedStart, confirmModalState.proposedEnd)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              This adjustment will be verified against office shift hours and existing reservations.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {confirmModalState.isStale && (
                <Button type="button" variant="outline" size="sm" onClick={() => reloadLatestBooking(confirmModalState.reservationId)}>
                  Reload Latest Booking
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={confirmModalState.isSubmitting}
                onClick={() => setConfirmModalState(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={confirmModalState.isSubmitting || confirmModalState.isStale}
                onClick={handleConfirmTimeChange}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {confirmModalState.isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm & Save</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ACCESSIBLE EDIT TIMES */}
      {accessibleEditModalState && (
        <Modal
          isOpen={accessibleEditModalState.isOpen}
          onClose={() => setAccessibleEditModalState(null)}
          title="Edit Reservation Times"
          description={`Update schedule for ${accessibleEditModalState.resourceName}`}
          className="max-w-md overflow-x-hidden break-words"
        >
          <div className="space-y-4 pt-1">
            {accessibleEditModalState.error && (
              <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{accessibleEditModalState.error}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800">
                {accessibleEditModalState.title || "Reservation"}
              </span>
              <p className="text-[11px] text-slate-500">
                {accessibleEditModalState.resourceName} · {formatColomboDate(selectedDate)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Start Time <span className="text-rose-500">*</span>
                </label>
                <select
                  value={accessibleEditModalState.startTimeStr}
                  onChange={(e) =>
                    setAccessibleEditModalState((prev) =>
                      prev ? { ...prev, startTimeStr: e.target.value, error: null } : null
                    )
                  }
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {timeSlots.map((slot) => (
                    <option key={slot.slotTime} value={slot.slotTime}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  End Time <span className="text-rose-500">*</span>
                </label>
                <select
                  value={accessibleEditModalState.endTimeStr}
                  onChange={(e) =>
                    setAccessibleEditModalState((prev) =>
                      prev ? { ...prev, endTimeStr: e.target.value, error: null } : null
                    )
                  }
                  className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {(() => {
                    const endOptions = [...timeSlots.map((s) => s.slotTime)];
                    const lastMin = startMinute + durationMinutes;
                    const finalTime = `${String(Math.floor(lastMin / 60) % 24).padStart(2, "0")}:${String(lastMin % 60).padStart(2, "0")}`;
                    if (!endOptions.includes(finalTime)) {
                      endOptions.push(finalTime);
                    }
                    return endOptions.map((timeStr) => {
                      const iso = createColomboISO(selectedDate, timeStr);
                      const label = formatColomboTime(iso);
                      return (
                        <option key={timeStr} value={timeStr}>
                          {label}
                        </option>
                      );
                    });
                  })()}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Shift hours: {shiftHoursLabel}. Only slots fitting the active shift can be saved.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {accessibleEditModalState.isStale && (
                <Button type="button" variant="outline" size="sm" onClick={() => reloadLatestBooking(accessibleEditModalState.reservationId)}>
                  Reload Latest Booking
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={accessibleEditModalState.isSubmitting}
                onClick={() => setAccessibleEditModalState(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={accessibleEditModalState.isSubmitting || accessibleEditModalState.isStale}
                onClick={handleSaveAccessibleEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {accessibleEditModalState.isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Time</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADMIN CONFIRM BOOKING REMOVAL */}
      {removeModalState && (
        <Modal
          isOpen={removeModalState.isOpen}
          onClose={() => !removeModalState.isSubmitting && setRemoveModalState(null)}
          title="Confirm Booking Removal"
          description={`Remove reservation on ${removeModalState.resourceName}`}
          className="max-w-md overflow-x-hidden break-words"
        >
          <div className="space-y-4 pt-1">
            {removeModalState.error && (
              <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{removeModalState.error}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Reservation Purpose / Title
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    removeModalState.status === "PENDING"
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-emerald-50 text-emerald-800 border-emerald-300"
                  )}
                >
                  {removeModalState.status === "PENDING" ? "PENDING" : "APPROVED"}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900">
                {removeModalState.title}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Resource
                  </span>
                  <span className="text-slate-800 font-medium truncate block">
                    {removeModalState.resourceName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Department
                  </span>
                  <span className="text-slate-800 font-medium truncate block">
                    {removeModalState.departmentName}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Reservation Date
                  </span>
                  <span className="text-slate-800 font-medium block">
                    {formatColomboDate(removeModalState.startTime)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Time Interval
                  </span>
                  <span className="text-slate-800 font-medium block">
                    {formatColomboInterval(
                      removeModalState.startTime,
                      removeModalState.endTime
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Removing this booking will release the reserved time slot. The reservation will remain in history.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removeModalState.isSubmitting}
                onClick={() => setRemoveModalState(null)}
                className="h-8 text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={removeModalState.isSubmitting}
                onClick={handleConfirmRemoveBooking}
                className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-xs"
              >
                {removeModalState.isSubmitting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>Remove Booking</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
