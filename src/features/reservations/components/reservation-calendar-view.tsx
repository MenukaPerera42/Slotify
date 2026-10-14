"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Building2,
  Monitor,
  Cpu,
  Layers,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReservationsForDateAction } from "../actions/reservation-actions";
import {
  BUSINESS_TIME_SLOTS,
  formatSlotLabel,
  formatColomboDate,
  getColomboTodayString,
  getColomboDateStrip,
} from "../utils/client-date";
import { ReservationFormModal, type ResourceOption } from "./reservation-form-modal";

interface ReservationInterval {
  id?: string;
  resourceId: string;
  startTime: Date | string;
  endTime: Date | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  title?: string;
  user?: { name: string; email: string };
}

interface ReservationCalendarViewProps {
  resources: ResourceOption[];
  categories: { id: string; name: string }[];
  isAdmin?: boolean;
  initialDate?: string;
  onBookResource?: (resourceId: string, date: string, startTime: string) => void;
}

export function ReservationCalendarView({
  resources,
  categories,
  isAdmin = false,
  initialDate,
}: ReservationCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate || getColomboTodayString());
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [reservations, setReservations] = useState<ReservationInterval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Quick booking modal state
  const [bookingModalState, setBookingModalState] = useState<{
    isOpen: boolean;
    resourceId?: string;
    startTime?: string;
    endTime?: string;
  }>({ isOpen: false });

  // Detail popover state (for admin or user inspecting a block)
  const [selectedBooking, setSelectedBooking] = useState<ReservationInterval | null>(null);

  // Filtered resources
  const filteredResources = resources.filter((res) => {
    if (!res.isActive) return false;
    if (selectedCategory !== "ALL" && res.category?.name !== selectedCategory) {
      return false;
    }
    return true;
  });

  // Fetch reservations for the selected date
  const fetchDateReservations = useCallback((dateStr: string) => {
    setIsLoading(true);
    getReservationsForDateAction({ date: dateStr })
      .then((result) => {
        if (result.success) {
          setReservations(result.data as ReservationInterval[]);
          setLastRefreshed(new Date());
        }
      })
      .catch((err) => {
        console.error("Failed to fetch reservations for date:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Fetch when selectedDate changes
  useEffect(() => {
    let isCurrent = true;
    getReservationsForDateAction({ date: selectedDate })
      .then((result) => {
        if (isCurrent && result.success) {
          setReservations(result.data as ReservationInterval[]);
          setLastRefreshed(new Date());
        }
      })
      .catch((err) => {
        console.error("Failed to fetch reservations for date:", err);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDate]);

  // Periodic visibility polling (every 25 seconds) + focus sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchDateReservations(selectedDate);
      }
    }, 25000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDateReservations(selectedDate);
      }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [selectedDate, fetchDateReservations]);

  // Date navigation handlers
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    setSelectedDate(prev.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    setSelectedDate(next.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    setSelectedDate(getColomboTodayString());
  };

  const dateStripItems = getColomboDateStrip(selectedDate, 10);

  // Time slots for header (e.g., from 08:00 to 18:00, 30-min intervals)
  const displaySlots = BUSINESS_TIME_SLOTS.slice(2, 23); // 08:00 to 18:00

  // Category Icon helper
  const renderIcon = (catName?: string) => {
    const lower = (catName || "").toLowerCase();
    if (lower.includes("meeting") || lower.includes("room") || lower.includes("board")) {
      return <Building2 className="h-4 w-4" />;
    }
    if (lower.includes("workstation") || lower.includes("desk") || lower.includes("pod")) {
      return <Monitor className="h-4 w-4" />;
    }
    if (lower.includes("lab") || lower.includes("equipment") || lower.includes("gpu")) {
      return <Cpu className="h-4 w-4" />;
    }
    return <Layers className="h-4 w-4" />;
  };

  // Check if a resource is booked during a particular slot
  const getSlotOccupancy = (resourceId: string, slotTime: string) => {
    const [slotHour, slotMin] = slotTime.split(":").map(Number);
    // In Colombo time, check if any reservation covers this 30-minute block
    for (const res of reservations) {
      if (res.resourceId !== resourceId) continue;
      const s = new Date(res.startTime);
      const e = new Date(res.endTime);

      // Convert slot to UTC millisecond bounds based on selectedDate
      // Colombo is UTC+05:30 -> offset - 330 minutes
      const slotStartUtc = Date.UTC(
        parseInt(selectedDate.slice(0, 4), 10),
        parseInt(selectedDate.slice(5, 7), 10) - 1,
        parseInt(selectedDate.slice(8, 10), 10),
        slotHour,
        slotMin
      ) - (5.5 * 60 * 60 * 1000);
      const slotEndUtc = slotStartUtc + 30 * 60 * 1000;

      if (s.getTime() < slotEndUtc && e.getTime() > slotStartUtc) {
        return res;
      }
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Date Navigator + Category Filters + Refresh */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Date Display & Today Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 border-slate-200"
            >
              Today
            </Button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevDay}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="ml-1">
              <h3 className="text-sm font-bold text-slate-900">
                {formatColomboDate(selectedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h3>
              <p className="text-[11px] text-slate-400">
                Asia/Colombo Standard Time (UTC+05:30)
              </p>
            </div>
          </div>

          {/* Right: Category Filter Pills & Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === "ALL"
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.name)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === c.name
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                {c.name}
              </button>
            ))}

            <button
              type="button"
              onClick={() => fetchDateReservations(selectedDate)}
              disabled={isLoading}
              title={`Last refreshed at ${lastRefreshed.toLocaleTimeString()}`}
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors ml-auto sm:ml-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Date Strip Bar matching reference design */}
        <div className="flex items-center gap-1.5 w-full overflow-x-auto pt-1 pb-0.5 scrollbar-none select-none border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-1 justify-between min-w-[500px]">
            {dateStripItems.map((item) => {
              const isSelected = item.dateStr === selectedDate;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(item.dateStr)}
                  className={`flex-1 min-w-0 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all border shadow-2xs ${
                    isSelected
                      ? "bg-blue-50 border-blue-200 text-blue-700 shadow-xs"
                      : "bg-white border-slate-200/80 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-[10px] font-medium text-slate-400 leading-none mb-1">
                    {item.day}
                  </span>
                  <span className={`text-sm font-bold leading-none ${isSelected ? "text-blue-700" : "text-slate-800"}`}>
                    {item.dateNum}
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 leading-none mt-1">
                    {item.month}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend & Summary */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-white border border-slate-200 shadow-2xs" />
            <span>Available</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-amber-100 border border-amber-300" />
            <span className="text-amber-800 font-medium">Pending Approval</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-blue-100 border border-blue-300" />
            <span className="text-blue-800 font-medium">Approved / Reserved</span>
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Click any available slot to book immediately
        </div>
      </div>

      {/* Interactive Timeline Grid */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            {/* Header: Resource column + Time markers */}
            <div className="flex items-center border-b border-[#E5E7EB] bg-slate-50/60 text-[11px] font-semibold text-slate-600">
              <div className="w-60 p-3 pl-4 border-r border-[#E5E7EB] shrink-0 font-bold text-slate-800">
                Resource
              </div>
              <div className="flex-1 grid grid-cols-21 divide-x divide-[#E5E7EB] text-center">
                {displaySlots.map((slot) => (
                  <div key={slot} className="py-2.5 px-0.5 truncate text-[10px] text-slate-500 font-medium">
                    {formatSlotLabel(slot)}
                  </div>
                ))}
              </div>
            </div>

            {/* Resource Rows */}
            <div className="divide-y divide-[#E5E7EB]">
              {filteredResources.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No active resources found in this category.
                </div>
              ) : (
                filteredResources.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-stretch group hover:bg-slate-50/20 transition-colors"
                  >
                    {/* Left Column: Resource Details */}
                    <div className="w-60 p-3.5 pl-4 border-r border-[#E5E7EB] shrink-0 flex items-center gap-3 bg-white">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                        {renderIcon(res.category?.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {res.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="truncate">{res.location}</span>
                          {res.capacity && (
                            <span className="flex items-center gap-0.5 text-slate-500 shrink-0">
                              <Users className="h-2.5 w-2.5" />
                              {res.capacity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Columns: Time Slot Cells */}
                    <div className="flex-1 grid grid-cols-21 divide-x divide-[#E5E7EB] bg-white relative">
                      {displaySlots.map((slot, idx) => {
                        const occupancy = getSlotOccupancy(res.id, slot);

                        if (occupancy) {
                          const isPending = occupancy.status === "PENDING";
                          return (
                            <div
                              key={slot}
                              onClick={() => {
                                if (isAdmin || occupancy.title) {
                                  setSelectedBooking(occupancy);
                                }
                              }}
                              className={`h-14 relative p-0.5 flex flex-col justify-center items-center cursor-pointer transition-all ${
                                isPending
                                  ? "bg-amber-50 hover:bg-amber-100/80"
                                  : "bg-blue-50 hover:bg-blue-100/80"
                              }`}
                              title={
                                occupancy.title
                                  ? `${occupancy.title} (${occupancy.status})`
                                  : `${occupancy.status}`
                              }
                            >
                              <div
                                className={`w-full h-full rounded-md flex flex-col justify-center items-center text-[10px] font-semibold px-1 text-center truncate ${
                                  isPending
                                    ? "bg-amber-100/90 text-amber-900 border border-amber-300"
                                    : "bg-blue-100/90 text-blue-900 border border-blue-300"
                                }`}
                              >
                                <span className="truncate w-full">
                                  {occupancy.title || (isPending ? "Pending" : "Reserved")}
                                </span>
                                {isAdmin && occupancy.user?.name && (
                                  <span className="text-[8px] font-normal text-slate-600 truncate w-full">
                                    {occupancy.user.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Available Slot
                        return (
                          <div
                            key={slot}
                            onClick={() => {
                              // Next slot for end time
                              const nextSlot = displaySlots[idx + 2] || displaySlots[idx + 1] || "18:00";
                              setBookingModalState({
                                isOpen: true,
                                resourceId: res.id,
                                startTime: slot,
                                endTime: nextSlot,
                              });
                            }}
                            className="h-14 relative flex items-center justify-center hover:bg-blue-50/50 transition-colors cursor-pointer group/cell"
                            title={`Book ${res.name} at ${formatSlotLabel(slot)}`}
                          >
                            <span className="opacity-0 group-hover/cell:opacity-100 text-blue-600 transition-opacity">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
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

      {/* Booking Details Modal (if admin or user clicks occupied slot) */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full shadow-xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    selectedBooking.status === "PENDING" ? "bg-amber-500" : "bg-blue-500"
                  }`}
                />
                <h4 className="text-sm font-bold text-slate-900">
                  {selectedBooking.status === "PENDING" ? "Pending Booking" : "Confirmed Reservation"}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400">Title / Purpose:</span>
                <p className="font-semibold text-slate-800 text-sm mt-0.5">
                  {selectedBooking.title || "Occupied slot"}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600 pt-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  {new Date(selectedBooking.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – {new Date(selectedBooking.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>

              {selectedBooking.user && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400">Reserved by:</span>
                  <p className="font-medium text-slate-800">{selectedBooking.user.name}</p>
                  <p className="text-[11px] text-slate-400">{selectedBooking.user.email}</p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedBooking(null)}
                className="w-full text-xs rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {bookingModalState.isOpen && (
        <ReservationFormModal
          isOpen={bookingModalState.isOpen}
          onClose={() => setBookingModalState({ isOpen: false })}
          onSuccess={() => {
            fetchDateReservations(selectedDate);
          }}
          resources={resources}
          isAdmin={isAdmin}
          initialResourceId={bookingModalState.resourceId}
          initialDate={selectedDate}
          initialStartTime={bookingModalState.startTime}
          initialEndTime={bookingModalState.endTime}
        />
      )}
    </div>
  );
}
