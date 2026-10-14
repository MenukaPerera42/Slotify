"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getColomboDateRange,
  shiftColomboDate,
  getColomboTodayString,
} from "@/features/reservations/utils/client-date";

interface DateStripBarProps {
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

const VISIBLE_COUNT = 11;

export function DateStripBar({
  selectedDate: propSelectedDate,
  onSelectDate,
}: DateStripBarProps) {
  const selectedDate = propSelectedDate || getColomboTodayString();

  // Stable anchor: visible range starts at rangeStart, independent of which date is selected
  const [rangeStart, setRangeStart] = useState(() => shiftColomboDate(selectedDate, -2));
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);

  // If selectedDate moves outside the currently visible window, adjust rangeStart minimally to reveal it
  if (selectedDate !== prevSelectedDate) {
    setPrevSelectedDate(selectedDate);
    const rangeEnd = shiftColomboDate(rangeStart, VISIBLE_COUNT - 1);
    if (selectedDate < rangeStart) {
      setRangeStart(shiftColomboDate(selectedDate, -1));
    } else if (selectedDate > rangeEnd) {
      setRangeStart(shiftColomboDate(selectedDate, -(VISIBLE_COUNT - 2)));
    }
  }

  const dateStripItems = getColomboDateRange(rangeStart, VISIBLE_COUNT);

  // Chevron arrows intentionally shift the visible window without forcing selectedDate recentering
  const handlePrevRange = () => {
    setRangeStart((curr) => shiftColomboDate(curr, -5));
  };

  const handleNextRange = () => {
    setRangeStart((curr) => shiftColomboDate(curr, 5));
  };

  return (
    <div className="flex items-center gap-1.5 w-full py-1 select-none">
      <button
        type="button"
        onClick={handlePrevRange}
        className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors shrink-0 shadow-2xs"
        aria-label="Previous date range"
        title="Previous days"
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
                "min-w-[44px] sm:min-w-0 sm:flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center justify-center transition-all border shadow-2xs relative shrink-0 sm:shrink cursor-pointer",
                isSelected
                  ? "bg-blue-50 border-blue-200 text-blue-700 shadow-xs ring-1 ring-blue-300/50"
                  : "bg-white border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50"
              )}
            >
              {item.isToday && (
                <span
                  className={cn(
                    "absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-blue-600" : "bg-blue-500"
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
        onClick={handleNextRange}
        className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors shrink-0 shadow-2xs"
        aria-label="Next date range"
        title="Next days"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
