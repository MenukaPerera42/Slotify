"use client";

import { useState } from "react";
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
  Briefcase,
  Edit3,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { correctReservationDepartmentAction } from "@/features/reservations/actions/reservation-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  BUSINESS_TIME_SLOTS,
  formatSlotLabel,
  formatColomboInterval,
  formatColomboDate,
  formatColomboFullDate,
} from "@/features/reservations/utils/client-date";
import {
  getDepartmentColorScheme,
} from "@/features/departments/utils/department-colors";

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
  occupancy = [],
  departments = [],
  isAdmin = false,
  onSelectSlot,
  onNewReservation,
  onBrowseResources,
  isLoading = false,
}: TimelineGridProps) {
  const router = useRouter();
  const toast = useToast();

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

  // Time slots for header (09:00 to 17:30, 30-min steps = 18 columns = 9 hours, 09:00 to 18:00)
  const timeSlots = BUSINESS_TIME_SLOTS.slice(4, 22);

  // Parse Colombo date boundaries for visible window (09:00 - 18:00)
  const [year, month, day] = selectedDate.split("-").map(Number);
  const timelineStartUtc =
    Date.UTC(year, month - 1, day, 9, 0, 0) - 5.5 * 3600 * 1000;
  const timelineEndUtc =
    Date.UTC(year, month - 1, day, 18, 0, 0) - 5.5 * 3600 * 1000;
  const totalTimelineMs = timelineEndUtc - timelineStartUtc; // 540 minutes in ms

  // Filter to ONLY resources that have at least one blocking reservation overlapping selectedDate
  const bookedResourceIds = new Set(
    occupancy
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
  const isSlotBlocked = (resourceId: string, slotTime: string) => {
    const [h, m] = slotTime.split(":").map(Number);
    const slotStartUtc =
      Date.UTC(year, month - 1, day, h, m, 0) - 5.5 * 3600 * 1000;
    const slotEndUtc = slotStartUtc + 30 * 60 * 1000;

    for (const res of occupancy) {
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

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        {/* Full Date & Timezone Header Banner */}
        <div className="px-4 py-2.5 bg-slate-50/70 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">
              {formatColomboFullDate(selectedDate)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-slate-500">
              Asia/Colombo Standard Time (UTC+05:30)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>9:00 AM – 6:00 PM</span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Loading schedule...
          </div>
        ) : bookedResources.length === 0 ? (
          /* Empty State: No reservations scheduled for this date */
          <div className="py-12 px-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-2xs">
              <CalendarX2 className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                No reservations scheduled for this date
              </h3>
              <p className="text-xs text-slate-400">
                There are no active reservations on{" "}
                {formatColomboDate(selectedDate, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                . All active resources are open for booking.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {onNewReservation && (
                <Button
                  size="sm"
                  onClick={onNewReservation}
                  className="h-8 px-3.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isAdmin ? "Create Reservation" : "New Reservation"}</span>
                </Button>
              )}
              {onBrowseResources && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBrowseResources}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 border-slate-200"
                >
                  Browse Resources
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Active Schedule Table with ONLY Booked Resources */
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              {/* Header Row: Resources column + Time markers */}
              <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/50 text-[11px] font-semibold text-slate-500">
                <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-800 flex items-center justify-between">
                  <span>Resources with Bookings</span>
                  <span className="text-slate-400">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div
                  className="flex-1 grid divide-x divide-[#E5E7EB] text-center"
                  style={{
                    gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))`,
                  }}
                >
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      className="py-2.5 truncate font-medium text-slate-600 text-[10px]"
                    >
                      {formatSlotLabel(slot)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Resource Rows: ONLY Booked Resources */}
              <div className="divide-y divide-[#E5E7EB]">
                {bookedResources.map((res) => {
                  // Filter occupancy items for this resource
                  const resourceBookings = occupancy.filter(
                    (o) =>
                      o.resourceId === res.id &&
                      (o.status === "PENDING" || o.status === "APPROVED")
                  );

                  return (
                    <div
                      key={res.id}
                      className="flex items-center hover:bg-slate-50/30 transition-colors"
                    >
                      {/* Left Column: Resource Identity */}
                      <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 flex items-center gap-3">
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
                            const blocked = isSlotBlocked(res.id, slot);
                            return (
                              <div
                                key={slot}
                                onClick={() => {
                                  if (res.isActive && !blocked) {
                                    onSelectSlot?.(res.id, slot);
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
                                    ? `Available · Click to reserve ${res.name} at ${formatSlotLabel(slot)}`
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

                            // Width-responsive thresholds for clean labels
                            // 30 min = ~5.56%, 60 min = ~11.11%, 90 min = ~16.67%
                            const isNarrow = pos.width < 12.0;
                            const isVeryNarrow = pos.width < 6.5;

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
                              pos.startsBefore ? "Starts before 9:00 AM" : null,
                              pos.endsAfter ? "Extends after 6:00 PM" : null,
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
                                  {/* Left: Status Indicator + Department Badge + Optional Title */}
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    {isPending ? (
                                      <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-300 animate-pulse shrink-0" />
                                    ) : (
                                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                    )}

                                    {/* Department Badge: compact code in narrow blocks */}
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

                                    {/* Status / Title: hidden in very narrow (<6.5%) blocks */}
                                    {!isVeryNarrow && (
                                      <span className="text-[10px] font-bold truncate">
                                        {isAdmin && booking.title
                                          ? booking.title
                                          : statusLabel}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right: Group Badge + Time Interval (Interval hidden in narrow blocks) */}
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
                              <p className="font-semibold text-slate-800 truncate">
                                #{i + 1} {b.title || "Reservation"}
                              </p>
                              <p className="text-[9px] text-slate-400 font-mono">
                                ID: {b.id}
                              </p>
                            </div>
                          ))
                        : inspectBooking.booking.reservationIds?.map(
                            (id, i) => (
                              <p
                                key={id}
                                className="text-[10px] text-slate-600 font-mono py-0.5"
                              >
                                #{i + 1} ID: {id}
                              </p>
                            )
                          )}
                    </div>
                  </div>
                )}

                {/* Admin-only Department Review & Correction Affordance */}
                <div className="pt-3 border-t border-slate-100">
                  {!isCorrectingDept ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Department Allocation
                        </span>
                        <p className="text-xs text-slate-700">
                          {inspectBooking.booking.departmentId
                            ? "Reassign to another department"
                            : "Review & assign unallocated booking"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsCorrectingDept(true);
                          setCorrectReason("");
                          setCorrectTargetDeptId("");
                          setSelectedCorrectionResId(
                            inspectBooking.booking.id ||
                              inspectBooking.booking.reservationIds?.[0] ||
                              ""
                          );
                        }}
                        className="h-7 text-xs font-semibold gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 className="h-3 w-3 text-slate-500" />
                        {inspectBooking.booking.departmentId ? "Change Department" : "Assign Department"}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                          Review Department Allocation
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Audit reason required
                        </span>
                      </div>

                      {/* If multiple bookings, select which one */}
                      {(inspectBooking.booking.reservationIds?.length ?? 1) > 1 && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">
                            Select Specific Booking
                          </label>
                          <select
                            value={selectedCorrectionResId}
                            onChange={(e) => setSelectedCorrectionResId(e.target.value)}
                            className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {(inspectBooking.booking.bookings || []).map((b, i) => (
                              <option key={b.id} value={b.id}>
                                #{i + 1} {b.title || "Reservation"} ({b.id.slice(0, 8)}...)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Department Select */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          Target Department
                        </label>
                        <select
                          value={correctTargetDeptId}
                          onChange={(e) => setCorrectTargetDeptId(e.target.value)}
                          className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="">Select an active department...</option>
                          {departments
                            .filter((d) => d.id !== inspectBooking.booking.departmentId)
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.code})
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Audit Reason */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-600">
                            Audit Reason (10–500 chars)
                          </label>
                          <span
                            className={cn(
                              "text-[9px]",
                              correctReason.trim().length >= 10 &&
                                correctReason.trim().length <= 500
                                ? "text-emerald-600 font-medium"
                                : "text-slate-400"
                            )}
                          >
                            {correctReason.trim().length}/500 (min 10)
                          </span>
                        </div>
                        <textarea
                          value={correctReason}
                          onChange={(e) => setCorrectReason(e.target.value)}
                          placeholder="State reason for department review or correction (minimum 10 characters)..."
                          rows={2}
                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsCorrectingDept(false)}
                          disabled={isSubmittingCorrection}
                          className="h-7 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            isSubmittingCorrection ||
                            !correctTargetDeptId ||
                            correctReason.trim().length < 10 ||
                            correctReason.trim().length > 500
                          }
                          onClick={async () => {
                            const resId =
                              selectedCorrectionResId ||
                              inspectBooking.booking.id ||
                              inspectBooking.booking.reservationIds?.[0];
                            if (!resId || !correctTargetDeptId) return;

                            setIsSubmittingCorrection(true);
                            try {
                              const res = await correctReservationDepartmentAction({
                                reservationId: resId,
                                expectedDepartmentId:
                                  inspectBooking.booking.departmentId || null,
                                departmentId: correctTargetDeptId,
                                reason: correctReason.trim(),
                              });

                              if (res.success) {
                                toast.success(
                                  "Department allocation corrected successfully."
                                );
                                setIsCorrectingDept(false);
                                setInspectBooking(null);
                                router.refresh();
                              } else {
                                toast.error(
                                  res.error || "Failed to correct department."
                                );
                              }
                            } catch {
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
