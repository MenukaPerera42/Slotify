"use client";

import { useState } from "react";
import {
  Building2,
  Monitor,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronsDown,
  ChevronsUp,
  Plus,
  Layers as LayersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceItem } from "./resource-card";
import {
  BUSINESS_TIME_SLOTS,
  formatSlotLabel,
  formatColomboInterval,
} from "@/features/reservations/utils/client-date";

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

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface TimelineGridProps {
  resources: ResourceItem[];
  selectedDate: string;
  occupancy?: ReservationOccupancy[];
  departments?: DepartmentOption[];
  isAdmin?: boolean;
  onSelectSlot?: (resourceId: string, slotTime: string) => void;
  isLoading?: boolean;
}

export function TimelineGrid({
  resources,
  selectedDate,
  occupancy = [],
  departments = [],
  isAdmin = false,
  onSelectSlot,
  isLoading = false,
}: TimelineGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleResources = isExpanded ? resources : resources.slice(0, 2);

  // Time slots for header (09:00 to 17:30, 30-min steps = 18 columns = 9 hours, 09:00 to 18:00)
  const timeSlots = BUSINESS_TIME_SLOTS.slice(4, 22);

  // Parse Colombo date boundaries for the visible window (09:00 - 18:00)
  const [year, month, day] = selectedDate.split("-").map(Number);
  const timelineStartUtc =
    Date.UTC(year, month - 1, day, 9, 0, 0) - 5.5 * 3600 * 1000;
  const timelineEndUtc =
    Date.UTC(year, month - 1, day, 18, 0, 0) - 5.5 * 3600 * 1000;
  const totalTimelineMs = timelineEndUtc - timelineStartUtc; // 540 minutes in ms

  const renderIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes("meeting") || lower.includes("room") || lower.includes("board")) {
      return <Building2 className="h-5 w-5" />;
    }
    if (lower.includes("workstation") || lower.includes("desk") || lower.includes("pod")) {
      return <Monitor className="h-5 w-5" />;
    }
    if (lower.includes("lab") || lower.includes("equipment") || lower.includes("gpu")) {
      return <Cpu className="h-5 w-5" />;
    }
    return <Layers className="h-5 w-5" />;
  };

  /**
   * Computes horizontal positioning percentage for a continuous reservation block.
   */
  const computePosition = (startTime: Date | string, endTime: Date | string) => {
    const s = new Date(startTime).getTime();
    const e = new Date(endTime).getTime();

    // Clip to visible window
    const visibleStart = Math.max(s, timelineStartUtc);
    const visibleEnd = Math.min(e, timelineEndUtc);

    if (visibleEnd <= visibleStart) return null;

    const leftPercent = ((visibleStart - timelineStartUtc) / totalTimelineMs) * 100;
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
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            {/* Header Row: Room label + Time markers + reference navigation indicators */}
            <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/50 text-[11px] font-semibold text-slate-500">
              <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-800 flex items-center justify-between">
                <span>Resources</span>
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
                  <div key={slot} className="py-2.5 truncate font-medium text-slate-600">
                    {formatSlotLabel(slot)}
                  </div>
                ))}
              </div>
            </div>

            {/* Resource Rows */}
            <div className="divide-y divide-[#E5E7EB]">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Loading schedule...
                </div>
              ) : visibleResources.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No resources matching criteria.
                </div>
              ) : (
                visibleResources.map((res) => {
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
                          {renderIcon(res.category.name)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {res.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {res.location}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {res.capacity ? `${res.capacity} People` : "Individual"}
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
                            const count =
                              booking.reservationIds?.length ?? 1;
                            const isGrouped = count > 1;

                            const label = isPending
                              ? "Pending Approval"
                              : "Reserved";
                            const intervalStr = formatColomboInterval(
                              booking.startTime,
                              booking.endTime
                            );

                            const tooltipText = [
                              `${label} · ${intervalStr}`,
                              dept ? `Department: ${dept.name} (${dept.code})` : null,
                              isGrouped ? `Grouped reservations: ${count}` : null,
                              isAdmin && booking.title ? `Title: ${booking.title}` : null,
                              isAdmin && booking.user?.name ? `User: ${booking.user.name}` : null,
                              pos.startsBefore ? "Starts before 9:00 AM" : null,
                              pos.endsAfter ? "Extends after 6:00 PM" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ");

                            return (
                              <div
                                key={booking.id || `${booking.resourceId}-${bIdx}`}
                                className={cn(
                                  "absolute top-1.5 bottom-1.5 rounded-lg border shadow-2xs pointer-events-auto transition-all select-none overflow-hidden flex items-center px-2 py-0.5 z-10",
                                  isPending
                                    ? "bg-amber-100/95 border-amber-300 text-amber-900"
                                    : "bg-blue-100/95 border-blue-200 text-blue-900"
                                )}
                                style={{
                                  left: `${pos.left}%`,
                                  width: `${pos.width}%`,
                                }}
                                title={tooltipText}
                              >
                                <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
                                  {/* Left: Indicator + Status / Title + Department */}
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <span
                                      className={cn(
                                        "h-1.5 w-1.5 rounded-full shrink-0",
                                        isPending ? "bg-amber-600" : "bg-blue-600"
                                      )}
                                    />
                                    <span className="text-[10px] font-bold truncate">
                                      {isAdmin && booking.title
                                        ? booking.title
                                        : label}
                                    </span>
                                    {dept && (
                                      <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-white/80 border border-slate-200/80 text-slate-700 shrink-0">
                                        {dept.code}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right: Time Interval + Group Badge */}
                                  <div className="flex items-center gap-1 shrink-0 text-[9px] font-medium opacity-85">
                                    {isGrouped && (
                                      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-blue-200/60 text-blue-800 text-[8px] font-bold">
                                        <LayersIcon className="h-2.5 w-2.5" />
                                        {count}
                                      </span>
                                    )}
                                    <span className="hidden sm:inline truncate">
                                      {intervalStr}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Double Chevron Expander matching reference screenshot */}
      {resources.length > 2 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-full text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
            title={isExpanded ? "Collapse timeline" : "Show all resources in timeline"}
            aria-label={isExpanded ? "Collapse timeline" : "Show all resources"}
          >
            {isExpanded ? (
              <ChevronsUp className="h-5 w-5" />
            ) : (
              <ChevronsDown className="h-5 w-5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
