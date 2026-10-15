"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  Plus,
  Shield,
  User as UserIcon,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSummaryCards } from "./dashboard-summary-cards";
import {
  DashboardFullCalendar,
  type CalendarDaySummary,
} from "./dashboard-full-calendar";
import {
  DashboardDaySchedule,
  type DayScheduleItem,
} from "./dashboard-day-schedule";
import { DashboardMonthlyUsage } from "./dashboard-monthly-usage";
import {
  DashboardDepartmentUsage,
  type DepartmentUsageItem,
} from "./dashboard-department-usage";
import {
  ReservationFormModal,
  type ResourceOption,
} from "@/features/reservations/components/reservation-form-modal";
import {
  getReservationSummaryAction,
  getMonthlyCalendarSummaryAction,
  getSelectedDayDashboardSummaryAction,
  getSelectedDayScheduleAction,
  getMonthlyUsageAction,
  getDepartmentUsageAction,
} from "../actions/dashboard-actions";
import {
  formatColomboDate,
  getColomboTodayString,
} from "@/features/reservations/utils/client-date";

interface DashboardClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
  };
  initialYear: number;
  initialMonth: number;
  initialSelectedDate: string;
  initialSummary: {
    scope: "PERSONAL" | "ORGANIZATION";
    totalBookings: number;
    pendingReview: number;
    approvedBookings: number;
    rejectedBookings: number;
    cancelledBookings: number;
    activeResources: number;
  };
  initialMonthlyCalendar: {
    days: CalendarDaySummary[];
  };
  initialDaySummary: {
    scheduledReservations: number;
    pendingRequests: number;
    approvedBookings: number;
    activeResources: number;
    bookedResources: number;
  };
  initialDaySchedule: {
    items: DayScheduleItem[];
  };
  initialMonthlyUsage: {
    totalBookedHours: number;
    days: { date: string; bookedHours: number }[];
  };
  initialDepartmentUsage?: {
    departments: DepartmentUsageItem[];
  } | null;
  resources: ResourceOption[];
  categories: { id: string; name: string }[];
  departments: { id: string; name: string; code: string }[];
}

