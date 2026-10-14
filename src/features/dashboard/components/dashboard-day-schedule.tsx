"use client";

import {
  CalendarDays,
  Clock,
  Building2,
  Plus,
  CheckCircle2,
  CalendarX,
  User,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  formatColomboDate,
  formatColomboInterval,
} from "@/features/reservations/utils/client-date";
import { getDepartmentColorScheme } from "@/features/departments/utils/department-colors";

import type { ReservationStatus } from "@prisma/client";

export interface DayScheduleItem {
  id: string;
  title: string;
  status: ReservationStatus | string;
  startTime: Date | string;
  endTime: Date | string;
  resourceId: string;
  resource: {
    name: string;
    location: string;
    category?: { name: string } | null;
  };
  departmentId?: string | null;
  department?: { name: string; code: string } | null;
  userId?: string | null;
  user?: { name: string | null; email: string | null } | null;
  createdByUserId?: string | null;
}

interface DashboardDayScheduleProps {
  selectedDate: string;
  daySummary: {
    scheduledReservations: number;
    pendingRequests: number;
    approvedBookings: number;
    bookedResources: number;
    activeResources: number;
  };
  items: DayScheduleItem[];
  isAdmin?: boolean;
  isLoading?: boolean;
  onNewReservation?: () => void;
}

export function DashboardDaySchedule({
  selectedDate,
  daySummary,
  items,
  isAdmin = false,
  isLoading = false,
  onNewReservation,
}: DashboardDayScheduleProps) {
  const formattedDate = formatColomboDate(selectedDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">
              Schedule Quick View
            </h3>
            {isLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
            )}
            <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold">
              {daySummary.scheduledReservations} Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNewReservation && (
            <Button
              type="button"
              size="sm"
              onClick={onNewReservation}
              className="h-8 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Book Slot</span>
            </Button>
          )}

          <Link href={`/reservations?tab=calendar`}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center gap-1 shadow-2xs"
            >
              <span>Full Timeline</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Day Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-medium">Scheduled</p>
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {daySummary.scheduledReservations}
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100/70 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-medium">Approved</p>
            <p className="text-xs font-bold text-emerald-700 leading-tight">
              {daySummary.approvedBookings}
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-100/70 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-medium">Pending</p>
            <p className="text-xs font-bold text-amber-700 leading-tight">
              {daySummary.pendingRequests}
            </p>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-medium">Booked Rooms</p>
            <p className="text-xs font-bold text-slate-900 leading-tight">
              {daySummary.bookedResources} / {daySummary.activeResources}
            </p>
          </div>
        </div>
      </div>

      {/* Scheduled Items List */}
      <div className="flex-1 overflow-y-auto max-h-[360px] space-y-2.5 pr-1">
        {items.length === 0 ? (
          <div className="h-48 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <CalendarX className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">
              No Bookings Scheduled for this Date
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
              All facilities are currently available. You can reserve any room or equipment.
            </p>
            {onNewReservation && (
              <Button
                type="button"
                size="sm"
                onClick={onNewReservation}
                className="mt-3 h-7 px-3 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Reserve Resource</span>
              </Button>
            )}
          </div>
        ) : (
          items.map((item) => {
            const isPending = item.status === "PENDING";
            const colorScheme = getDepartmentColorScheme(
              item.department?.code,
              item.department?.name
            );
            const interval = formatColomboInterval(item.startTime, item.endTime);

            return (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5"
                    style={{
                      backgroundColor: colorScheme.badgeBg,
                      borderColor: colorScheme.badgeBorder,
                      color: colorScheme.badgeText,
                    }}
                  >
                    <Building2 className="h-4.5 w-4.5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {item.resource.name}
                      </h4>
                      {item.resource.category?.name && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          • {item.resource.category.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="font-semibold text-slate-700">{interval}</span>
                      <span>•</span>
                      <span>{item.resource.location}</span>
                    </div>

                    {isAdmin && item.user && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                        <User className="h-3 w-3" />
                        <span>Booked by: {item.user.name ?? item.user.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Department badge */}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs"
                    style={{
                      backgroundColor: colorScheme.badgeBg,
                      borderColor: colorScheme.badgeBorder,
                      color: colorScheme.badgeText,
                    }}
                  >
                    {item.department?.code || colorScheme.code || (item.departmentId ? "DEP" : "Unassigned")}
                  </span>

                  {/* Status pill */}
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                      isPending
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {isPending ? "Pending Review" : "Approved"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
