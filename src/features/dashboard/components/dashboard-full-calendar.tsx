"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { getColomboTodayString } from "@/features/reservations/utils/client-date";

export interface CalendarDaySummary {
  date: string;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  scheduled: number;
  hasActivity: boolean;
}

interface DashboardFullCalendarProps {
  year: number;
  month: number;
  selectedDate: string;
  days: CalendarDaySummary[];
  isLoading?: boolean;
  onSelectDate: (dateStr: string) => void;
  onChangeMonth: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DashboardFullCalendar({
  year,
  month,
  selectedDate,
  days,
  isLoading = false,
  onSelectDate,
  onChangeMonth,
}: DashboardFullCalendarProps) {
  const todayStr = getColomboTodayString();

  // Create quick lookup map for day activities
  const daysMap = useMemo(() => {
    const map = new Map<string, CalendarDaySummary>();
    for (const d of days) {
      map.set(d.date, d);
    }
    return map;
  }, [days]);

  // Number of days in current month
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Weekday offset for 1st of month (Monday = 0 ... Sunday = 6)
  const firstDayDow = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).getUTCDay();
  const startOffset = (firstDayDow + 6) % 7;

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (month === 1) {
      onChangeMonth(year - 1, 12);
    } else {
      onChangeMonth(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      onChangeMonth(year + 1, 1);
    } else {
      onChangeMonth(year, month + 1);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-4 sm:p-4.5 space-y-3">
      {/* Calendar Header with Month Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              {MONTH_NAMES[month - 1]} {year}
            </h3>
            <p className="text-[10px] text-slate-400">
              Asia/Colombo · Select date to inspect schedule
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={isLoading}
              className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
              title="Previous Month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isLoading}
              className="h-7 w-7 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-2xs disabled:opacity-50"
              title="Next Month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid (Compact h-10 / h-10.5 cells) */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Leading empty cells */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10 sm:h-10.5 rounded-lg bg-slate-50/40 opacity-40" />
        ))}

        {/* Month Day Cells */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const dayNum = i + 1;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const daySummary = daysMap.get(dateStr);

          const hasApproved = (daySummary?.approved ?? 0) > 0;
          const hasPending = (daySummary?.pending ?? 0) > 0;
          const hasOtherActivity = (daySummary?.rejected ?? 0) > 0 || (daySummary?.cancelled ?? 0) > 0;
          const totalScheduled = (daySummary?.scheduled ?? 0);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={`h-10 sm:h-10.5 rounded-lg flex flex-col items-center justify-between py-1 px-1 transition-all relative select-none group focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSelected
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : isToday
                  ? "bg-blue-50/70 border border-blue-200 text-blue-900 font-bold hover:bg-blue-100/70"
                  : "bg-white hover:bg-slate-50 border border-slate-100 text-slate-700 font-medium"
              }`}
            >
              <div className="flex items-center justify-between w-full px-0.5">
                <span
                  className={`text-[11px] sm:text-xs leading-none ${
                    isSelected
                      ? "text-white"
                      : isToday
                      ? "text-blue-700"
                      : "text-slate-800"
                  }`}
                >
                  {dayNum}
                </span>

                {isToday && !isSelected && (
                  <span className="text-[8px] font-bold text-blue-600 bg-blue-100 px-0.5 rounded-xs leading-tight">
                    Today
                  </span>
                )}
              </div>

              {/* Activity Indicator Dots */}
              <div className="flex items-center justify-center gap-1 min-h-[5px] w-full">
                {totalScheduled > 0 ? (
                  <div className="flex items-center gap-1">
                    {hasApproved && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-emerald-300" : "bg-emerald-500"
                        }`}
                        title={`${daySummary?.approved} Approved`}
                      />
                    )}
                    {hasPending && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-amber-300" : "bg-amber-500 animate-pulse"
                        }`}
                        title={`${daySummary?.pending} Pending`}
                      />
                    )}
                  </div>
                ) : hasOtherActivity ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-white/60" : "bg-slate-300"
                    }`}
                  />
                ) : (
                  <span className="h-1.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Activity Legend */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Pending Review</span>
          </div>
        </div>
        <span className="text-slate-400">Asia/Colombo</span>
      </div>
    </div>
  );
}