export function DashboardClient({
  user,
  initialYear,
  initialMonth,
  initialSelectedDate,
  initialSummary,
  initialMonthlyCalendar,
  initialDaySummary,
  initialDaySchedule,
  initialMonthlyUsage,
  initialDepartmentUsage,
  resources,
  categories,
  departments,
}: DashboardClientProps) {
  const router = useRouter();
  const isAdmin = user.role === "ADMIN";
  const [, startTransition] = useTransition();

  // State
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);

  const [summary, setSummary] = useState(initialSummary);
  const [calendarDays, setCalendarDays] = useState(initialMonthlyCalendar.days);
  const [daySummary, setDaySummary] = useState(initialDaySummary);
  const [dayScheduleItems, setDayScheduleItems] = useState(initialDaySchedule.items);
  const [monthlyUsage, setMonthlyUsage] = useState(initialMonthlyUsage);
  const [departmentUsage, setDepartmentUsage] = useState<DepartmentUsageItem[]>(
    initialDepartmentUsage?.departments || []
  );

  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isDayLoading, setIsDayLoading] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Today in Asia/Colombo
  const todayStr = getColomboTodayString();
  const formattedToday = formatColomboDate(todayStr, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Handle selected date change
  const handleSelectDate = useCallback(
    async (dateStr: string) => {
      setSelectedDate(dateStr);
      setIsDayLoading(true);

      try {
        const [daySumRes, daySchedRes] = await Promise.all([
          getSelectedDayDashboardSummaryAction({ selectedDate: dateStr }),
          getSelectedDayScheduleAction({ selectedDate: dateStr }),
        ]);

        if (daySumRes.success && daySumRes.data) {
          setDaySummary(daySumRes.data);
        }
        if (daySchedRes.success && daySchedRes.data) {
          setDayScheduleItems(daySchedRes.data.items as DayScheduleItem[]);
        }
      } catch (err) {
        console.error("Failed to load selected day schedule:", err);
      } finally {
        setIsDayLoading(false);
      }
    },
    []
  );

  // Handle month change
  const handleChangeMonth = useCallback(
    async (newYear: number, newMonth: number) => {
      setYear(newYear);
      setMonth(newMonth);
      setIsCalendarLoading(true);

      // If current selected date is not in this month, select 1st of month
      const newMonthPrefix = `${newYear}-${String(newMonth).padStart(2, "0")}`;
      let targetDate = selectedDate;
      if (!selectedDate.startsWith(newMonthPrefix)) {
        targetDate = `${newMonthPrefix}-01`;
        setSelectedDate(targetDate);
      }

      try {
        const promises: Promise<unknown>[] = [
          getMonthlyCalendarSummaryAction({ year: newYear, month: newMonth }),
          getMonthlyUsageAction({ year: newYear, month: newMonth }),
          getSelectedDayDashboardSummaryAction({ selectedDate: targetDate }),
          getSelectedDayScheduleAction({ selectedDate: targetDate }),
        ];

        if (isAdmin) {
          promises.push(getDepartmentUsageAction({ year: newYear, month: newMonth }));
        }

        const results = await Promise.all(promises);
        const calRes = results[0] as Awaited<ReturnType<typeof getMonthlyCalendarSummaryAction>>;
        const usageRes = results[1] as Awaited<ReturnType<typeof getMonthlyUsageAction>>;
        const daySumRes = results[2] as Awaited<ReturnType<typeof getSelectedDayDashboardSummaryAction>>;
        const daySchedRes = results[3] as Awaited<ReturnType<typeof getSelectedDayScheduleAction>>;

        if (calRes.success && calRes.data) {
          setCalendarDays(calRes.data.days);
        }
        if (usageRes.success && usageRes.data) {
          setMonthlyUsage({
            totalBookedHours: usageRes.data.totalBookedHours,
            days: usageRes.data.days,
          });
        }
        if (daySumRes.success && daySumRes.data) {
          setDaySummary(daySumRes.data);
        }
        if (daySchedRes.success && daySchedRes.data) {
          setDayScheduleItems(daySchedRes.data.items as DayScheduleItem[]);
        }
        if (isAdmin && results[4]) {
          const deptRes = results[4] as Awaited<ReturnType<typeof getDepartmentUsageAction>>;
          if (deptRes.success && deptRes.data) {
            setDepartmentUsage(deptRes.data.departments);
          }
        }
      } catch (err) {
        console.error("Failed to load month data:", err);
      } finally {
        setIsCalendarLoading(false);
      }
    },
    [isAdmin, selectedDate]
  );

  // Global refresh after booking mutation
  const handleMutationSuccess = useCallback(async () => {
    try {
      const promises: Promise<unknown>[] = [
        getReservationSummaryAction(),
        getMonthlyCalendarSummaryAction({ year, month }),
        getSelectedDayDashboardSummaryAction({ selectedDate }),
        getSelectedDayScheduleAction({ selectedDate }),
        getMonthlyUsageAction({ year, month }),
      ];

      if (isAdmin) {
        promises.push(getDepartmentUsageAction({ year, month }));
      }

      const results = await Promise.all(promises);
      const sumRes = results[0] as Awaited<ReturnType<typeof getReservationSummaryAction>>;
      const calRes = results[1] as Awaited<ReturnType<typeof getMonthlyCalendarSummaryAction>>;
      const daySumRes = results[2] as Awaited<ReturnType<typeof getSelectedDayDashboardSummaryAction>>;
      const daySchedRes = results[3] as Awaited<ReturnType<typeof getSelectedDayScheduleAction>>;
      const usageRes = results[4] as Awaited<ReturnType<typeof getMonthlyUsageAction>>;

      if (sumRes.success && sumRes.data) setSummary(sumRes.data);
      if (calRes.success && calRes.data) setCalendarDays(calRes.data.days);
      if (daySumRes.success && daySumRes.data) setDaySummary(daySumRes.data);
      if (daySchedRes.success && daySchedRes.data) {
        setDayScheduleItems(daySchedRes.data.items as DayScheduleItem[]);
      }
      if (usageRes.success && usageRes.data) {
        setMonthlyUsage({
          totalBookedHours: usageRes.data.totalBookedHours,
          days: usageRes.data.days,
        });
      }
      if (isAdmin && results[5]) {
        const deptRes = results[5] as Awaited<ReturnType<typeof getDepartmentUsageAction>>;
        if (deptRes.success && deptRes.data) setDepartmentUsage(deptRes.data.departments);
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Failed to refresh dashboard on mutation:", err);
    }
  }, [isAdmin, month, router, selectedDate, year]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Role-Aware Header matching approved Slotify layout */}
      <header className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-7 pb-4 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {isAdmin ? "Operations Dashboard" : "My Dashboard"}
              </h1>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                  isAdmin
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {isAdmin ? (
                  <>
                    <Shield className="h-3 w-3" />
                    <span>Administrator</span>
                  </>
                ) : (
                  <>
                    <UserIcon className="h-3 w-3" />
                    <span>Team Member</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
              <span>Welcome back, <strong className="text-slate-800">{user.name}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="h-3 w-3" />
                <span>Asia/Colombo (UTC+5:30) · {formattedToday}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col min-[390px]:flex-row min-[390px]:flex-wrap items-stretch min-[390px]:items-center gap-2.5 min-w-0">
            <Link href="/resources" className="w-full min-[390px]:w-auto">
              <Button
                variant="outline"
                className="h-9 w-full min-[390px]:w-auto px-3.5 rounded-xl border-[#E5E7EB] text-slate-700 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <Layers className="h-4 w-4 text-slate-500" />
                <span>Browse Resources</span>
              </Button>
            </Link>

            <Button
              onClick={() => setIsBookingModalOpen(true)}
              className="h-9 w-full min-[390px]:w-auto px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>New Reservation</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-12 max-w-7xl w-full min-w-0 space-y-6">
        {/* 1. All-time Stat Cards */}
        <DashboardSummaryCards summary={summary} />

        {/* 2. Main Balanced 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Left Column (7 cols): Full-Month Calendar + Monthly Booking Volume Chart */}
          <div className="lg:col-span-7 space-y-6">
            <DashboardFullCalendar
              year={year}
              month={month}
              selectedDate={selectedDate}
              days={calendarDays}
              isLoading={isCalendarLoading}
              onSelectDate={handleSelectDate}
              onChangeMonth={handleChangeMonth}
            />

            <DashboardMonthlyUsage
              year={year}
              month={month}
              totalBookedHours={monthlyUsage.totalBookedHours}
              days={monthlyUsage.days}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          </div>

          {/* Desktop Right Column (5 cols): Selected-Date Quick View + Department / Resource Usage */}
          <div className="lg:col-span-5 space-y-6">
            <DashboardDaySchedule
              selectedDate={selectedDate}
              daySummary={daySummary}
              items={dayScheduleItems}
              isAdmin={isAdmin}
              isLoading={isDayLoading}
              onNewReservation={() => setIsBookingModalOpen(true)}
            />

            <DashboardDepartmentUsage
              isAdmin={isAdmin}
              departmentsUsage={departmentUsage}
              categories={categories}
              totalActiveResources={summary.activeResources}
            />
          </div>
        </div>
      </main>

      {/* Quick Booking Modal */}
      {isBookingModalOpen && (
        <ReservationFormModal
          isOpen={true}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={handleMutationSuccess}
          resources={resources}
          departments={departments}
          isAdmin={isAdmin}
          initialDate={selectedDate}
        />
      )}
    </div>
  );
}
