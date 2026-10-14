"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGroupedReservationsForDateAction } from "../actions/reservation-actions";
import {
  BUSINESS_TIME_SLOTS,
  formatColomboDate,
  getColomboTodayString,
  getColomboDateStrip,
} from "../utils/client-date";
import {
  TimelineGrid,
  type ReservationOccupancy,
  type DepartmentOption,
} from "@/features/resources/components/timeline-grid";
import { ReservationFormModal, type ResourceOption } from "./reservation-form-modal";
import { DEPARTMENT_PALETTES, UNASSIGNED_PALETTE } from "@/features/departments/utils/department-colors";

interface ReservationCalendarViewProps {
  resources: ResourceOption[];
  categories: { id: string; name: string }[];
  departments?: DepartmentOption[];
  isAdmin?: boolean;
  initialDate?: string;
  onBookResource?: (resourceId: string, date: string, startTime: string) => void;
}

export function ReservationCalendarView({
  resources,
  categories,
  departments = [],
  isAdmin = false,
  initialDate,
}: ReservationCalendarViewProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(
    initialDate || getColomboTodayString()
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [occupancy, setOccupancy] = useState<ReservationOccupancy[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Quick booking modal state
  const [bookingModalState, setBookingModalState] = useState<{
    isOpen: boolean;
    resourceId?: string;
    startTime?: string;
    endTime?: string;
  }>({ isOpen: false });

  // Filtered resources matching category filter
  const filteredResources = resources.filter((res) => {
    if (!res.isActive) return false;
    if (selectedCategory !== "ALL" && res.category?.name !== selectedCategory) {
      return false;
    }
    return true;
  });

  // Fetch real grouped reservations for the selected date
  const fetchDateReservations = useCallback((dateStr: string) => {
    setIsLoading(true);
    getGroupedReservationsForDateAction({ date: dateStr })
      .then((result) => {
        if (result.success) {
          setOccupancy(result.data as ReservationOccupancy[]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch grouped reservations for date:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Fetch when selectedDate changes (with race-condition protection)
  useEffect(() => {
    let isCurrent = true;
    getGroupedReservationsForDateAction({ date: selectedDate })
      .then((result) => {
        if (isCurrent && result.success) {
          setOccupancy(result.data as ReservationOccupancy[]);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch grouped reservations for date:", err);
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

  // Handle slot click from timeline
  const handleSelectSlot = (resId: string, slotTime: string) => {
    const sIdx = BUSINESS_TIME_SLOTS.indexOf(slotTime);
    const endSlot =
      sIdx !== -1 && sIdx + 2 < BUSINESS_TIME_SLOTS.length
        ? BUSINESS_TIME_SLOTS[sIdx + 2]
        : sIdx !== -1 && sIdx + 1 < BUSINESS_TIME_SLOTS.length
        ? BUSINESS_TIME_SLOTS[sIdx + 1]
        : "18:00";

    setBookingModalState({
      isOpen: true,
      resourceId: resId,
      startTime: slotTime,
      endTime: endSlot,
    });
  };

  // Standard departments palette list for legend
  const departmentLegends = [
    DEPARTMENT_PALETTES.ENG,
    DEPARTMENT_PALETTES.FE,
    DEPARTMENT_PALETTES.BE,
    DEPARTMENT_PALETTES.MOBILE,
    DEPARTMENT_PALETTES.IT,
    DEPARTMENT_PALETTES.HR,
    UNASSIGNED_PALETTE,
  ];

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
                {formatColomboDate(selectedDate, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
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
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-2xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat.name
                    ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-2xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                }`}
              >
                {cat.name}
              </button>
            ))}

            <button
              type="button"
              onClick={() => fetchDateReservations(selectedDate)}
              disabled={isLoading}
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Refresh schedule"
              aria-label="Refresh schedule"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Dynamic 10-Day Strip Selector */}
        <div className="pt-2 border-t border-slate-100 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {dateStripItems.map((item) => {
              const isSelected = item.dateStr === selectedDate;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(item.dateStr)}
                  className={`flex flex-col items-center justify-center w-14 py-2 rounded-xl transition-all border ${
                    isSelected
                      ? "bg-blue-50 border-blue-300 text-blue-700 shadow-2xs ring-1 ring-blue-300"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`text-[10px] font-semibold uppercase leading-none mb-1 ${
                      isSelected ? "text-blue-600" : "text-slate-400"
                    }`}
                  >
                    {item.day}
                  </span>
                  <span
                    className={`text-sm font-bold leading-none ${
                      isSelected ? "text-blue-700" : "text-slate-800"
                    }`}
                  >
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

      {/* Legend Bar: Status & Department Colors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-500 gap-2 px-1">
        {/* Status Indicators */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-white border border-slate-200 shadow-2xs" />
            <span className="text-[11px]">Available Slot (Click to book)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300" />
            <span className="text-[11px] text-amber-800 font-semibold">
              Pending Approval
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-slate-700 font-semibold">
              Reserved
            </span>
          </span>
        </div>

        {/* Department Colors Guide */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="font-semibold text-slate-400">Departments:</span>
          {departmentLegends.map((dept) => (
            <span
              key={dept.code}
              className="px-1.5 py-0.5 rounded border font-medium shadow-2xs"
              style={{
                backgroundColor: dept.bg,
                borderColor: dept.border,
                color: dept.text,
              }}
            >
              {dept.code}
            </span>
          ))}
        </div>
      </div>

      {/* Shared Interactive Timeline Grid: Booked Resources Only + Continuous Multi-Hour Blocks */}
      <TimelineGrid
        resources={filteredResources}
        selectedDate={selectedDate}
        occupancy={occupancy}
        departments={departments}
        isAdmin={isAdmin}
        isLoading={isLoading}
        onSelectSlot={handleSelectSlot}
        onNewReservation={() =>
          setBookingModalState({
            isOpen: true,
            resourceId: filteredResources[0]?.id,
            startTime: "09:00",
            endTime: "10:00",
          })
        }
        onBrowseResources={() => router.push("/resources")}
      />

      {/* Quick Booking Modal */}
      <ReservationFormModal
        isOpen={bookingModalState.isOpen}
        onClose={() => setBookingModalState({ isOpen: false })}
        resources={resources}
        departments={departments}
        initialResourceId={bookingModalState.resourceId}
        initialDate={selectedDate}
        initialStartTime={bookingModalState.startTime}
        initialEndTime={bookingModalState.endTime}
        isAdmin={isAdmin}
        onSuccess={() => {
          fetchDateReservations(selectedDate);
          router.refresh();
        }}
      />
    </div>
  );
}
