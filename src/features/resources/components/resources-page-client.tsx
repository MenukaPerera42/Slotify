"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ResourceToolbar } from "./resource-toolbar";
import { TimelineGrid, type ReservationOccupancy } from "./timeline-grid";
import { AvailabilityCard } from "./availability-card";
import {
  ReservationFormModal,
  type ResourceOption,
} from "@/features/reservations/components/reservation-form-modal";
import { getGroupedReservationsForDateAction } from "@/features/reservations/actions/reservation-actions";
import { getEffectiveSchedulingHoursAction } from "@/features/office-shifts/actions/office-shift-actions";
import type { EffectiveSchedule } from "@/features/office-shifts/types/effective-schedule";
import {
  minuteToTimeStr,
} from "@/features/office-shifts/utils/shift-client-utils";
import {
  getColomboTodayString,
} from "@/features/reservations/utils/client-date";
import type { ResourceItem } from "./resource-card";
import { applyConfirmedTime, type ConfirmedReservationTime } from "../utils/timeline-interactions";

interface ResourcesPageClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
  };
  resources: ResourceItem[];
  categories: { id: string; name: string; isActive?: boolean }[];
  departments?: { id: string; name: string; code: string }[];
  selectedCategory?: string;
  selectedStatus?: string;
  searchQuery?: string;
}

