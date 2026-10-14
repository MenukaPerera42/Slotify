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
  startTime: Date | string;
  endTime: Date | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  title?: string;
  user?: { name: string; email: string };
}

interface TimelineGridProps {
  resources: ResourceItem[];
  selectedDate: string;
  occupancy?: ReservationOccupancy[];
  isAdmin?: boolean;
  onSelectSlot?: (resourceId: string, slotTime: string) => void;
  isLoading?: boolean;
}

export function TimelineGrid({
  resources,
  selectedDate,
  occupancy = [],
  isAdmin = false,
  onSelectSlot,
  isLoading = false,
}: TimelineGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleResources = isExpanded ? resources : resources.slice(0, 2);

  // Time slots for header (09:00 to 17:30, 30-min steps)
  const timeSlots = BUSINESS_TIME_SLOTS.slice(4, 22);

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
   * Half-open interval test in Asia/Colombo (+05:30) for a given slot.
   */
  const getSlotBooking = (resourceId: string, slotTime: string) => {
    const [h, m] = slotTime.split(":").map(Number);
    const [year, month, day] = selectedDate.split("-").map(Number);

    // Colombo is UTC+05:30
    const slotStartUtc =
      Date.UTC(year, month - 1, day, h, m, 0) - 5.5 * 3600 * 1000;
    const slotEndUtc = slotStartUtc + 30 * 60 * 1000;

    for (const res of occupancy) {
      if (res.resourceId !== resourceId) continue;
      if (res.status !== "PENDING" && res.status !== "APPROVED") continue;

      const s = new Date(res.startTime).getTime();
      const e = new Date(res.endTime).getTime();

      // Half-open interval overlap: [s, e) ∩ [slotStartUtc, slotEndUtc) ≠ ∅
      if (s < slotEndUtc && e > slotStartUtc) {
        return res;
      }
    }
    return null;
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
                visibleResources.map((res) => (
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

                    {/* Right Columns: Real Time Slot Cells */}
                    <div
                      className="flex-1 grid divide-x divide-[#E5E7EB] bg-white"
                      style={{
                        gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {timeSlots.map((slot) => {
                        const booking = getSlotBooking(res.id, slot);

                        if (booking) {
                          const isPending = booking.status === "PENDING";
                          const label = isPending
                            ? "Pending Approval"
                            : "Reserved";
                          const tooltip = isAdmin && booking.title
                            ? `${booking.title} (${booking.user?.name || "User"}) · ${formatColomboInterval(booking.startTime, booking.endTime)}`
                            : `${label} · ${formatColomboInterval(booking.startTime, booking.endTime)}`;

                          return (
                            <div
                              key={slot}
                              className={cn(
                                "h-14 relative p-1 flex items-center justify-center transition-colors",
                                isPending
                                  ? "bg-amber-50/70"
                                  : "bg-blue-50/60"
                              )}
                              title={tooltip}
                            >
                              <div
                                className={cn(
                                  "w-full h-full rounded-md border flex flex-col items-center justify-center text-[10px] font-semibold px-1 text-center truncate shadow-2xs select-none",
                                  isPending
                                    ? "bg-amber-100/90 text-amber-800 border-amber-300"
                                    : "bg-blue-100/80 text-blue-700 border-blue-200"
                                )}
                              >
                                <span className="truncate w-full">{label}</span>
                                {isAdmin && booking.user?.name && (
                                  <span className="text-[8px] font-normal text-slate-500 truncate w-full">
                                    {booking.user.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Unoccupied / Available slot
                        return (
                          <div
                            key={slot}
                            onClick={() => {
                              if (res.isActive) {
                                onSelectSlot?.(res.id, slot);
                              }
                            }}
                            className={cn(
                              "h-14 relative flex items-center justify-center transition-colors group/cell",
                              res.isActive
                                ? "hover:bg-blue-50/40 cursor-pointer"
                                : "bg-slate-50/40 cursor-not-allowed opacity-60"
                            )}
                            title={
                              res.isActive
                                ? `Available · Click to reserve ${res.name} at ${formatSlotLabel(slot)}`
                                : `${res.name} is inactive`
                            }
                          >
                            {res.isActive && (
                              <span className="opacity-0 group-hover/cell:opacity-100 text-blue-600 transition-opacity">
                                <Plus className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
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
