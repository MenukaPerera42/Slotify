"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  Monitor,
  Cpu,
  Layers,
  ChevronLeft,
  ChevronRight,
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

const timeSlots = [
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
];
export function TimelineGrid({
  resources,
  selectedDate,
  occupancy = [],
  isAdmin = false,
  onSelectSlot,
  isLoading = false,
}: TimelineGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Show top 2 resources by default to match reference proportions, or all if expanded
  const visibleResources = isExpanded ? resources : resources.slice(0, 2);

export function TimelineGrid({ resources }: TimelineGridProps) {
  // Show top 2 resources for the timeline overview matching reference screenshot
  const previewResources = resources.slice(0, 2);
  // Time slots for header matching reference width (10 columns: 9:00 AM to 5:30 PM)
  const timeSlots = BUSINESS_TIME_SLOTS.slice(4, 22); // 09:00 to 17:30 (30-min steps)

  const renderIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes("meeting") || lower.includes("room"))
    if (lower.includes("meeting") || lower.includes("room") || lower.includes("board")) {
      return <Building2 className="h-5 w-5" />;
    if (lower.includes("workstation") || lower.includes("desk"))
    }
    if (lower.includes("workstation") || lower.includes("desk") || lower.includes("pod")) {
      return <Monitor className="h-5 w-5" />;
    if (lower.includes("lab") || lower.includes("equipment") || lower.includes("gpu"))
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
          <div className="min-w-[860px]">
            {/* Header Row: Room label + Time markers + reference arrows */}
          <div className="min-w-[960px]">
            {/* Header Row: Room label + Time markers + reference navigation indicators */}
            <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/50 text-[11px] font-semibold text-slate-500">
              <div className="w-56 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-800 flex items-center justify-between">
                <span>Rooms</span>
                <span>Resources</span>
                <span className="text-slate-400">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="flex-1 grid grid-cols-10 divide-x divide-[#E5E7EB] text-center">
              <div
                className="flex-1 grid divide-x divide-[#E5E7EB] text-center"
                style={{
                  gridTemplateColumns: `repeat(${timeSlots.length}, minmax(0, 1fr))`,
                }}
              >
                {timeSlots.map((slot, idx) => (
                  <div
                    key={slot}
                    className="py-2.5 px-1 truncate flex items-center justify-center relative"
                  >
                    <span>{slot}</span>
                    <span>{formatSlotLabel(slot)}</span>
                    {idx === timeSlots.length - 1 && (
                      <span className="absolute right-1 text-slate-400">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Rows per Resource */}
            <div className="divide-y divide-[#E5E7EB]">
              {previewResources.map((res) => (
                <div
                  key={res.id}
                  className="flex items-stretch group hover:bg-slate-50/30 transition-colors"
                >
                  {/* Left Column: Resource Card with Thumbnail/Icon */}
                  <div className="w-56 p-3.5 pl-4 border-r border-[#E5E7EB] shrink-0 flex items-center gap-3">
                    <div className="h-12 w-14 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      {renderIcon(res.category.name)}
            <div className="divide-y divide-[#E5E7EB] relative">
              {isLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-2xs flex items-center justify-center z-10 text-xs text-slate-400 font-medium">
                  Updating occupancy...
                </div>
              )}

              {visibleResources.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No resources to display in timeline.
                </div>
              ) : (
                visibleResources.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-stretch group hover:bg-slate-50/30 transition-colors"
                  >
                    {/* Left Column: Resource Card with Thumbnail/Icon */}
                    <div className="w-56 p-3.5 pl-4 border-r border-[#E5E7EB] shrink-0 flex items-center gap-3">
                      <div className="h-12 w-14 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        {renderIcon(res.category.name)}
                      </div>
                      <div className="min-w-0 flex-1">
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

                  {/* Right Columns: Time Slot Cells */}
                  <div className="flex-1 grid grid-cols-10 divide-x divide-[#E5E7EB] bg-white">
                    {timeSlots.map((slot, idx) => (
                      <Link
                        key={slot}
                        href={`/reservations?bookResourceId=${res.id}`}
                        className="h-14 relative flex items-center justify-center hover:bg-blue-50/20 transition-colors cursor-pointer"
                        title={`Book ${res.name} at ${slot}`}
                      >
                        {/* Sample booking block matching screenshot visual feel */}
                        {idx === 2 && res.isActive && (
                          <div className="absolute inset-x-1 inset-y-2 rounded-md bg-blue-100/70 border border-blue-200 flex items-center justify-center text-[10px] font-semibold text-blue-700 pointer-events-none">
                            Reserved
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
                        )}
                      </Link>
                    ))}
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Double Chevron Down expander matching reference screenshot */}
      <div className="flex justify-center pt-1">
        <div className="p-1 rounded-full text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
          <ChevronsDown className="h-5 w-5" />
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
      </div>
      )}
    </div>
  );
}