export function ResourcesPageClient({
  user,
  resources,
  categories,
  departments = [],
  selectedCategory = "ALL",
  selectedStatus = "ALL",
  searchQuery = "",
}: ResourcesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [selectedDate, setSelectedDate] = useState<string>(getColomboTodayString());
  const selectedDateRef = useRef(selectedDate);
  const requestVersion = useRef(0);
  const [occupancy, setOccupancy] = useState<ReservationOccupancy[]>([]);
  const [effectiveSchedule, setEffectiveSchedule] = useState<EffectiveSchedule | null>(null);
  const [isLoadingOccupancy, setIsLoadingOccupancy] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<"calendar" | "map">("calendar");
  const displayedSchedule = effectiveSchedule?.operationalDate === selectedDate ? effectiveSchedule : null;

  // Booking Modal State
  const bookResourceIdParam = searchParams.get("bookResourceId");
  const [bookingModalState, setBookingModalState] = useState<{
    isOpen: boolean;
    resourceId?: string;
    startTime?: string;
    endTime?: string;
  }>({
    isOpen: Boolean(bookResourceIdParam),
    resourceId: bookResourceIdParam || undefined,
  });

  // Fetch real grouped occupancy and effective office shift schedule for the selected date
  const fetchOccupancy = useCallback((dateStr: string) => {
    const version = ++requestVersion.current;
    setIsLoadingOccupancy(true);
    Promise.all([
      getGroupedReservationsForDateAction({ date: dateStr }),
      getEffectiveSchedulingHoursAction({ date: dateStr }),
    ])
      .then(([occRes, shiftRes]) => {
        if (version !== requestVersion.current || dateStr !== selectedDateRef.current) return;
        if (occRes.success) {
          setOccupancy(occRes.data as ReservationOccupancy[]);
        }
        if (shiftRes.success && shiftRes.data) {
          setEffectiveSchedule(shiftRes.data as unknown as EffectiveSchedule);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch occupancy or shifts for date:", err);
      })
      .finally(() => {
        if (version === requestVersion.current) setIsLoadingOccupancy(false);
      });
  }, []);

  // Fetch when selectedDate changes
  useEffect(() => {
    let isCurrent = true;
    const version = ++requestVersion.current;
    Promise.all([
      getGroupedReservationsForDateAction({ date: selectedDate }),
      getEffectiveSchedulingHoursAction({ date: selectedDate }),
    ])
      .then(([occRes, shiftRes]) => {
        if (!isCurrent || version !== requestVersion.current || selectedDate !== selectedDateRef.current) return;
        if (occRes.success) {
          setOccupancy(occRes.data as ReservationOccupancy[]);
        }
        if (shiftRes.success && shiftRes.data) {
          setEffectiveSchedule(shiftRes.data as unknown as EffectiveSchedule);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch occupancy or shifts for date:", err);
      }).finally(() => {
        if (isCurrent && version === requestVersion.current) setIsLoadingOccupancy(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDate]);

  const handleTimeSaved = (confirmed: ConfirmedReservationTime) => {
    ++requestVersion.current;
    setOccupancy((current) => applyConfirmedTime(current, confirmed));
    setEffectiveSchedule((current) => current ? {
      ...current,
      occupancy: applyConfirmedTime(current.occupancy, confirmed),
      outsideWindowOccupancy: applyConfirmedTime(current.outsideWindowOccupancy, confirmed),
    } : current);
    fetchOccupancy(selectedDateRef.current);
  };

  // Periodic visibility polling (every 25s) + tab focus revalidation
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOccupancy(selectedDate);
      }
    }, 25000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchOccupancy(selectedDate);
      }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [selectedDate, fetchOccupancy]);

  const handleSelectRange = (resId: string, startTime: string, endTime: string) => {
    setBookingModalState({
      isOpen: true,
      resourceId: resId,
      startTime,
      endTime,
    });
  };

  // Convert resources to ResourceOption shape for modal
  const modalResources: ResourceOption[] = resources.map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    capacity: r.capacity,
    isActive: r.isActive,
    category: { name: r.category.name },
  }));

  // Check if a resource has any bookings on the selected date
  const resourceHasBookings = (resId: string) => {
    return Boolean(displayedSchedule) && occupancy.some((o) => o.resourceId === resId);
  };

  return (
    <>
      <div className="space-y-6 min-w-0 max-w-full">
        {/* Toolbar: View Tabs + Single Dynamic Date Strip Bar + Filters */}
        <ResourceToolbar
          categories={categories}
          canManage={user.role === "ADMIN"}
          selectedCategory={selectedCategory}
          selectedStatus={selectedStatus}
          searchQuery={searchQuery}
          selectedDate={selectedDate}
          onSelectDate={(newDate) => {
            selectedDateRef.current = newDate;
            ++requestVersion.current;
            setIsLoadingOccupancy(true);
            setSelectedDate(newDate);
          }}
          activeView={activeView}
          onViewChange={(view) => setActiveView(view)}
        />

        {/* Timeline Grid: Continuous Multi-hour Blocks + Adjacent Grouping */}
        {activeView === "calendar" && resources.length > 0 && (
          <div className="space-y-3 min-w-0 max-w-full">
            <TimelineGrid
              resources={resources}
              selectedDate={selectedDate}
              occupancy={displayedSchedule ? occupancy : []}
              effectiveSchedule={displayedSchedule}
              departments={departments}
              isAdmin={user.role === "ADMIN"}
              isLoading={isLoadingOccupancy && !displayedSchedule}
              onSelectRange={handleSelectRange}
              onNewReservation={() =>
                setBookingModalState({
                  isOpen: true,
                  resourceId: resources[0]?.id,
                  startTime: effectiveSchedule
                    ? minuteToTimeStr(effectiveSchedule.startMinute)
                    : "09:00",
                  endTime: "10:00",
                })
              }
              onBrowseResources={() => {
                document
                  .getElementById("availability-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              onRefresh={() => fetchOccupancy(selectedDate)}
              onReservationTimeSaved={handleTimeSaved}
            />
          </div>
        )}

        {/* Bottom Section: Availability Cards matching reference */}
        <div id="availability-section" className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              Resource availability
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {resources.length} resources found
            </span>
          </div>

          {resources.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="No resources found"
              description="No resources match your active search or category filters. Try adjusting your filter parameters."
            />
          ) : (
            <div className="space-y-3">
              {resources.map((resource) => (
                <AvailabilityCard
                  key={resource.id}
                  resource={resource}
                  categories={categories}
                  canManage={user.role === "ADMIN"}
                  selectedDate={selectedDate}
                  hasBookingsToday={resourceHasBookings(resource.id)}
                  onBook={(resId) =>
                    setBookingModalState({
                      isOpen: true,
                      resourceId: resId,
                      startTime: "09:00",
                      endTime: "10:00",
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unified Booking Request Modal */}
      {bookingModalState.isOpen && (
        <ReservationFormModal
          isOpen={true}
          onClose={() => {
            setBookingModalState({ isOpen: false });
            if (bookResourceIdParam) {
              const p = new URLSearchParams(
                searchParams ? Array.from(searchParams.entries()) : []
              );
              p.delete("bookResourceId");
              router.replace(
                `/resources${p.toString() ? `?${p.toString()}` : ""}`
              );
            }
          }}
          onSuccess={() => {
            fetchOccupancy(selectedDate);
            router.refresh();
          }}
          resources={modalResources}
          departments={departments}
          effectiveSchedule={effectiveSchedule}
          isAdmin={user.role === "ADMIN"}
          initialResourceId={bookingModalState.resourceId}
          initialDate={selectedDate}
          initialStartTime={bookingModalState.startTime}
          initialEndTime={bookingModalState.endTime}
        />
      )}
    </>
  );
}
