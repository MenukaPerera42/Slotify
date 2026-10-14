"use client";

import { useMemo } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

interface MonthlyUsageDay {
  date: string;
  bookedHours: number;
}

interface DashboardMonthlyUsageProps {
  year: number;
  month: number;
  totalBookedHours: number;
  days: MonthlyUsageDay[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function DashboardMonthlyUsage({
  year,
  month,
  totalBookedHours,
  days,
  selectedDate,
  onSelectDate,
}: DashboardMonthlyUsageProps) {
  // Compute max hours for bar scaling (at least 4 hours so bars have proportional height)
  const maxHours = useMemo(() => {
    const max = Math.max(...days.map((d) => d.bookedHours), 0);
    return max > 0 ? Math.ceil(max) : 4;
  }, [days]);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-4 sm:p-4.5 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Monthly Booking Volume
            </h3>
            <p className="text-[10px] text-slate-400">
              Daily approved booked hours for {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Total Approved Time
            </span>
            <span className="text-base font-bold text-slate-900">
              {totalBookedHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">hours</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bar Chart Area */}
      <div className="pt-4 pb-1">
        <div className="h-32 flex items-end gap-1 sm:gap-1.5 px-1 border-b border-slate-200">
          {days.map((day) => {
            const isSelected = day.date === selectedDate;
            const hasHours = day.bookedHours > 0;
            const heightPercent = hasHours
              ? Math.max(10, Math.min(100, (day.bookedHours / maxHours) * 100))
              : 4;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
                onClick={() => onSelectDate(day.date)}
              >
                {/* Floating Tooltip */}
                <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap bg-slate-900 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-lg">
                  {day.date}: {day.bookedHours.toFixed(1)} hrs
                </div>

                {/* Vertical Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-sm transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 ring-2 ring-blue-300"
                      : hasHours
                      ? "bg-blue-500 hover:bg-blue-600"
                      : "bg-slate-100 hover:bg-slate-200"
                  }`}
                  title={`${day.date}: ${day.bookedHours.toFixed(1)} hrs approved`}
                />
              </div>
            );
          })}
        </div>

        {/* X-Axis Day Numbers */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 px-1">
          <span>Day 1</span>
          <span>Day 7</span>
          <span>Day 14</span>
          <span>Day 21</span>
          <span>Day {days.length}</span>
        </div>
      </div>

      {/* Chart Footer / Context */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
          <span>PostgreSQL GiST-verified approved reservations</span>
        </div>
        <span className="text-slate-400">Scale: 0 – {maxHours} hrs/day</span>
      </div>
    </div>
  );
}
