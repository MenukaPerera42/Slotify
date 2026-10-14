"use client";

import { useState, useEffect, useCallback } from "react";
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
  generateBookingEndOptions,
  minuteToTimeStr,
} from "@/features/office-shifts/utils/shift-client-utils";
import {
  getColomboTodayString,
  BUSINESS_TIME_SLOTS,
} from "@/features/reservations/utils/client-date";
import type { ResourceItem } from "./resource-card";

interface ResourcesPageClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
  };
  resources: ResourceItem[];
  categories: { id: string; name: string }[];
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
  const [occupancy, setOccupancy] = useState<ReservationOccupancy[]>([]);
  const [effectiveSchedule, setEffectiveSchedule] = useState<EffectiveSchedule | null>(null);
  const [isLoadingOccupancy, setIsLoadingOccupancy] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<"calendar" | "map">("calendar");

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
    setIsLoadingOccupancy(true);
    Promise.all([
      getGroupedReservationsForDateAction({ date: dateStr }),
      getEffectiveSchedulingHoursAction({ date: dateStr }),
    ])
      .then(([occRes, shiftRes]) => {
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
        setIsLoadingOccupancy(false);
      });
  }, []);

  // Fetch when selectedDate changes
  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      getGroupedReservationsForDateAction({ date: selectedDate }),
      getEffectiveSchedulingHoursAction({ date: selectedDate }),
    ])
      .then(([occRes, shiftRes]) => {
        if (!isCurrent) return;
        if (occRes.success) {
          setOccupancy(occRes.data as ReservationOccupancy[]);
        }
        if (shiftRes.success && shiftRes.data) {
          setEffectiveSchedule(shiftRes.data as unknown as EffectiveSchedule);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch occupancy or shifts for date:", err);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDate]);

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

  // Handle slot click from timeline
  const handleSelectSlot = (resId: string, slotTime: string) => {
    let endSlot = "18:00";
    if (effectiveSchedule) {
      const endOpts = generateBookingEndOptions(
        slotTime,
        effectiveSchedule.startMinute,
        effectiveSchedule.durationMinutes
      );
      if (endOpts.length > 1) {
        endSlot = endOpts[1].timeStr;
      } else if (endOpts.length > 0) {
        endSlot = endOpts[0].timeStr;
      }
    } else {
      const sIdx = BUSINESS_TIME_SLOTS.indexOf(slotTime);
      endSlot =
        sIdx !== -1 && sIdx + 2 < BUSINESS_TIME_SLOTS.length
          ? BUSINESS_TIME_SLOTS[sIdx + 2]
          : sIdx !== -1 && sIdx + 1 < BUSINESS_TIME_SLOTS.length
          ? BUSINESS_TIME_SLOTS[sIdx + 1]
          : "18:00";
    }

    setBookingModalState({
      isOpen: true,
      resourceId: resId,
      startTime: slotTime,
      endTime: endSlot,
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
    return occupancy.some((o) => o.resourceId === resId);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Toolbar: View Tabs + Single Dynamic Date Strip Bar + Filters */}
        <ResourceToolbar
          categories={categories}
          canManage={user.role === "ADMIN"}
          selectedCategory={selectedCategory}
          selectedStatus={selectedStatus}
          searchQuery={searchQuery}
          selectedDate={selectedDate}
          onSelectDate={(newDate) => setSelectedDate(newDate)}
          activeView={activeView}
          onViewChange={(view) => setActiveView(view)}
        />

        {/* Timeline Grid: Continuous Multi-hour Blocks + Adjacent Grouping */}
        {activeView === "calendar" && resources.length > 0 && (
          <div className="space-y-3">
            <TimelineGrid
              resources={resources}
              selectedDate={selectedDate}
              occupancy={occupancy}
              effectiveSchedule={effectiveSchedule}
              departments={departments}
              isAdmin={user.role === "ADMIN"}
              isLoading={isLoadingOccupancy}
              onSelectSlot={handleSelectSlot}
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
            />
          </div>
        )}

        {/* Bottom Section: Availability Cards matching reference */}
        <div id="availability-section" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Meeting room availability
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
