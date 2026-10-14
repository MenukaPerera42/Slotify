import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireUser } from "@/lib/authorization";
import {
  reservationSummary,
  monthlyCalendarSummary,
  selectedDayDashboardSummary,
  selectedDaySchedule,
  monthlyUsage,
  departmentUsage,
} from "@/features/dashboard/services/dashboard-analytics-service";
import { getResources, getCategories } from "@/features/resources/services/resource-service";
import { publicActiveDepartments } from "@/features/departments/services/department-service";
import { getColomboTodayString } from "@/features/reservations/utils/client-date";
import { DashboardClient } from "@/features/dashboard/components/dashboard-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard | Slotify",
  description: "Operations dashboard, resource reservations, capacity metrics, and schedule overview.",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  // Current Colombo date boundaries
  const todayStr = getColomboTodayString();
  const [currentYear, currentMonth] = [
    parseInt(todayStr.slice(0, 4), 10),
    parseInt(todayStr.slice(5, 7), 10),
  ];

  // Parallel server fetches for instant initial render
  const [
    summary,
    monthlyCalendar,
    daySummary,
    daySchedule,
    monthlyUsageData,
    deptUsage,
    rawResources,
    categories,
    departments,
  ] = await Promise.all([
    reservationSummary(),
    monthlyCalendarSummary({ year: currentYear, month: currentMonth }),
    selectedDayDashboardSummary({ selectedDate: todayStr }),
    selectedDaySchedule({ selectedDate: todayStr }),
    monthlyUsage({ year: currentYear, month: currentMonth }),
    isAdmin ? departmentUsage({ year: currentYear, month: currentMonth }) : null,
    getResources(),
    getCategories(),
    publicActiveDepartments(),
  ]);

  // Format resources for modal options
  const resources = rawResources.map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    capacity: r.capacity,
    isActive: r.isActive,
    category: r.category ? { name: r.category.name } : null,
  }));

  return (
    <Suspense
      fallback={
        <div className="flex-1 p-12 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-xs">Loading dashboard metrics...</span>
        </div>
      }
    >
      <DashboardClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }}
        initialYear={currentYear}
        initialMonth={currentMonth}
        initialSelectedDate={todayStr}
        initialSummary={summary}
        initialMonthlyCalendar={{
          days: monthlyCalendar.days,
        }}
        initialDaySummary={daySummary}
        initialDaySchedule={{
          items: daySchedule.items,
        }}
        initialMonthlyUsage={{
          totalBookedHours: monthlyUsageData.totalBookedHours,
          days: monthlyUsageData.days,
        }}
        initialDepartmentUsage={deptUsage}
        resources={resources}
        categories={categories}
        departments={departments}
      />
    </Suspense>
  );
}
