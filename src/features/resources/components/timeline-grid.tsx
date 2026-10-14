"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { correctReservationDepartmentAction } from "@/features/reservations/actions/reservation-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  formatColomboInterval,
  formatColomboDate,
  formatColomboFullDate,
} from "@/features/reservations/utils/client-date";
import {
  getDepartmentColorScheme,
} from "@/features/departments/utils/department-colors";
import {
  generateShiftTimelineSlots,
  formatShiftHours,
} from "@/features/office-shifts/utils/shift-client-utils";
import type { EffectiveSchedule } from "@/features/office-shifts/types/effective-schedule";

export interface ReservationOccupancy {
  id?: string;
  resourceId: string;
  departmentId?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  title?: string;
  reservationIds?: string[];
  user?: { name: string; email: string };
  bookings?: { id: string; title: string; userId: string | null }[];
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
  onSelectSlot?: (resourceId: string, slotTime: string) => void;
  onNewReservation?: () => void;
  onBrowseResources?: () => void;
  isLoading?: boolean;
}

export function TimelineGrid({
  resources,
  selectedDate,
  occupancy: rawOccupancy = [],
  effectiveSchedule,
  departments = [],
  isAdmin = false,
  onSelectSlot,
  onNewReservation,
  onBrowseResources,
  isLoading = false,
}: TimelineGridProps) {
  const router = useRouter();
  const toast = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Detail inspection modal state
  const [inspectBooking, setInspectBooking] = useState<{
    booking: ReservationOccupancy;
    resource: TimelineResourceItem;
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

  // Generate dynamic 30-min time slots
  const timeSlots = generateShiftTimelineSlots(startMinute, durationMinutes);

  // Width calculation for horizontal scroll (minimum 42px per half-hour column)
  const gridMinWidth = Math.max(960, timeSlots.length * 44);

  // Filter to ONLY resources that have at least one blocking reservation overlapping this operational window
  const bookedResourceIds = new Set(
    effectiveOccupancy
      .filter((o) => o.status === "PENDING" || o.status === "APPROVED")
      .map((o) => o.resourceId)
  );
  const bookedResources = resources.filter((res) =>
    bookedResourceIds.has(res.id)
  );

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
    endTime: Date | string
  ) => {
    const s = new Date(startTime).getTime();
    const e = new Date(endTime).getTime();

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

  const shiftHoursLabel = formatShiftHours(startMinute, durationMinutes);

  return (
    <div className="space-y-3">
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
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
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

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Loading schedule timeline...</span>
          </div>
        ) : bookedResources.length === 0 ? (
          /* Empty State: No reservations scheduled for this date */
          <div className="py-12 px-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-2xs">
              <CalendarX2 className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                No reservations scheduled for this operational window
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
          /* Active Schedule Table with ONLY Booked Resources & Horizontally Scrollable Timeline */
          <div className="overflow-x-auto relative" ref={scrollContainerRef}>
            <div style={{ minWidth: `${gridMinWidth}px` }}>
              {/* Header Row: Sticky Resources column + Dynamic Time markers */}
              <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                {/* Sticky Left Resource Column */}
                <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-800 flex items-center justify-between sticky left-0 z-20 bg-slate-50 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  <span>Resources with Bookings</span>
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
                {bookedResources.map((res) => {
                  const resourceBookings = effectiveOccupancy.filter(
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
                      <div className="flex-1 relative h-14 bg-white">
                        {/* 1. Underlying 30-min Grid Cells for Click-to-Book */}
                        <div
                          className="absolute inset-0 grid divide-x divide-[#E5E7EB]"
                          style={{
                            gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {timeSlots.map((slot) => {
                            const blocked = isSlotBlocked(res.id, slot.minuteOffset);
                            return (
                              <div
                                key={`${slot.slotTime}-${slot.minuteOffset}`}
                                onClick={() => {
                                  if (res.isActive && !blocked) {
                                    onSelectSlot?.(res.id, slot.slotTime);
                                  }
                                }}
                                className={cn(
                                  "h-full relative flex items-center justify-center transition-colors group/cell",
                                  blocked
                                    ? "bg-transparent cursor-default"
                                    : res.isActive
                                    ? "hover:bg-blue-50/40 cursor-pointer"
                                    : "bg-slate-50/40 cursor-not-allowed opacity-60"
                                )}
                                title={
                                  blocked
                                    ? undefined
                                    : res.isActive
                                    ? `Available · Click to reserve ${res.name} at ${slot.label}`
                                    : `${res.name} is inactive`
                                }
                              >
                                {res.isActive && !blocked && (
                                  <span className="opacity-0 group-hover/cell:opacity-100 text-blue-600 transition-opacity">
                                    <Plus className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* 2. Overlaid Continuous Reservation Blocks */}
                        <div className="absolute inset-0 pointer-events-none p-1.5 flex items-center">
                          {resourceBookings.map((booking, bIdx) => {
                            const pos = computePosition(
                              booking.startTime,
                              booking.endTime
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

                            const isNarrow = pos.width < 10.0;
                            const isVeryNarrow = pos.width < 5.0;

                            const statusLabel = isPending
                              ? "Pending Approval"
                              : "Reserved";
                            const intervalStr = formatColomboInterval(
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
                              pos.startsBefore ? `Starts before ${shiftHoursLabel.split("–")[0]}` : null,
                              pos.endsAfter ? `Extends after ${shiftHoursLabel.split("–")[1]}` : null,
                              "Click to inspect details",
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            return (
                              <button
                                key={
                                  booking.id || `${booking.resourceId}-${bIdx}`
                                }
                                type="button"
                                onClick={() =>
                                  setInspectBooking({
                                    booking,
                                    resource: res,
                                  })
                                }
                                className={cn(
                                  "absolute top-1.5 bottom-1.5 rounded-lg border shadow-2xs pointer-events-auto transition-all select-none overflow-hidden flex items-center px-1.5 py-0.5 z-10 cursor-pointer text-left hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-blue-500",
                                  isPending && "border-amber-400 border-dashed"
                                )}
                                style={{
                                  left: `${pos.left}%`,
                                  width: `${pos.width}%`,
                                  backgroundColor: colorScheme.bg,
                                  borderColor: isPending
                                    ? "#F59E0B"
                                    : colorScheme.border,
                                  color: colorScheme.text,
                                }}
                                title={tooltipText}
                              >
                                <div className="flex items-center justify-between gap-1 w-full min-w-0">
                                  {/* Left: Status Indicator + Department Badge + Title */}
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    {isPending ? (
                                      <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-300 animate-pulse shrink-0" />
                                    ) : (
                                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                    )}

                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 shadow-2xs border tracking-tight"
                                      style={{
                                        backgroundColor: colorScheme.badgeBg,
                                        borderColor: colorScheme.badgeBorder,
                                        color: colorScheme.badgeText,
                                      }}
                                    >
                                      {isNarrow
                                        ? isLegacy
                                          ? "UNASSIGNED"
                                          : (dept?.code || colorScheme.code || "DEP").slice(0, 4)
                                        : isLegacy
                                        ? "Legacy / Unassigned"
                                        : dept?.code || colorScheme.code}
                                    </span>

                                    {!isVeryNarrow && (
                                      <span className="text-[10px] font-bold truncate">
                                        {isAdmin && booking.title
                                          ? booking.title
                                          : statusLabel}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right: Group Count + Time Interval */}
                                  <div className="flex items-center gap-1 shrink-0 text-[9px] font-semibold opacity-90">
                                    {isGrouped && (
                                      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-white/90 text-slate-800 text-[8px] font-bold border border-slate-200 shadow-2xs">
                                        <Layers className="h-2.5 w-2.5" />
                                        {count}
                                      </span>
                                    )}
                                    {!isNarrow && (
                                      <span className="hidden sm:inline truncate">
                                        {intervalStr}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
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
          className="max-w-md"
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
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900">
              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold">
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Grouped Contiguous Bookings (
                      {inspectBooking.booking.reservationIds?.length})
                    </span>
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 divide-y divide-slate-100 p-2 space-y-1">
                      {inspectBooking.booking.bookings &&
                      inspectBooking.booking.bookings.length > 0
                        ? inspectBooking.booking.bookings.map((b, i) => (
                            <div key={b.id} className="pt-1 first:pt-0">
                              <span className="font-semibold text-slate-800">
                                Segment {i + 1}:
                              </span>{" "}
                              <span className="text-slate-600">
                                {b.title || "Reserved Segment"}
                              </span>
                            </div>
                          ))
                        : inspectBooking.booking.reservationIds?.map((id, i) => (
                            <div key={id} className="pt-1 first:pt-0 font-mono text-[11px] text-slate-600">
                              Booking {i + 1}: {id.slice(0, 8)}...
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
    </div>
  );
}
