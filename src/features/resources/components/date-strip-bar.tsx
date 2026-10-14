"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getColomboDateStrip,
  shiftColomboDate,
  getColomboTodayString,
} from "@/features/reservations/utils/client-date";

interface DateStripBarProps {
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export function DateStripBar({
  selectedDate: propSelectedDate,
  onSelectDate,
}: DateStripBarProps) {
  const selectedDate = propSelectedDate || getColomboTodayString();
  const dateStripItems = getColomboDateStrip(selectedDate, 12);

  const handlePrev = () => {
    const prev = shiftColomboDate(selectedDate, -1);
    onSelectDate?.(prev);
  };

  const handleNext = () => {
    const next = shiftColomboDate(selectedDate, 1);
    onSelectDate?.(next);
  };

  return (
    <div className="flex items-center gap-1.5 w-full py-1 select-none">
      <button
        type="button"
        onClick={handlePrev}
        className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors shrink-0 shadow-2xs"
        aria-label="Previous date range"
        title="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 overflow-x-auto scrollbar-none min-w-0">
        {dateStripItems.map((item) => {
          const isSelected = item.dateStr === selectedDate;
          return (
            <button
              key={item.dateStr}
              type="button"
              onClick={() => onSelectDate?.(item.dateStr)}
              className={cn(
                "min-w-[44px] sm:min-w-0 sm:flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all border shadow-2xs relative shrink-0 sm:shrink",
                isSelected
                  ? "bg-blue-50 border-blue-200 text-blue-700 shadow-xs"
                  : "bg-white border-slate-200/80 text-slate-600 hover:border-slate-300"
              )}
            >
              {item.isToday && (
                <span
                  className={cn(
                    "absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-blue-600" : "bg-blue-400"
                  )}
                  title="Today in Asia/Colombo"
                />
              )}
              <span className="text-[10px] font-medium text-slate-400 leading-none mb-1">
                {item.day}
              </span>
              <span
                className={cn(
                  "text-base font-bold leading-none",
                  isSelected ? "text-blue-700" : "text-slate-800"
                )}
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

      <button
        type="button"
        onClick={handleNext}
        className="h-8 w-8 rounded-full border border-blue-600 bg-white flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors shrink-0 shadow-2xs"
        aria-label="Next date range"
        title="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
